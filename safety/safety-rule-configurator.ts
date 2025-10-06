/**
 * Safety Rule Configurator - Manages safety rules and configuration
 * Safety: Provides flexible rule management with validation and testing
 * Performance: Efficient rule compilation and caching for real-time validation
 */

import { EventEmitter } from 'events';
import { 
  SafetyRule, 
  SafetyRuleSet, 
  SafetyConfiguration, 
  AgeGroup,
  AgeGroupSafetySettings 
} from '../models/safety-models';

export interface SafetyRuleConfigurator {
  createRule(rule: Omit<SafetyRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<SafetyRule>;
  updateRule(ruleId: string, updates: Partial<SafetyRule>): Promise<SafetyRule>;
  deleteRule(ruleId: string): Promise<void>;
  getRules(filters?: RuleFilters): Promise<SafetyRule[]>;
  testRule(rule: SafetyRule, testContent: string[]): Promise<RuleTestResult>;
  createRuleSet(name: string, rules: SafetyRule[]): Promise<SafetyRuleSet>;
  updateRuleSet(ruleSetId: string, updates: Partial<SafetyRuleSet>): Promise<SafetyRuleSet>;
  activateRuleSet(ruleSetId: string): Promise<void>;
  exportConfiguration(): Promise<SafetyConfiguration>;
  importConfiguration(config: SafetyConfiguration): Promise<void>;
  validateConfiguration(config: SafetyConfiguration): Promise<ConfigurationValidationResult>;
}

export interface RuleFilters {
  ageGroups?: AgeGroup[];
  contexts?: string[];
  severity?: ('low' | 'medium' | 'high' | 'critical')[];
  enabled?: boolean;
  searchTerm?: string;
}

export interface RuleTestResult {
  ruleId: string;
  testResults: Array<{
    content: string;
    matched: boolean;
    confidence: number;
    matchedPattern?: string;
    suggestedAction: 'block' | 'warn' | 'sanitize' | 'flag';
  }>;
  overallAccuracy: number;
  falsePositives: number;
  falseNegatives: number;
  recommendations: string[];
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: ConfigurationWarning[];
  suggestions: ConfigurationSuggestion[];
}

export interface ConfigurationError {
  type: 'missing_required' | 'invalid_format' | 'conflicting_rules' | 'security_risk';
  message: string;
  field?: string;
  ruleId?: string;
}

export interface ConfigurationWarning {
  type: 'performance_impact' | 'overly_restrictive' | 'deprecated_pattern';
  message: string;
  field?: string;
  ruleId?: string;
}

export interface ConfigurationSuggestion {
  type: 'optimization' | 'best_practice' | 'security_enhancement';
  message: string;
  action?: string;
}

export class SafetyRuleConfiguratorEngine extends EventEmitter implements SafetyRuleConfigurator {
  private rules: Map<string, SafetyRule> = new Map();
  private ruleSets: Map<string, SafetyRuleSet> = new Map();
  private activeRuleSetId: string | null = null;
  private configuration: SafetyConfiguration;
  private compiledPatterns: Map<string, RegExp> = new Map();

  constructor(initialConfiguration: SafetyConfiguration) {
    super();
    this.configuration = initialConfiguration;
    this.initializeDefaultRules();
    this.compilePatterns();
  }

  /**
   * Create a new safety rule
   */
  async createRule(rule: Omit<SafetyRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<SafetyRule> {
    try {
      const newRule: SafetyRule = {
        ...rule,
        id: this.generateId('rule'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate the rule
      const validation = await this.validateRule(newRule);
      if (!validation.isValid) {
        throw new Error(`Invalid rule: ${validation.errors.join(', ')}`);
      }

      this.rules.set(newRule.id, newRule);
      this.compileRulePattern(newRule);

      this.emit('rule_created', newRule);
      return newRule;

    } catch (error) {
      this.emit('rule_creation_error', { rule, error });
      throw new Error(`Failed to create rule: ${error.message}`);
    }
  }

  /**
   * Update an existing safety rule
   */
  async updateRule(ruleId: string, updates: Partial<SafetyRule>): Promise<SafetyRule> {
    try {
      const existingRule = this.rules.get(ruleId);
      if (!existingRule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      const updatedRule: SafetyRule = {
        ...existingRule,
        ...updates,
        id: ruleId, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      // Validate the updated rule
      const validation = await this.validateRule(updatedRule);
      if (!validation.isValid) {
        throw new Error(`Invalid rule update: ${validation.errors.join(', ')}`);
      }

      this.rules.set(ruleId, updatedRule);
      this.compileRulePattern(updatedRule);

      this.emit('rule_updated', { ruleId, updates, rule: updatedRule });
      return updatedRule;

    } catch (error) {
      this.emit('rule_update_error', { ruleId, updates, error });
      throw error;
    }
  }

  /**
   * Delete a safety rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      this.rules.delete(ruleId);
      this.compiledPatterns.delete(ruleId);

      this.emit('rule_deleted', { ruleId, rule });

    } catch (error) {
      this.emit('rule_deletion_error', { ruleId, error });
      throw error;
    }
  }

  /**
   * Get rules with optional filtering
   */
  async getRules(filters?: RuleFilters): Promise<SafetyRule[]> {
    try {
      let rules = Array.from(this.rules.values());

      if (filters) {
        if (filters.ageGroups) {
          rules = rules.filter(rule => 
            rule.ageGroups.some(age => filters.ageGroups!.includes(age))
          );
        }

        if (filters.contexts) {
          rules = rules.filter(rule => 
            rule.contexts.some(context => filters.contexts!.includes(context))
          );
        }

        if (filters.severity) {
          rules = rules.filter(rule => filters.severity!.includes(rule.severity));
        }

        if (filters.enabled !== undefined) {
          rules = rules.filter(rule => rule.enabled === filters.enabled);
        }

        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          rules = rules.filter(rule => 
            rule.name.toLowerCase().includes(searchLower) ||
            rule.description.toLowerCase().includes(searchLower) ||
            rule.pattern.toLowerCase().includes(searchLower)
          );
        }
      }

      return rules.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    } catch (error) {
      this.emit('rules_retrieval_error', { filters, error });
      return [];
    }
  }

  /**
   * Test a rule against sample content
   */
  async testRule(rule: SafetyRule, testContent: string[]): Promise<RuleTestResult> {
    try {
      const pattern = this.compileRulePattern(rule);
      const testResults = [];
      let truePositives = 0;
      let falsePositives = 0;
      let falseNegatives = 0;

      for (const content of testContent) {
        const matched = pattern.test(content.toLowerCase());
        const confidence = matched ? 0.9 : 0.1; // Simplified confidence calculation

        testResults.push({
          content,
          matched,
          confidence,
          matchedPattern: matched ? rule.pattern : undefined,
          suggestedAction: rule.action
        });

        // For testing purposes, assume content with certain keywords should match
        const shouldMatch = this.shouldContentMatch(content, rule);
        if (matched && shouldMatch) truePositives++;
        if (matched && !shouldMatch) falsePositives++;
        if (!matched && shouldMatch) falseNegatives++;
      }

      const totalTests = testContent.length;
      const accuracy = totalTests > 0 ? (truePositives + (totalTests - truePositives - falsePositives - falseNegatives)) / totalTests : 0;

      const recommendations = this.generateRuleRecommendations(rule, testResults);

      const result: RuleTestResult = {
        ruleId: rule.id,
        testResults,
        overallAccuracy: accuracy,
        falsePositives,
        falseNegatives,
        recommendations
      };

      this.emit('rule_tested', { rule, testContent, result });
      return result;

    } catch (error) {
      this.emit('rule_test_error', { rule, testContent, error });
      throw new Error(`Failed to test rule: ${error.message}`);
    }
  }

  /**
   * Create a new rule set
   */
  async createRuleSet(name: string, rules: SafetyRule[]): Promise<SafetyRuleSet> {
    try {
      const ruleSet: SafetyRuleSet = {
        id: this.generateId('ruleset'),
        name,
        version: '1.0.0',
        rules: [...rules],
        ageGroupSettings: { ...this.configuration.ageGroupSettings },
        lastUpdated: new Date(),
        checksum: this.calculateChecksum(rules)
      };

      this.ruleSets.set(ruleSet.id, ruleSet);

      this.emit('rule_set_created', ruleSet);
      return ruleSet;

    } catch (error) {
      this.emit('rule_set_creation_error', { name, rules, error });
      throw new Error(`Failed to create rule set: ${error.message}`);
    }
  }

  /**
   * Update an existing rule set
   */
  async updateRuleSet(ruleSetId: string, updates: Partial<SafetyRuleSet>): Promise<SafetyRuleSet> {
    try {
      const existingRuleSet = this.ruleSets.get(ruleSetId);
      if (!existingRuleSet) {
        throw new Error(`Rule set not found: ${ruleSetId}`);
      }

      const updatedRuleSet: SafetyRuleSet = {
        ...existingRuleSet,
        ...updates,
        id: ruleSetId,
        lastUpdated: new Date(),
        checksum: updates.rules ? this.calculateChecksum(updates.rules) : existingRuleSet.checksum
      };

      this.ruleSets.set(ruleSetId, updatedRuleSet);

      this.emit('rule_set_updated', { ruleSetId, updates, ruleSet: updatedRuleSet });
      return updatedRuleSet;

    } catch (error) {
      this.emit('rule_set_update_error', { ruleSetId, updates, error });
      throw error;
    }
  }

  /**
   * Activate a rule set
   */
  async activateRuleSet(ruleSetId: string): Promise<void> {
    try {
      const ruleSet = this.ruleSets.get(ruleSetId);
      if (!ruleSet) {
        throw new Error(`Rule set not found: ${ruleSetId}`);
      }

      this.activeRuleSetId = ruleSetId;

      // Update active rules
      this.rules.clear();
      for (const rule of ruleSet.rules) {
        this.rules.set(rule.id, rule);
      }

      // Update configuration
      this.configuration.ageGroupSettings = { ...ruleSet.ageGroupSettings };
      this.configuration.customRules = [...ruleSet.rules];

      // Recompile patterns
      this.compilePatterns();

      this.emit('rule_set_activated', { ruleSetId, ruleSet });

    } catch (error) {
      this.emit('rule_set_activation_error', { ruleSetId, error });
      throw error;
    }
  }

  /**
   * Export current configuration
   */
  async exportConfiguration(): Promise<SafetyConfiguration> {
    try {
      const exportConfig: SafetyConfiguration = {
        ...this.configuration,
        customRules: Array.from(this.rules.values())
      };

      this.emit('configuration_exported', exportConfig);
      return exportConfig;

    } catch (error) {
      this.emit('configuration_export_error', { error });
      throw new Error(`Failed to export configuration: ${error.message}`);
    }
  }

  /**
   * Import configuration
   */
  async importConfiguration(config: SafetyConfiguration): Promise<void> {
    try {
      // Validate configuration first
      const validation = await this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Backup current configuration
      const backup = await this.exportConfiguration();

      try {
        // Apply new configuration
        this.configuration = { ...config };
        
        // Update rules
        this.rules.clear();
        for (const rule of config.customRules) {
          this.rules.set(rule.id, rule);
        }

        // Recompile patterns
        this.compilePatterns();

        this.emit('configuration_imported', { config, backup });

      } catch (applyError) {
        // Restore backup on failure
        await this.importConfiguration(backup);
        throw applyError;
      }

    } catch (error) {
      this.emit('configuration_import_error', { config, error });
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(config: SafetyConfiguration): Promise<ConfigurationValidationResult> {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];
    const suggestions: ConfigurationSuggestion[] = [];

    try {
      // Check required fields
      if (!config.globalSettings) {
        errors.push({
          type: 'missing_required',
          message: 'Global settings are required',
          field: 'globalSettings'
        });
      }

      if (!config.ageGroupSettings) {
        errors.push({
          type: 'missing_required',
          message: 'Age group settings are required',
          field: 'ageGroupSettings'
        });
      }

      // Validate age group settings
      for (const [ageGroup, settings] of Object.entries(config.ageGroupSettings)) {
        if (settings.maxComplexity < 0 || settings.maxComplexity > 100) {
          errors.push({
            type: 'invalid_format',
            message: `Invalid complexity level for ${ageGroup}: must be between 0 and 100`,
            field: `ageGroupSettings.${ageGroup}.maxComplexity`
          });
        }

        if (settings.blockedTopics.length === 0 && settings.strictMode) {
          warnings.push({
            type: 'overly_restrictive',
            message: `No blocked topics defined for ${ageGroup} in strict mode`,
            field: `ageGroupSettings.${ageGroup}.blockedTopics`
          });
        }
      }

      // Validate custom rules
      for (const rule of config.customRules) {
        const ruleValidation = await this.validateRule(rule);
        if (!ruleValidation.isValid) {
          errors.push({
            type: 'invalid_format',
            message: `Invalid rule ${rule.name}: ${ruleValidation.errors.join(', ')}`,
            ruleId: rule.id
          });
        }
      }

      // Check for conflicting rules
      const conflicts = this.findRuleConflicts(config.customRules);
      for (const conflict of conflicts) {
        warnings.push({
          type: 'conflicting_rules',
          message: conflict.message,
          ruleId: conflict.ruleId
        });
      }

      // Performance suggestions
      if (config.customRules.length > 100) {
        suggestions.push({
          type: 'performance_impact',
          message: 'Large number of custom rules may impact performance',
          action: 'Consider consolidating similar rules or using rule sets'
        });
      }

      // Security suggestions
      if (!config.auditSettings.encryptLogs) {
        suggestions.push({
          type: 'security_enhancement',
          message: 'Consider enabling log encryption for better security',
          action: 'Set auditSettings.encryptLogs to true'
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      errors.push({
        type: 'invalid_format',
        message: `Configuration validation failed: ${error.message}`
      });

      return {
        isValid: false,
        errors,
        warnings,
        suggestions
      };
    }
  }

  /**
   * Validate individual rule
   */
  private async validateRule(rule: SafetyRule): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check required fields
    if (!rule.name || rule.name.trim().length === 0) {
      errors.push('Rule name is required');
    }

    if (!rule.pattern || rule.pattern.trim().length === 0) {
      errors.push('Rule pattern is required');
    }

    if (!rule.ageGroups || rule.ageGroups.length === 0) {
      errors.push('At least one age group must be specified');
    }

    // Validate pattern syntax
    try {
      new RegExp(rule.pattern, 'gi');
    } catch (regexError) {
      errors.push(`Invalid regex pattern: ${regexError.message}`);
    }

    // Check for security risks
    if (rule.pattern.includes('.*.*') || rule.pattern.includes('.+.+')) {
      errors.push('Pattern may cause performance issues (catastrophic backtracking)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Compile rule pattern to RegExp
   */
  private compileRulePattern(rule: SafetyRule): RegExp {
    try {
      const pattern = new RegExp(rule.pattern, 'gi');
      this.compiledPatterns.set(rule.id, pattern);
      return pattern;
    } catch (error) {
      // Fallback to literal string matching
      const escapedPattern = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escapedPattern, 'gi');
      this.compiledPatterns.set(rule.id, pattern);
      return pattern;
    }
  }

  /**
   * Compile all patterns for performance
   */
  private compilePatterns(): void {
    this.compiledPatterns.clear();
    for (const rule of this.rules.values()) {
      this.compileRulePattern(rule);
    }
  }

  /**
   * Determine if content should match rule (for testing)
   */
  private shouldContentMatch(content: string, rule: SafetyRule): boolean {
    // Simplified logic for testing - in production, this would be more sophisticated
    const keywords = rule.pattern.toLowerCase().split('|');
    return keywords.some(keyword => content.toLowerCase().includes(keyword.replace(/[^\w\s]/g, '')));
  }

  /**
   * Generate recommendations for rule improvement
   */
  private generateRuleRecommendations(rule: SafetyRule, testResults: RuleTestResult['testResults']): string[] {
    const recommendations: string[] = [];

    const falsePositiveRate = testResults.filter(r => r.matched && !this.shouldContentMatch(r.content, rule)).length / testResults.length;
    const falseNegativeRate = testResults.filter(r => !r.matched && this.shouldContentMatch(r.content, rule)).length / testResults.length;

    if (falsePositiveRate > 0.2) {
      recommendations.push('Consider making the pattern more specific to reduce false positives');
    }

    if (falseNegativeRate > 0.2) {
      recommendations.push('Consider making the pattern more inclusive to catch more violations');
    }

    if (rule.pattern.length > 100) {
      recommendations.push('Consider breaking complex patterns into multiple simpler rules');
    }

    return recommendations;
  }

  /**
   * Find conflicting rules
   */
  private findRuleConflicts(rules: SafetyRule[]): Array<{ ruleId: string; message: string }> {
    const conflicts: Array<{ ruleId: string; message: string }> = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        // Check for overlapping patterns with different actions
        if (rule1.pattern === rule2.pattern && rule1.action !== rule2.action) {
          conflicts.push({
            ruleId: rule1.id,
            message: `Rule conflicts with ${rule2.name} - same pattern but different actions`
          });
        }

        // Check for contradictory age group settings
        const commonAgeGroups = rule1.ageGroups.filter(age => rule2.ageGroups.includes(age));
        if (commonAgeGroups.length > 0 && rule1.action === 'block' && rule2.action === 'allow') {
          conflicts.push({
            ruleId: rule1.id,
            message: `Rule may conflict with ${rule2.name} for age groups: ${commonAgeGroups.join(', ')}`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Calculate checksum for rules
   */
  private calculateChecksum(rules: SafetyRule[]): string {
    const content = rules.map(r => `${r.id}:${r.pattern}:${r.action}`).join('|');
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Initialize default safety rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: SafetyRule[] = [
      {
        id: 'profanity_basic',
        name: 'Basic Profanity Filter',
        description: 'Blocks common profanity and inappropriate language',
        pattern: '\\b(damn|hell|crap|stupid|idiot)\\b',
        action: 'sanitize',
        severity: 'medium',
        ageGroups: ['child', 'teen'],
        contexts: ['voice_input', 'text_output'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'violence_content',
        name: 'Violence Content Filter',
        description: 'Blocks violent content and aggressive language',
        pattern: '\\b(kill|murder|fight|hurt|weapon|gun|knife|blood|violence)\\b',
        action: 'block',
        severity: 'high',
        ageGroups: ['child'],
        contexts: ['voice_input', 'text_output'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'adult_content',
        name: 'Adult Content Filter',
        description: 'Blocks adult and mature content',
        pattern: '\\b(sex|sexual|adult|mature|explicit|porn)\\b',
        action: 'block',
        severity: 'high',
        ageGroups: ['child', 'teen'],
        contexts: ['voice_input', 'text_output'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}