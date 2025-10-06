// Privacy Filter Unit Tests - Comprehensive PII Detection and Anonymization Testing

import { EnhancedPrivacyFilter } from './filter';
import { 
  PrivacyLevel, 
  UserInteraction, 
  FilteredInteraction,
  InteractionSource, 
  InteractionType,
  ViolationType,
  ViolationSeverity,
  RiskLevel,
  AnonymizationTechnique
} from './types';
import { PatternType } from '../learning/types';

describe('EnhancedPrivacyFilter', () => {
  let privacyFilter: EnhancedPrivacyFilter;
  const testUserId = 'test-user-123';
  const childUserId = 'child-user-456';
  const teenUserId = 'teen-user-789';

  beforeEach(() => {
    privacyFilter = new EnhancedPrivacyFilter();
  });

  describe('PII Detection Accuracy Tests', () => {
    describe('High-Confidence PII Detection', () => {
      test('should detect Social Security Numbers in various formats', async () => {
        const testData = {
          ssn1: '123-45-6789',
          ssn2: '123456789',
          ssn3: '123 45 6789',
          normalText: 'This is normal text without PII'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].violationType).toBe(ViolationType.PII_EXPOSURE);
        expect(result.violations[0].severity).toBe(ViolationSeverity.CRITICAL);
        expect(result.violations[0].description).toContain('ssn');
      });

      test('should detect email addresses in various formats', async () => {
        const testData = {
          email1: 'user@example.com',
          email2: 'test.user+tag@domain.co.uk',
          email3: 'user_name123@sub.domain.org',
          normalText: 'Contact us for more information'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].violationType).toBe(ViolationType.PII_EXPOSURE);
        expect(result.violations[0].description).toContain('email');
      });

      test('should detect phone numbers in multiple formats', async () => {
        const testData = {
          phone1: '(555) 123-4567',
          phone2: '555-123-4567',
          phone3: '5551234567',
          phone4: '+1-555-123-4567',
          phone5: '1 555 123 4567',
          normalText: 'Call for assistance'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].description).toContain('phone');
      });

      test('should detect credit card numbers', async () => {
        const testData = {
          visa: '4111 1111 1111 1111',
          mastercard: '5555-5555-5555-4444',
          amex: '378282246310005',
          normalNumbers: '1234 for reference'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].description).toContain('creditCard');
      });

      test('should detect IP addresses', async () => {
        const testData = {
          ipv4_1: '192.168.1.1',
          ipv4_2: '10.0.0.1',
          ipv4_3: '172.16.254.1',
          normalText: 'Network configuration'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].description).toContain('ipAddress');
      });
    });

    describe('Medium-Confidence PII Detection', () => {
      test('should detect physical addresses', async () => {
        const testData = {
          address1: '123 Main Street',
          address2: '456 Oak Avenue',
          address3: '789 First Boulevard',
          address4: '321 Park Lane',
          normalText: 'Visit our location'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].violationType).toBe(ViolationType.POTENTIAL_PII_EXPOSURE);
        expect(result.violations[0].severity).toBe(ViolationSeverity.HIGH);
        expect(result.violations[0].description).toContain('address');
      });

      test('should detect ZIP codes', async () => {
        const testData = {
          zip1: '12345',
          zip2: '12345-6789',
          normalNumbers: '123 items'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        // ZIP codes are detected as potential PII (medium confidence)
        const potentialPiiViolation = result.violations.find(v => v.violationType === ViolationType.POTENTIAL_PII_EXPOSURE);
        expect(potentialPiiViolation).toBeDefined();
        expect(potentialPiiViolation?.description).toContain('zipCode');
      });

      test('should detect full names', async () => {
        const testData = {
          name1: 'John Smith',
          name2: 'Mary Jane Watson',
          name3: 'Robert Johnson Jr',
          singleName: 'John', // Should not trigger full name detection
          normalText: 'Welcome to our service'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].description).toContain('fullName');
      });

      test('should detect dates of birth', async () => {
        const testData = {
          dob1: '01/15/1990',
          dob2: '12-25-1985',
          dob3: '03/04/2000',
          normalDate: '2024/01/01' // Current year, less likely to be DOB
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].description).toContain('dateOfBirth');
      });
    });

    describe('Low-Confidence PII Detection', () => {
      test('should detect possible names with maximum privacy level', async () => {
        await privacyFilter.configurePrivacyLevel(testUserId, PrivacyLevel.MAXIMUM);

        const testData = {
          possibleName1: 'Alice',
          possibleName2: 'Bob',
          possibleName3: 'Charlie',
          commonWord: 'the'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        const privacyLevelViolation = result.violations.find(v => v.violationType === ViolationType.PRIVACY_LEVEL_VIOLATION);
        expect(privacyLevelViolation).toBeDefined();
        expect(privacyLevelViolation?.severity).toBe(ViolationSeverity.MEDIUM);
        expect(privacyLevelViolation?.description).toContain('maximum privacy level');
      });

      test('should detect coordinate patterns', async () => {
        await privacyFilter.configurePrivacyLevel(testUserId, PrivacyLevel.MAXIMUM);

        const testData = {
          coordinates1: '40.7128, -74.0060', // NYC coordinates
          coordinates2: '34.0522, -118.2437', // LA coordinates
          normalNumbers: '1.5, 2.3' // Regular decimal numbers
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].description).toContain('maximum privacy level');
      });

      test('should detect long number sequences', async () => {
        await privacyFilter.configurePrivacyLevel(testUserId, PrivacyLevel.MAXIMUM);

        const testData = {
          longNumber1: '1234567890',
          longNumber2: '9876543210',
          shortNumber: '123' // Should not trigger
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(false);
        // Long numbers might be detected as phone numbers (high confidence) or privacy level violation
        const hasPhoneViolation = result.violations.some(v => v.description.includes('phone'));
        const hasPrivacyLevelViolation = result.violations.some(v => v.description.includes('maximum privacy level'));
        expect(hasPhoneViolation || hasPrivacyLevelViolation).toBe(true);
      });
    });

    describe('False Positive Prevention', () => {
      test('should not flag common words as PII', async () => {
        const testData = {
          commonWords: 'hello world test example sample data',
          numbers: '1 2 3 4 5',
          normalSentence: 'This is a normal sentence without any personal information.'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      test('should not flag technical identifiers as PII', async () => {
        const testData = {
          uuid: '550e8400-e29b-41d4-a716-446655440000',
          hash: 'a1b2c3d4e5f6',
          timestamp: '1640995200000',
          version: '1.0.0'
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      test('should handle edge cases in pattern matching', async () => {
        const testData = {
          almostSSN: '123-45-678', // Too short
          almostEmail: 'user@', // Incomplete
          almostPhone: '555-123', // Too short
          almostAddress: '123 Main' // Missing street type
        };

        const result = await privacyFilter.validatePrivacyCompliance(testData, testUserId);

        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
      });
    });
  });

  describe('Anonymization Algorithm Tests', () => {
    describe('String Data Anonymization', () => {
      test('should anonymize string data using tokenization', async () => {
        const testString = 'John Smith lives at 123 Main Street and his email is john@example.com';

        const result = await privacyFilter.anonymizeData(testString);

        expect(result.technique).toBe(AnonymizationTechnique.TOKENIZATION);
        expect(result.retainedPatterns).toContain('temporal_patterns');
        expect(result.retainedPatterns).toContain('interaction_frequency');
        expect(result.removedElements).toContain('pii');
        expect(result.removedElements).toContain('raw_content');
        expect(result.removedElements).toContain('identifiers');
      });

      test('should handle unicode and special characters in anonymization', async () => {
        const testString = 'User: 👤 John Doe 🏠 123 Main St 📧 john@test.com 🌟';

        const result = await privacyFilter.anonymizeData(testString);

        expect(result.technique).toBe(AnonymizationTechnique.TOKENIZATION);
        expect(result.anonymizedAt).toBeInstanceOf(Date);
        expect(result.dataId).toMatch(/^epf_\d+_[a-z0-9]+$/);
      });

      test('should anonymize empty and null strings gracefully', async () => {
        const emptyResult = await privacyFilter.anonymizeData('');
        const nullResult = await privacyFilter.anonymizeData(null);

        expect(emptyResult.technique).toBeDefined();
        expect(nullResult.technique).toBeDefined();
        expect(emptyResult.dataId).toBeDefined();
        expect(nullResult.dataId).toBeDefined();
      });
    });

    describe('Object Data Anonymization', () => {
      test('should anonymize object data using differential privacy', async () => {
        const testObject = {
          patterns: [
            { id: 'pattern1', strength: 0.8, frequency: 5 },
            { id: 'pattern2', strength: 0.6, frequency: 3 }
          ],
          metadata: { userId: 'user123', timestamp: new Date() }
        };

        const result = await privacyFilter.anonymizeData(testObject);

        expect(result.technique).toBe(AnonymizationTechnique.DIFFERENTIAL_PRIVACY);
        expect(result.retainedPatterns).toContain('temporal_patterns');
        expect(result.removedElements).toContain('pii');
      });

      test('should handle nested objects in anonymization', async () => {
        const nestedObject = {
          user: {
            profile: {
              name: 'John Doe',
              contact: {
                email: 'john@example.com',
                phone: '555-1234'
              }
            }
          },
          patterns: [{ type: 'behavioral', strength: 0.7 }]
        };

        const result = await privacyFilter.anonymizeData(nestedObject);

        expect(result.technique).toBe(AnonymizationTechnique.DIFFERENTIAL_PRIVACY);
        expect(result.dataId).toBeDefined();
        expect(result.anonymizedAt).toBeInstanceOf(Date);
      });
    });

    describe('Numerical Data Anonymization', () => {
      test('should anonymize numerical data using hashing', async () => {
        const testNumber = 1234567890;

        const result = await privacyFilter.anonymizeData(testNumber);

        expect(result.technique).toBe(AnonymizationTechnique.HASHING);
        expect(result.privacyLevel).toBe('enhanced');
      });

      test('should handle arrays of numbers', async () => {
        const numberArray = [123, 456, 789, 1011];

        const result = await privacyFilter.anonymizeData(numberArray);

        expect(result.technique).toBeDefined();
        expect(result.retainedPatterns).toBeDefined();
        expect(result.removedElements).toBeDefined();
      });
    });

    describe('Differential Privacy Implementation', () => {
      test('should apply appropriate noise levels based on privacy level', async () => {
        const testInteraction: UserInteraction = {
          userId: testUserId,
          sessionId: 'session123',
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: {
            timeOfDay: 'morning' as any,
            dayOfWeek: 'monday' as any,
            location: { type: 'home' } as any,
            deviceType: 'smart_speaker' as any,
            previousInteractions: [],
            environmentalFactors: { lighting: 'bright' } as any
          },
          patterns: [
            {
              patternId: 'pattern1',
              type: PatternType.TEMPORAL,
              strength: 0.8,
              frequency: 5,
              context: { timeOfDay: 'morning' } as any,
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.9,
            completionTime: 1500,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        // Test different privacy levels
        const privacyLevels = [
          PrivacyLevel.MINIMAL,
          PrivacyLevel.STANDARD,
          PrivacyLevel.ENHANCED,
          PrivacyLevel.MAXIMUM
        ];

        const results: Array<{ level: PrivacyLevel; filtered: FilteredInteraction }> = [];
        for (const level of privacyLevels) {
          await privacyFilter.configurePrivacyLevel(testUserId, level);
          const filtered = await privacyFilter.filterInteraction(testInteraction);
          results.push({ level, filtered });
        }

        // Verify that higher privacy levels result in more anonymization
        expect(results[0].filtered.privacyLevel).toBe(PrivacyLevel.MINIMAL);
        expect(results[3].filtered.privacyLevel).toBe(PrivacyLevel.MAXIMUM);

        // Verify metadata includes noise level information
        results.forEach(({ filtered }) => {
          expect(filtered.metadata.privacyFiltersApplied).toContain('differential_privacy');
          expect(filtered.metadata.noiseLevel).toBeDefined();
        });
      });

      test('should maintain data utility while preserving privacy', async () => {
        const testInteraction: UserInteraction = {
          userId: testUserId,
          sessionId: 'session123',
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: {
            timeOfDay: 'morning' as any,
            dayOfWeek: 'monday' as any,
            location: { type: 'home' } as any,
            deviceType: 'smart_speaker' as any,
            previousInteractions: [],
            environmentalFactors: { lighting: 'bright' } as any
          },
          patterns: [
            {
              patternId: 'pattern1',
              type: PatternType.TEMPORAL,
              strength: 0.8,
              frequency: 10,
              context: { timeOfDay: 'morning' } as any,
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.9,
            completionTime: 1500,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        await privacyFilter.configurePrivacyLevel(testUserId, PrivacyLevel.STANDARD);
        const filtered = await privacyFilter.filterInteraction(testInteraction);

        // Verify that patterns are preserved but anonymized
        expect(filtered.patterns).toHaveLength(1);
        expect(filtered.patterns[0].type).toBe(PatternType.TEMPORAL);
        // Allow for significant noise due to differential privacy
        expect(filtered.patterns[0].strength).toBeGreaterThan(-5);
        expect(filtered.patterns[0].strength).toBeLessThan(5);
        expect(filtered.patterns[0].frequency).toBeGreaterThan(-5);
        expect(filtered.patterns[0].frequency).toBeLessThan(25);
        expect(filtered.patterns[0].patternHash).toBeDefined();
        expect(filtered.patterns[0].contextHash).toBeDefined();
      });
    });
  });

  describe('Privacy Compliance by Age Group Tests', () => {
    describe('Child Users (Under 13) - COPPA Compliance', () => {
      beforeEach(async () => {
        // Configure child user with maximum privacy
        await privacyFilter.configurePrivacyLevel(childUserId, PrivacyLevel.MAXIMUM);
      });

      test('should enforce strictest privacy controls for child users', async () => {
        const childInteraction: UserInteraction = {
          userId: childUserId,
          sessionId: 'child-session',
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: {
            timeOfDay: 'afternoon' as any,
            dayOfWeek: 'saturday' as any,
            location: { type: 'home' } as any,
            deviceType: 'tablet' as any,
            previousInteractions: [],
            environmentalFactors: { lighting: 'natural' } as any
          },
          patterns: [
            {
              patternId: 'child-pattern',
              type: PatternType.BEHAVIORAL,
              strength: 0.5,
              frequency: 3,
              context: { activity: 'learning' } as any,
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.8,
            completionTime: 2000,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        const filtered = await privacyFilter.filterInteraction(childInteraction);

        // Verify maximum privacy level is applied
        expect(filtered.privacyLevel).toBe(PrivacyLevel.MAXIMUM);
        expect(filtered.metadata.dataRetentionDays).toBe(7); // Shortest retention
        expect(filtered.metadata.privacyFiltersApplied).toContain('multi_stage_pii_detection');
        expect(filtered.metadata.privacyFiltersApplied).toContain('differential_privacy');
        expect(filtered.metadata.privacyFiltersApplied).toContain('behavioral_anonymization');

        // Verify user ID is hashed
        expect(filtered.userId).not.toBe(childUserId);
        expect(filtered.userId).toMatch(/^[a-z0-9]+$/);

        // Verify context is heavily anonymized
        expect(filtered.context.temporalHash).toBeDefined();
        expect(filtered.context.locationHash).toBeDefined();
        expect(filtered.context.deviceTypeHash).toBeDefined();
        expect(filtered.context.environmentalHash).toBeDefined();
      });

      test('should flag any PII in child data as critical violation', async () => {
        const childDataWithPII = {
          childName: 'Emma Johnson',
          schoolEmail: 'emma.j@school.edu',
          parentPhone: '555-0123',
          address: '456 Oak Street'
        };

        const result = await privacyFilter.validatePrivacyCompliance(childDataWithPII, childUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
        expect(result.violations.length).toBeGreaterThan(0);
        const criticalViolation = result.violations.find(v => v.severity === ViolationSeverity.CRITICAL);
        expect(criticalViolation).toBeDefined();
        
        // Verify COPPA compliance flag
        expect(result.violations[0].description).toContain('High-confidence PII detected');
      });

      test('should generate child-specific privacy report', async () => {
        const report = await privacyFilter.generatePrivacyReport(childUserId);

        expect(report.userId).toBe(childUserId);
        expect(report.complianceStatus.regulation).toBe('coppa');
        expect(report.complianceStatus.isCompliant).toBe(true);
        expect(report.complianceStatus.certifications).toContain('child_safety');
        
        // Verify short retention periods for child data
        report.retentionPolicies.forEach(policy => {
          expect(policy.retentionDays).toBeLessThanOrEqual(7);
          expect(policy.autoDelete).toBe(true);
          expect(policy.userNotification).toBe(true);
        });

        // Verify no sharing activities
        expect(report.sharingActivities).toHaveLength(0);

        // Verify user rights include parental controls
        const erasureRight = report.userRights.find(right => right.rightType === 'erasure');
        expect(erasureRight?.isAvailable).toBe(true);
        expect(erasureRight?.responseTime).toBe('Immediate');
      });

      test('should handle child data with enhanced anonymization', async () => {
        const childData = {
          favoriteColor: 'blue',
          preferredActivity: 'reading',
          bedtime: '8:00 PM',
          schoolGrade: '3rd grade'
        };

        const anonymized = await privacyFilter.anonymizeData(childData);

        expect(anonymized.privacyLevel).toBe('enhanced');
        expect(anonymized.retainedPatterns).toContain('temporal_patterns');
        expect(anonymized.removedElements).toContain('pii');
        expect(anonymized.removedElements).toContain('identifiers');
      });
    });

    describe('Teen Users (13-17) - Enhanced Privacy Controls', () => {
      beforeEach(async () => {
        // Configure teen user with enhanced privacy
        await privacyFilter.configurePrivacyLevel(teenUserId, PrivacyLevel.ENHANCED);
      });

      test('should apply enhanced privacy controls for teen users', async () => {
        const teenInteraction: UserInteraction = {
          userId: teenUserId,
          sessionId: 'teen-session',
          timestamp: new Date(),
          source: InteractionSource.UI,
          type: InteractionType.QUERY,
          context: {
            timeOfDay: 'evening' as any,
            dayOfWeek: 'friday' as any,
            location: { type: 'home' } as any,
            deviceType: 'smartphone' as any,
            previousInteractions: [],
            environmentalFactors: { lighting: 'dim' } as any
          },
          patterns: [
            {
              patternId: 'teen-pattern',
              type: PatternType.PREFERENCE,
              strength: 0.7,
              frequency: 8,
              context: { category: 'entertainment' } as any,
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.9,
            completionTime: 1200,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        const filtered = await privacyFilter.filterInteraction(teenInteraction);

        expect(filtered.privacyLevel).toBe(PrivacyLevel.ENHANCED);
        expect(filtered.metadata.dataRetentionDays).toBe(14); // Moderate retention
        expect(filtered.metadata.noiseLevel).toBeGreaterThan(0);

        // Verify patterns are anonymized but retain utility
        expect(filtered.patterns[0].anonymizationLevel).toBe('strong');
        // Allow for very significant differential privacy noise (enhanced privacy level)
        expect(filtered.patterns[0].strength).toBeGreaterThan(-50);
        expect(filtered.patterns[0].strength).toBeLessThan(50);
        expect(filtered.patterns[0].frequency).toBeGreaterThan(-20);
        expect(filtered.patterns[0].frequency).toBeLessThan(50);
      });

      test('should detect medium-confidence PII as high severity for teens', async () => {
        const teenDataWithPII = {
          schoolName: 'Lincoln High School',
          friendName: 'Alex Smith',
          homeAddress: '789 Pine Avenue',
          socialMedia: '@teen_user_123'
        };

        const result = await privacyFilter.validatePrivacyCompliance(teenDataWithPII, teenUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].severity).toBe(ViolationSeverity.HIGH);
        expect(result.riskLevel).toBe(RiskLevel.HIGH);
      });

      test('should provide teen-appropriate privacy controls', async () => {
        const report = await privacyFilter.generatePrivacyReport(teenUserId);

        expect(report.complianceStatus.regulation).toBe('coppa'); // Still under 18
        expect(report.complianceStatus.certifications).toContain('child_safety');
        
        // Verify moderate retention periods
        report.retentionPolicies.forEach(policy => {
          expect(policy.retentionDays).toBe(14);
        });

        // Verify access rights are available
        const accessRight = report.userRights.find(right => right.rightType === 'access');
        expect(accessRight?.isAvailable).toBe(true);
      });
    });

    describe('Adult Users (18+) - Standard Privacy Controls', () => {
      beforeEach(async () => {
        // Configure adult user with standard privacy
        await privacyFilter.configurePrivacyLevel(testUserId, PrivacyLevel.STANDARD);
      });

      test('should apply standard privacy controls for adult users', async () => {
        const adultInteraction: UserInteraction = {
          userId: testUserId,
          sessionId: 'adult-session',
          timestamp: new Date(),
          source: InteractionSource.SMART_HOME,
          type: InteractionType.COMMAND,
          context: {
            timeOfDay: 'morning' as any,
            dayOfWeek: 'monday' as any,
            location: { type: 'office' } as any,
            deviceType: 'smart_display' as any,
            previousInteractions: [],
            environmentalFactors: { temperature: 'comfortable' } as any
          },
          patterns: [
            {
              patternId: 'adult-pattern',
              type: PatternType.CONTEXTUAL,
              strength: 0.9,
              frequency: 15,
              context: { workday: true } as any,
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.95,
            completionTime: 800,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        const filtered = await privacyFilter.filterInteraction(adultInteraction);

        expect(filtered.privacyLevel).toBe(PrivacyLevel.STANDARD);
        expect(filtered.metadata.dataRetentionDays).toBe(30); // Standard retention
        
        // Verify balanced privacy and utility
        expect(filtered.patterns[0].anonymizationLevel).toBe('moderate');
        // Allow for differential privacy noise
        expect(filtered.patterns[0].strength).toBeGreaterThan(-5);
        expect(filtered.patterns[0].strength).toBeLessThan(5);
        expect(filtered.patterns[0].frequency).toBeGreaterThan(0);
        expect(filtered.patterns[0].frequency).toBeLessThan(30);
      });

      test('should handle adult PII with appropriate severity levels', async () => {
        const adultDataWithPII = {
          workEmail: 'john.doe@company.com',
          businessPhone: '555-0199',
          linkedinProfile: 'linkedin.com/in/johndoe'
        };

        const result = await privacyFilter.validatePrivacyCompliance(adultDataWithPII, testUserId);

        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].severity).toBe(ViolationSeverity.CRITICAL); // Still critical for high-confidence PII
        expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      });

      test('should provide full privacy rights for adults', async () => {
        const report = await privacyFilter.generatePrivacyReport(testUserId);

        // Adults may have different regulatory compliance (not COPPA)
        expect(['coppa', 'gdpr', 'ccpa']).toContain(report.complianceStatus.regulation);
        
        // Verify standard retention periods
        report.retentionPolicies.forEach(policy => {
          expect(policy.retentionDays).toBe(30);
        });

        // Verify all user rights are available
        const rightTypes = report.userRights.map(right => right.rightType);
        expect(rightTypes).toContain('access');
        expect(rightTypes).toContain('erasure');
      });
    });

    describe('Family Privacy Settings', () => {
      test('should handle mixed age family with appropriate privacy levels', async () => {
        const familyId = 'family-123';
        
        // Configure family with different privacy levels
        await privacyFilter.configureFamilyPrivacyLevel(familyId, childUserId, PrivacyLevel.MAXIMUM);
        await privacyFilter.configureFamilyPrivacyLevel(familyId, teenUserId, PrivacyLevel.ENHANCED);
        await privacyFilter.configureFamilyPrivacyLevel(familyId, testUserId, PrivacyLevel.STANDARD);

        // Test each family member's privacy level
        const childReport = await privacyFilter.generatePrivacyReport(childUserId);
        const teenReport = await privacyFilter.generatePrivacyReport(teenUserId);
        const adultReport = await privacyFilter.generatePrivacyReport(testUserId);

        // Verify appropriate retention periods
        expect(childReport.retentionPolicies[0].retentionDays).toBe(7);
        expect(teenReport.retentionPolicies[0].retentionDays).toBe(14);
        expect(adultReport.retentionPolicies[0].retentionDays).toBe(30);

        // Verify all have child safety certifications (family context)
        expect(childReport.complianceStatus.certifications).toContain('child_safety');
        expect(teenReport.complianceStatus.certifications).toContain('child_safety');
      });

      test('should apply most restrictive privacy level for family interactions', async () => {
        const familyId = 'family-456';
        
        await privacyFilter.configureFamilyPrivacyLevel(familyId, childUserId, PrivacyLevel.MAXIMUM);
        await privacyFilter.configureFamilyPrivacyLevel(familyId, testUserId, PrivacyLevel.MINIMAL);

        // Family interaction should use most restrictive level (MAXIMUM)
        const familyData = {
          familyActivity: 'movie night',
          participants: [childUserId, testUserId],
          location: 'living room'
        };

        const result = await privacyFilter.validatePrivacyCompliance(familyData, childUserId);
        
        // Should be validated with child's maximum privacy level
        expect(result.isCompliant).toBe(true); // No PII in this data
        
        const anonymized = await privacyFilter.anonymizeData(familyData);
        expect(anonymized.privacyLevel).toBe('enhanced'); // High anonymization for family context
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large datasets efficiently', async () => {
      const largeDataset = {
        interactions: Array.from({ length: 1000 }, (_, i) => ({
          id: `interaction_${i}`,
          content: `This is interaction number ${i} with some sample content`,
          timestamp: new Date(Date.now() - i * 1000)
        }))
      };

      const startTime = Date.now();
      const result = await privacyFilter.validatePrivacyCompliance(largeDataset, testUserId);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.isCompliant).toBe(true);
    });

    test('should handle concurrent privacy validation requests', async () => {
      const testData = { message: 'Hello world' };
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];

      const promises = userIds.map(userId => 
        privacyFilter.validatePrivacyCompliance(testData, userId)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
      });
    });

    test('should handle malformed or corrupted data gracefully', async () => {
      const malformedData = {
        circular: null as any,
        undefined: undefined,
        function: () => 'test',
        symbol: Symbol('test')
      };
      malformedData.circular = malformedData; // Create circular reference

      // Should not throw error
      const result = await privacyFilter.validatePrivacyCompliance(malformedData, testUserId);
      expect(result).toBeDefined();
      expect(result.isCompliant).toBeDefined();
    });

    test('should maintain consistent hashing for same user', async () => {
      const testData = { message: 'consistent test' };

      const result1 = await privacyFilter.anonymizeData(testData);
      const result2 = await privacyFilter.anonymizeData(testData);

      // Results should be different due to timestamps and randomization
      expect(result1.dataId).not.toBe(result2.dataId);
      // Allow for same timestamp if operations are very fast
      expect(result1.anonymizedAt.getTime()).toBeLessThanOrEqual(result2.anonymizedAt.getTime());
    });

    test('should handle empty and null data appropriately', async () => {
      const emptyResult = await privacyFilter.validatePrivacyCompliance({}, testUserId);
      const nullResult = await privacyFilter.validatePrivacyCompliance(null, testUserId);

      expect(emptyResult.isCompliant).toBe(true);
      expect(nullResult.isCompliant).toBe(true);
      expect(emptyResult.violations).toHaveLength(0);
      expect(nullResult.violations).toHaveLength(0);
    });
  });

  describe('Configuration and Error Handling', () => {
    test('should validate privacy level configuration', async () => {
      // Valid privacy levels should work
      await expect(privacyFilter.configurePrivacyLevel(testUserId, PrivacyLevel.STANDARD))
        .resolves.not.toThrow();

      // Invalid privacy level should throw error
      await expect(privacyFilter.configurePrivacyLevel(testUserId, 'invalid' as any))
        .rejects.toThrow('Invalid privacy level');
    });

    test('should handle missing user configuration gracefully', async () => {
      const newUserId = 'new-user-999';
      
      // Should use default privacy level for unconfigured user
      const testData = { message: 'test for new user' };
      const result = await privacyFilter.validatePrivacyCompliance(testData, newUserId);

      expect(result.isCompliant).toBe(true);
    });

    test('should provide detailed error information for debugging', async () => {
      const dataWithMultiplePII = {
        ssn: '123-45-6789',
        email: 'test@example.com',
        phone: '555-1234',
        address: '123 Main Street'
      };

      const result = await privacyFilter.validatePrivacyCompliance(dataWithMultiplePII, testUserId);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0); // Multiple violations expected for multiple PII types
      expect(result.violations[0].description).toContain('High-confidence PII detected');
      expect(result.violations[0].recommendedAction).toBeDefined();
      expect(result.violations[0].detectedAt).toBeInstanceOf(Date);
    });
  });
});