/**
 * Parental Control System Tests
 * Safety: Test parental control mechanisms and override functionality
 * Requirements: 4.1, 4.2, 4.3 - Parental control and safety rule configuration testing
 */

import { ContentSafetyFilterEngine } from './content-safety-filter';
import { SafetyAuditLoggerEngine } from './safety-audit-logger';
import { SafetyConfiguration } from '../models/safety-models';
import { SafetyRules, AgeGroup } from './interfaces';

describe('Parental Control System', () => {
  let safetyFilter: ContentSafetyFilterEngine;
  let auditLogger: SafetyAuditLoggerEngine;
  let mockConfiguration: SafetyConfiguration;

  beforeEach(() => {
    mockConfiguration = {
      globalSettings: {
        enabled: true,
        strictMode: true,
        defaultAction: 'blocked',
        allowParentalOverrides: true,
        requireParentalApproval: ['high_risk_content', 'blocked_content'],
        emergencyBypassEnabled: false,
        lo