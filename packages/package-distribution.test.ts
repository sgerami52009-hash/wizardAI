/**
 * Package Distribution and Security Tests
 * 
 * Tests for package download, security scanning, parental approval,
 * and audit trail functionality.
 */

import { 
  PackageDistributionManager, 
  PackageSecurityScanner,
  DistributionConfig,
  PackageDownloadRequest,
  ParentalApprovalDecision,
  SecurityScanResult
} from './package-distribution';
import { mkdir, rmdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PackageDistributionManager', () => {
  let distributionManager: PackageDistributionManager;
  let testConfig: DistributionConfig;
  let testDirectory: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDirectory = join(tmpdir(), `distribution-test-${Date.now()}`);
    await mkdir(testDirectory, { recursive: true });

    testConfig = {
      downloadDirectory: join(testDirectory, 'downloads'),
      auditLogPath: join(testDirectory, 'audit.json'),
      enableParentalControls: true,
      requireApprovalForAges: [5, 6, 7, 8, 9, 10, 11, 12],
      maxDownloadSize: 50 * 1024 * 1024, // 50MB
      allowedSources: ['official', 'community', 'local'],
      securityScanEnabled: true,
      quarantineDirectory: join(testDirectory, 'quarantine')
    };

    distributionManager = new PackageDistributionManager(testConfig);
  });

  afterEach(async () => {
    try {
      await rmdir(testDirectory, { recursive: true });
    } catch {
      // Directory might not exist or be in use
    }
  });

  describe('Package Download', () => {
    it('should successfully download a valid package', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.valid-download',
        version: '1.0.0',
        source: 'official',
        requestedBy: 'user123',
        timestamp: new Date()
      };

      const result = await distributionManager.downloadCharacterPackage(downloadRequest);

      expect(result.success).toBe(true);
      expect(result.packageId).toBe('com.test.valid-download');
      expect(result.errors).toHaveLength(0);
      expect(result.packagePath).toBeTruthy();
      expect(result.downloadSize).toBeGreaterThan(0);
    });

    it('should reject downloads from unauthorized sources', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.unauthorized',
        version: '1.0.0',
        source: 'unauthorized' as any,
        requestedBy: 'user123',
        timestamp: new Date()
      };

      const result = await distributionManager.downloadCharacterPackage(downloadRequest);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true);
    });

    it('should require parental approval for community packages', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.community-package',
        version: '1.0.0',
        source: 'community',
        requestedBy: 'child123',
        timestamp: new Date()
      };

      const approvalEvents: any[] = [];
      distributionManager.on('parentalApprovalRequired', (data) => approvalEvents.push(data));

      const result = await distributionManager.downloadCharacterPackage(downloadRequest);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('parental approval'))).toBe(true);
      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].packageId).toBe('com.test.community-package');
    });

    it('should track download events in audit log', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.audit-tracking',
        version: '1.0.0',
        source: 'official',
        requestedBy: 'user123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);

      const auditLog = distributionManager.getAuditLog({
        packageId: 'com.test.audit-tracking',
        userId: 'user123'
      });

      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog.some(entry => entry.action === 'download_requested')).toBe(true);
      expect(auditLog.some(entry => entry.action === 'download_completed')).toBe(true);
    });

    it('should emit download events', async () => {
      const events: any[] = [];
      distributionManager.on('packageDownloaded', (data) => events.push(data));

      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.events',
        version: '1.0.0',
        source: 'official',
        requestedBy: 'user123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);

      expect(events).toHaveLength(1);
      expect(events[0].packageId).toBe('com.test.events');
      expect(events[0].userId).toBe('user123');
    });
  });

  describe('Parental Approval System', () => {
    it('should create parental approval requests', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.approval-needed',
        version: '1.0.0',
        source: 'community',
        requestedBy: 'child123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);

      const pendingRequests = distributionManager.getPendingApprovalRequests();
      expect(pendingRequests).toHaveLength(1);
      expect(pendingRequests[0].packageId).toBe('com.test.approval-needed');
      expect(pendingRequests[0].childUserId).toBe('child123');
    });

    it('should process approval decisions', async () => {
      // Create approval request
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.approval-process',
        version: '1.0.0',
        source: 'community',
        requestedBy: 'child123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);
      const pendingRequests = distributionManager.getPendingApprovalRequests();
      const requestId = pendingRequests[0].requestId;

      // Process approval
      const approvalEvents: any[] = [];
      distributionManager.on('packageApproved', (data) => approvalEvents.push(data));

      const decision: ParentalApprovalDecision = {
        requestId: requestId,
        approved: true,
        parentUserId: 'parent123',
        decidedAt: new Date(),
        reason: 'Package looks safe for child'
      };

      await distributionManager.processParentalDecision(decision);

      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].packageId).toBe('com.test.approval-process');
      expect(approvalEvents[0].childUserId).toBe('child123');

      // Request should be removed from pending
      const remainingRequests = distributionManager.getPendingApprovalRequests();
      expect(remainingRequests).toHaveLength(0);
    });

    it('should process rejection decisions', async () => {
      // Create approval request
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.rejection-process',
        version: '1.0.0',
        source: 'community',
        requestedBy: 'child123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);
      const pendingRequests = distributionManager.getPendingApprovalRequests();
      const requestId = pendingRequests[0].requestId;

      // Process rejection
      const rejectionEvents: any[] = [];
      distributionManager.on('packageRejected', (data) => rejectionEvents.push(data));

      const decision: ParentalApprovalDecision = {
        requestId: requestId,
        approved: false,
        parentUserId: 'parent123',
        decidedAt: new Date(),
        reason: 'Package not appropriate for child'
      };

      await distributionManager.processParentalDecision(decision);

      expect(rejectionEvents).toHaveLength(1);
      expect(rejectionEvents[0].packageId).toBe('com.test.rejection-process');
      expect(rejectionEvents[0].reason).toBe('Package not appropriate for child');
    });

    it('should handle invalid approval request IDs', async () => {
      const decision: ParentalApprovalDecision = {
        requestId: 'invalid-request-id',
        approved: true,
        parentUserId: 'parent123',
        decidedAt: new Date()
      };

      await expect(
        distributionManager.processParentalDecision(decision)
      ).rejects.toThrow('not found');
    });
  });

  describe('Audit Trail', () => {
    it('should log all package-related activities', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.audit-complete',
        version: '1.0.0',
        source: 'official',
        requestedBy: 'user123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);
      await distributionManager.trackPackageUsage('com.test.audit-complete', 'user123', 'installation');
      await distributionManager.trackPackageUsage('com.test.audit-complete', 'user123', 'usage');

      const auditLog = distributionManager.getAuditLog({
        packageId: 'com.test.audit-complete'
      });

      const actions = auditLog.map(entry => entry.action);
      expect(actions).toContain('download_requested');
      expect(actions).toContain('download_completed');
      expect(actions).toContain('installation');
      expect(actions).toContain('usage');
    });

    it('should filter audit log by various criteria', async () => {
      // Create multiple audit entries
      await distributionManager.trackPackageUsage('com.test.filter1', 'user1', 'installation');
      await distributionManager.trackPackageUsage('com.test.filter2', 'user2', 'usage');
      await distributionManager.trackPackageUsage('com.test.filter1', 'user1', 'uninstallation');

      // Filter by package ID
      const packageLog = distributionManager.getAuditLog({
        packageId: 'com.test.filter1'
      });
      expect(packageLog).toHaveLength(2);
      expect(packageLog.every(entry => entry.packageId === 'com.test.filter1')).toBe(true);

      // Filter by user ID
      const userLog = distributionManager.getAuditLog({
        userId: 'user2'
      });
      expect(userLog).toHaveLength(1);
      expect(userLog[0].userId).toBe('user2');

      // Filter by action
      const installationLog = distributionManager.getAuditLog({
        action: 'installation'
      });
      expect(installationLog).toHaveLength(1);
      expect(installationLog[0].action).toBe('installation');
    });

    it('should emit audit events', async () => {
      const auditEvents: any[] = [];
      distributionManager.on('auditEntryLogged', (entry) => auditEvents.push(entry));

      await distributionManager.trackPackageUsage('com.test.audit-events', 'user123', 'usage');

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0].action).toBe('usage');
      expect(auditEvents[0].packageId).toBe('com.test.audit-events');
    });

    it('should track package usage events', async () => {
      const usageEvents: any[] = [];
      distributionManager.on('packageUsageTracked', (data) => usageEvents.push(data));

      await distributionManager.trackPackageUsage('com.test.usage-tracking', 'user123', 'installation');
      await distributionManager.trackPackageUsage('com.test.usage-tracking', 'user123', 'usage');
      await distributionManager.trackPackageUsage('com.test.usage-tracking', 'user123', 'uninstallation');

      expect(usageEvents).toHaveLength(3);
      expect(usageEvents.map(e => e.action)).toEqual(['installation', 'usage', 'uninstallation']);
    });
  });

  describe('Security Integration', () => {
    it('should integrate security scanning with download process', async () => {
      const downloadRequest: PackageDownloadRequest = {
        packageId: 'com.test.security-scan',
        version: '1.0.0',
        source: 'official',
        requestedBy: 'user123',
        timestamp: new Date()
      };

      await distributionManager.downloadCharacterPackage(downloadRequest);

      // Check that security scan was logged
      const auditLog = distributionManager.getAuditLog({
        packageId: 'com.test.security-scan',
        action: 'security_scan'
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].details.riskLevel).toBeDefined();
    });
  });
});

describe('PackageSecurityScanner', () => {
  let securityScanner: PackageSecurityScanner;
  let testDirectory: string;

  beforeEach(async () => {
    securityScanner = new PackageSecurityScanner();
    testDirectory = join(tmpdir(), `security-test-${Date.now()}`);
    await mkdir(testDirectory, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rmdir(testDirectory, { recursive: true });
    } catch {
      // Directory might not exist or be in use
    }
  });

  describe('Security Scanning', () => {
    it('should scan clean packages successfully', async () => {
      const cleanPackagePath = join(testDirectory, 'clean-package.kac');
      await writeFile(cleanPackagePath, JSON.stringify({
        package: { id: 'clean-package', name: 'Clean Package' },
        assets: ['model.glb', 'texture.png']
      }));

      const result = await securityScanner.scanPackage(cleanPackagePath);

      expect(result.isSecure).toBe(true);
      expect(result.threats).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
      expect(result.scanDuration).toBeGreaterThan(0);
      expect(result.scannerVersion).toBeTruthy();
    });

    it('should detect malicious signatures', async () => {
      const maliciousPackagePath = join(testDirectory, 'malicious-package.kac');
      await writeFile(maliciousPackagePath, 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

      const result = await securityScanner.scanPackage(maliciousPackagePath);

      expect(result.isSecure).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.type === 'malware')).toBe(true);
      expect(result.riskLevel).toBe('critical');
    });

    it('should detect suspicious code patterns', async () => {
      const suspiciousPackagePath = join(testDirectory, 'suspicious-package.kac');
      await writeFile(suspiciousPackagePath, JSON.stringify({
        package: { id: 'suspicious-package' },
        script: 'eval(userInput); exec("rm -rf /");'
      }));

      const result = await securityScanner.scanPackage(suspiciousPackagePath);

      expect(result.isSecure).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.type === 'suspicious_code')).toBe(true);
      expect(result.riskLevel).toBeOneOf(['medium', 'high']);
    });

    it('should detect network access to suspicious domains', async () => {
      const networkPackagePath = join(testDirectory, 'network-package.kac');
      await writeFile(networkPackagePath, JSON.stringify({
        package: { id: 'network-package' },
        config: { apiEndpoint: 'https://malware.com/api' }
      }));

      const result = await securityScanner.scanPackage(networkPackagePath);

      expect(result.isSecure).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.type === 'network_access')).toBe(true);
      expect(result.riskLevel).toBeOneOf(['medium', 'high']);
    });

    it('should detect data exfiltration patterns', async () => {
      const exfiltrationPackagePath = join(testDirectory, 'exfiltration-package.kac');
      await writeFile(exfiltrationPackagePath, JSON.stringify({
        package: { id: 'exfiltration-package' },
        functions: ['send_data', 'upload_file', 'transmit_info']
      }));

      const result = await securityScanner.scanPackage(exfiltrationPackagePath);

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.type === 'data_exfiltration')).toBe(true);
    });

    it('should calculate risk levels correctly', async () => {
      // Test critical risk
      const criticalPackagePath = join(testDirectory, 'critical-package.kac');
      await writeFile(criticalPackagePath, 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR');

      const criticalResult = await securityScanner.scanPackage(criticalPackagePath);
      expect(criticalResult.riskLevel).toBe('critical');

      // Test medium risk
      const mediumPackagePath = join(testDirectory, 'medium-package.kac');
      await writeFile(mediumPackagePath, JSON.stringify({
        functions: ['send_data']
      }));

      const mediumResult = await securityScanner.scanPackage(mediumPackagePath);
      expect(mediumResult.riskLevel).toBeOneOf(['low', 'medium']);
    });

    it('should handle scan errors gracefully', async () => {
      const nonExistentPath = join(testDirectory, 'non-existent-package.kac');

      const result = await securityScanner.scanPackage(nonExistentPath);

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.description.includes('Security scan failed'))).toBe(true);
    });

    it('should provide detailed threat information', async () => {
      const threatPackagePath = join(testDirectory, 'threat-package.kac');
      await writeFile(threatPackagePath, JSON.stringify({
        maliciousCode: 'eval(dangerousInput)',
        networkCall: 'fetch("https://malware.com")'
      }));

      const result = await securityScanner.scanPackage(threatPackagePath);

      expect(result.threats.length).toBeGreaterThan(0);
      
      for (const threat of result.threats) {
        expect(threat.type).toBeDefined();
        expect(threat.severity).toBeOneOf(['low', 'medium', 'high', 'critical']);
        expect(threat.description).toBeTruthy();
        expect(threat.location).toBeTruthy();
        expect(threat.recommendation).toBeTruthy();
      }
    });
  });
});

// Custom Jest matcher for testing multiple possible values
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}