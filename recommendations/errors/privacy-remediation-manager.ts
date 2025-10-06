/**
 * Privacy remediation manager for handling privacy violations
 * Coordinates automatic remediation and incident response
 */

import { PrivacyViolationDetector, PrivacyViolation, ViolationType, RemediationAction } from './privacy-violation-detector';
import { PrivacyError } from './error-types';

export interface RemediationPlan {
  violationId: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  actions: RemediationAction[];
  estimatedDuration: number; // minutes
  requiresUserAction: boolean;
  requiresParentalAction: boolean;
  automaticExecution: boolean;
}

export interface RemediationResult {
  violationId: string;
  success: boolean;
  actionsExecuted: number;
  actionsFailed: number;
  duration: number; // milliseconds
  errors: string[];
  userNotified: boolean;
  dataRemoved: boolean;
  accessTerminated: boolean;
}

export interface IncidentReport {
  id: string;
  violationId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUsers: string[];
  dataTypes: string[];
  remediationStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  complianceImpact: string;
  reportedToAuthorities: boolean;
}

export class PrivacyRemediationManager {
  private detector: PrivacyViolationDetector;
  private incidentReports: Map<string, IncidentReport> = new Map();
  private remediationHistory: Map<string, RemediationResult> = new Map();

  constructor(detector: PrivacyViolationDetector) {
    this.detector = detector;
  }

  async handlePrivacyViolation(violation: PrivacyViolation): Promise<RemediationResult> {
    const startTime = Date.now();
    
    try {
      // Create remediation plan
      const plan = await this.createRemediationPlan(violation);
      
      // Create incident report for serious violations
      if (violation.severity === 'high' || violation.severity === 'critical') {
        await this.createIncidentReport(violation);
      }

      // Execute remediation
      const result = await this.executeRemediationPlan(violation, plan);
      
      // Store result
      this.remediationHistory.set(violation.id, result);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const failedResult: RemediationResult = {
        violationId: violation.id,
        success: false,
        actionsExecuted: 0,
        actionsFailed: violation.remediationActions.length,
        duration,
        errors: [error instanceof Error ? error.message : String(error)],
        userNotified: false,
        dataRemoved: false,
        accessTerminated: false
      };
      
      this.remediationHistory.set(violation.id, failedResult);
      return failedResult;
    }
  }

  private async createRemediationPlan(violation: PrivacyViolation): Promise<RemediationPlan> {
    const priority = this.determinePriority(violation);
    const actions = await this.planRemediationActions(violation);
    
    return {
      violationId: violation.id,
      priority,
      actions,
      estimatedDuration: this.estimateDuration(actions),
      requiresUserAction: this.requiresUserAction(actions),
      requiresParentalAction: this.requiresParentalAction(violation, actions),
      automaticExecution: priority === 'immediate' || priority === 'high'
    };
  }

  private determinePriority(violation: PrivacyViolation): 'immediate' | 'high' | 'medium' | 'low' {
    switch (violation.severity) {
      case 'critical':
        return 'immediate';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private async planRemediationActions(violation: PrivacyViolation): Promise<RemediationAction[]> {
    const actions: RemediationAction[] = [];
    
    // Always start with access termination for unauthorized access and parental consent
    if (violation.type === ViolationType.UNAUTHORIZED_DATA_ACCESS ||
        violation.type === ViolationType.EXTERNAL_DATA_SHARING ||
        violation.type === ViolationType.PARENTAL_CONSENT_MISSING) {
      actions.push({
        type: 'access_termination',
        description: 'Immediately terminate unauthorized access',
        executed: false
      });
    }

    // Data purging for consent and retention violations
    if (violation.type === ViolationType.CONSENT_VIOLATION ||
        violation.type === ViolationType.DATA_RETENTION_VIOLATION ||
        violation.type === ViolationType.CROSS_USER_DATA_LEAK) {
      actions.push({
        type: 'data_purge',
        description: 'Remove data processed without proper authorization',
        executed: false
      });
    }

    // Consent requests for missing consent
    if (violation.type === ViolationType.CONSENT_VIOLATION ||
        violation.type === ViolationType.PARENTAL_CONSENT_MISSING) {
      actions.push({
        type: 'consent_request',
        description: 'Request proper consent from user or parent',
        executed: false
      });
    }

    // User notification for all violations
    actions.push({
      type: 'notification',
      description: 'Notify affected user of privacy incident',
      executed: false
    });

    // Audit logging for compliance
    actions.push({
      type: 'audit_log',
      description: 'Create detailed audit trail for compliance',
      executed: false
    });

    return actions;
  }

  private estimateDuration(actions: RemediationAction[]): number {
    // Estimate duration in minutes based on action types
    const durations = {
      'access_termination': 1,
      'data_purge': 5,
      'consent_request': 2,
      'notification': 1,
      'audit_log': 2
    };

    return actions.reduce((total, action) => {
      return total + (durations[action.type] || 5);
    }, 0);
  }

  private requiresUserAction(actions: RemediationAction[]): boolean {
    return actions.some(action => 
      action.type === 'consent_request' && 
      !action.description.includes('parental')
    );
  }

  private requiresParentalAction(violation: PrivacyViolation, actions: RemediationAction[]): boolean {
    return violation.type === ViolationType.PARENTAL_CONSENT_MISSING ||
           actions.some(action => action.description.includes('parental'));
  }

  private async executeRemediationPlan(
    violation: PrivacyViolation,
    plan: RemediationPlan
  ): Promise<RemediationResult> {
    const startTime = Date.now();
    let actionsExecuted = 0;
    let actionsFailed = 0;
    const errors: string[] = [];
    let userNotified = false;
    let dataRemoved = false;
    let accessTerminated = false;

    for (const action of plan.actions) {
      try {
        await this.detector.executeRemediationAction(violation, action);
        actionsExecuted++;
        
        // Track specific outcomes
        switch (action.type) {
          case 'notification':
            userNotified = true;
            break;
          case 'data_purge':
            dataRemoved = true;
            break;
          case 'access_termination':
            accessTerminated = true;
            break;
        }
        
      } catch (error) {
        actionsFailed++;
        errors.push(`${action.type}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const duration = Date.now() - startTime;
    const success = actionsFailed === 0;

    // Update incident report if exists
    const incidentId = `incident-${violation.id}`;
    const incident = this.incidentReports.get(incidentId);
    if (incident) {
      incident.remediationStatus = success ? 'completed' : 'failed';
    }

    return {
      violationId: violation.id,
      success,
      actionsExecuted,
      actionsFailed,
      duration,
      errors,
      userNotified,
      dataRemoved,
      accessTerminated
    };
  }

  private async createIncidentReport(violation: PrivacyViolation): Promise<IncidentReport> {
    const report: IncidentReport = {
      id: `incident-${violation.id}`,
      violationId: violation.id,
      timestamp: new Date(),
      severity: violation.severity,
      description: `Privacy violation: ${violation.type} - ${violation.description}`,
      affectedUsers: [violation.userId],
      dataTypes: violation.dataInvolved,
      remediationStatus: 'pending',
      complianceImpact: this.assessComplianceImpact(violation),
      reportedToAuthorities: false
    };

    this.incidentReports.set(report.id, report);

    // For critical violations, consider reporting to authorities
    if (violation.severity === 'critical') {
      await this.considerAuthorityReporting(report);
    }

    return report;
  }

  private assessComplianceImpact(violation: PrivacyViolation): string {
    switch (violation.type) {
      case ViolationType.UNAUTHORIZED_DATA_ACCESS:
        return 'Potential data breach - requires immediate disclosure';
      case ViolationType.CONSENT_VIOLATION:
        return 'GDPR/COPPA compliance violation - may require regulatory notification';
      case ViolationType.DATA_RETENTION_VIOLATION:
        return 'Data retention policy violation - audit trail required';
      case ViolationType.CROSS_USER_DATA_LEAK:
        return 'Data confidentiality breach - user notification required';
      case ViolationType.EXTERNAL_DATA_SHARING:
        return 'Unauthorized data sharing - potential regulatory violation';
      case ViolationType.PARENTAL_CONSENT_MISSING:
        return 'COPPA violation - immediate remediation required';
      default:
        return 'Privacy policy violation - internal review required';
    }
  }

  private async considerAuthorityReporting(report: IncidentReport): Promise<void> {
    // Determine if authorities need to be notified based on violation type and severity
    const requiresReporting = 
      report.severity === 'critical' &&
      (report.description.includes('breach') || 
       report.description.includes('unauthorized') ||
       report.description.includes('external'));

    if (requiresReporting) {
      // In a real implementation, this would trigger actual reporting
      console.warn(`Critical privacy incident ${report.id} may require authority notification`);
      report.reportedToAuthorities = true;
    }
  }

  async getIncidentReports(userId?: string): Promise<IncidentReport[]> {
    const reports = Array.from(this.incidentReports.values());
    
    if (userId) {
      return reports.filter(report => report.affectedUsers.includes(userId));
    }
    
    return reports;
  }

  async getRemediationHistory(violationId?: string): Promise<RemediationResult[]> {
    const results = Array.from(this.remediationHistory.values());
    
    if (violationId) {
      return results.filter(result => result.violationId === violationId);
    }
    
    return results;
  }

  async generateComplianceReport(): Promise<{
    totalViolations: number;
    violationsByType: Record<ViolationType, number>;
    remediationSuccessRate: number;
    averageRemediationTime: number;
    criticalIncidents: number;
    pendingRemediation: number;
  }> {
    const violations = this.detector.getViolations();
    const results = Array.from(this.remediationHistory.values());
    const incidents = Array.from(this.incidentReports.values());

    const violationsByType = violations.reduce((acc, violation) => {
      acc[violation.type] = (acc[violation.type] || 0) + 1;
      return acc;
    }, {} as Record<ViolationType, number>);

    const successfulRemediations = results.filter(r => r.success).length;
    const remediationSuccessRate = results.length > 0 ? successfulRemediations / results.length : 0;

    const totalRemediationTime = results.reduce((sum, r) => sum + r.duration, 0);
    const averageRemediationTime = results.length > 0 ? totalRemediationTime / results.length : 0;

    const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;
    const pendingRemediation = incidents.filter(i => 
      i.remediationStatus === 'pending' || i.remediationStatus === 'in_progress'
    ).length;

    return {
      totalViolations: violations.length,
      violationsByType,
      remediationSuccessRate,
      averageRemediationTime,
      criticalIncidents,
      pendingRemediation
    };
  }

  async clearHistory(): Promise<void> {
    this.incidentReports.clear();
    this.remediationHistory.clear();
  }
}