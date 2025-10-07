/**
 * System Integration Tests for Fine-Tuning System
 * 
 * End-to-end integration tests that validate the complete fine-tuning system
 * working together with all components and real-world scenarios.
 */

import { 
  SimpleFineTuningIntegration,
  FineTuningConfigFactory,
  RuntimeConfigDetector,
  LLMEnhancedLearningEngine
} from './index';

describe('Fine-Tuning System Integration Tests', () => {
  let integration: SimpleFineTuningIntegration;
  let learningEngine: LLMEnhancedLearningEngine;

  beforeAll(async () => {
    // Initialize with real components (using mocks for external dependencies)
    const mockSafetyValidator = {
      validateContent: jest.fn().mockResolvedValue({
        isValid: true,
        violationType: null,
        severity: 'low',
        reason: '',
        affectedMembers: [],
        remediation: ''
      })
    };

    const mockPrivacyFilter = {
      filterInteraction: jest.fn().mockResolvedValue({
        userId: 'hashed-user-id',
        patterns: [{ type: 'preference', value: 'educational_content' }],
        context: { timeOfDay: 'morning' },
        metadata: { source: 'voice' },
        privacyLevel: 'high'
      })
    };

    learningEngine = new LLMEnhancedLearningEngine(
      {
        provider: 'local',
        modelPath: '/test/model',
        safetyFiltering: true,
        privacyPreserving: true
      },
      mockSafetyValidator as any,
      mockPrivacyFilter as any
    );

    const config = await RuntimeConfigDetector.detectOptimalConfig();
    integration = new SimpleFineTuningIntegration(config, learningEngine);
  });

  describe('Complete System Workflow', () => {
    it('should handle complete family onboarding and recommendation workflow', async () => {
      // Step 1: Initialize the system
      await integration.initialize();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics).toBeDefined();

      // Step 2: Attempt to create model with insufficient data
      let success = await integration.createOrUpdateFamilyModel('new-family');
      expect(success).toBe(false); // Should fail due to insufficient interactions

      // Step 3: Generate fallback recommendations
      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home', 'weekend']
      };

      let recommendations = await integration.generatePersonalizedRecommendations(
        'new-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Step 4: Simulate family usage over time (mock sufficient interactions)
      // This would normally happen over weeks/months of real usage
      
      // Step 5: Create model with sufficient data
      success = await integration.createOrUpdateFamilyModel('new-family');
      expect(success).toBe(true);

      // Step 6: Generate personalized recommendations
      recommendations = await integration.generatePersonalizedRecommendations(
        'new-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should now include family-specific personalization
      const hasPersonalization = recommendations.some(rec => 
        rec.includes('🌅') || rec.includes('✨') || rec.includes('Personalized')
      );
      expect(hasPersonalization).toBe(true);

      // Step 7: Validate the model
      const validationResults = await integration.validateAllFamilyModels();
      expect(validationResults['new-family']).toBe(true);

      // Step 8: Test member-specific recommendations
      const memberRecommendations = await integration.generatePersonalizedRecommendations(
        'new-family',
        context,
        'child1'
      );

      expect(memberRecommendations).toBeDefined();
      expect(memberRecommendations.length).toBeGreaterThan(0);
      
      // Should include member-specific content
      const hasMemberSpecific = memberRecommendations.some(rec => 
        rec.includes('👤') || rec.includes('child1')
      );
      expect(hasMemberSpecific).toBe(true);
    });

    it('should handle multiple families with different preferences', async () => {
      await integration.initialize();

      const families = [
        {
          id: 'tech-family',
          context: {
            timeOfDay: 'evening',
            dayOfWeek: 'friday',
            currentActivity: 'learning',
            familyMembers: ['tech-parent', 'tech-child'],
            environmentalFactors: ['home', 'tech-focused']
          }
        },
        {
          id: 'outdoor-family',
          context: {
            timeOfDay: 'afternoon',
            dayOfWeek: 'saturday',
            currentActivity: 'play',
            familyMembers: ['outdoor-parent', 'outdoor-child'],
            environmentalFactors: ['home', 'nature-loving']
          }
        },
        {
          id: 'creative-family',
          context: {
            timeOfDay: 'morning',
            dayOfWeek: 'sunday',
            currentActivity: 'creative',
            familyMembers: ['creative-parent', 'creative-child'],
            environmentalFactors: ['home', 'artistic']
          }
        }
      ];

      // Create models for each family
      for (const family of families) {
        const success = await integration.createOrUpdateFamilyModel(family.id);
        expect(success).toBe(true);
      }

      // Generate recommendations for each family
      const allRecommendations = [];
      
      for (const family of families) {
        const recommendations = await integration.generatePersonalizedRecommendations(
          family.id,
          family.context
        );
        
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
        
        allRecommendations.push({
          familyId: family.id,
          recommendations
        });
      }

      // Verify that different families get different recommendations
      const techRecs = allRecommendations.find(r => r.familyId === 'tech-family')?.recommendations || [];
      const outdoorRecs = allRecommendations.find(r => r.familyId === 'outdoor-family')?.recommendations || [];
      const creativeRecs = allRecommendations.find(r => r.familyId === 'creative-family')?.recommendations || [];

      // Each family should have unique personalized content
      expect(techRecs).not.toEqual(outdoorRecs);
      expect(outdoorRecs).not.toEqual(creativeRecs);
      expect(creativeRecs).not.toEqual(techRecs);

      // Validate all models
      const validationResults = await integration.validateAllFamilyModels();
      
      for (const family of families) {
        expect(validationResults[family.id]).toBe(true);
      }
    });
  });

  describe('Real-World Scenario Testing', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should handle morning routine recommendations', async () => {
      const morningContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'tuesday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1', 'child1', 'child2'],
        environmentalFactors: ['home', 'school_day', 'rushed']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'morning-family',
        morningContext
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should include morning-appropriate activities
      const morningAppropriate = recommendations.some(rec =>
        rec.toLowerCase().includes('morning') ||
        rec.toLowerCase().includes('breakfast') ||
        rec.toLowerCase().includes('start') ||
        rec.toLowerCase().includes('plan')
      );
      
      expect(morningAppropriate).toBe(true);
    });

    it('should handle homework time recommendations', async () => {
      const homeworkContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'wednesday',
        currentActivity: 'homework',
        familyMembers: ['child1'],
        environmentalFactors: ['home', 'school_day', 'focused']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'homework-family',
        homeworkContext
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should include homework-supportive activities
      const homeworkSupport = recommendations.some(rec =>
        rec.toLowerCase().includes('study') ||
        rec.toLowerCase().includes('homework') ||
        rec.toLowerCase().includes('focus') ||
        rec.toLowerCase().includes('quiet')
      );
      
      expect(homeworkSupport).toBe(true);
    });

    it('should handle weekend family time recommendations', async () => {
      const weekendContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'family_time',
        familyMembers: ['parent1', 'parent2', 'child1', 'child2'],
        environmentalFactors: ['home', 'weekend', 'relaxed', 'together']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'weekend-family',
        weekendContext
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should include family-oriented activities
      const familyOriented = recommendations.some(rec =>
        rec.toLowerCase().includes('family') ||
        rec.toLowerCase().includes('together') ||
        rec.toLowerCase().includes('everyone') ||
        rec.toLowerCase().includes('game')
      );
      
      expect(familyOriented).toBe(true);
    });

    it('should handle bedtime routine recommendations', async () => {
      const bedtimeContext = {
        timeOfDay: 'evening',
        dayOfWeek: 'sunday',
        currentActivity: 'bedtime_routine',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home', 'school_night', 'winding_down']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'bedtime-family',
        bedtimeContext
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should include calming, bedtime-appropriate activities
      const bedtimeAppropriate = recommendations.some(rec =>
        rec.toLowerCase().includes('bedtime') ||
        rec.toLowerCase().includes('read') ||
        rec.toLowerCase().includes('calm') ||
        rec.toLowerCase().includes('quiet')
      );
      
      expect(bedtimeAppropriate).toBe(true);
    });
  });

  describe('Safety and Child Protection Integration', () => {
    beforeEach(async () => {
      // Use child-safe configuration
      const childSafeConfig = FineTuningConfigFactory.getConfig('child-safe');
      const childSafeIntegration = new SimpleFineTuningIntegration(childSafeConfig, learningEngine);
      await childSafeIntegration.initialize();
      integration = childSafeIntegration;
    });

    it('should enforce child-safe recommendations for young children', async () => {
      const childContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child_age_5'],
        environmentalFactors: ['home', 'supervised']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'young-child-family',
        childContext,
        'child_age_5'
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify no inappropriate content
      const inappropriateTerms = [
        'violence', 'scary', 'adult', 'inappropriate', 'dangerous',
        'weapon', 'fight', 'hurt', 'blood', 'death'
      ];

      for (const rec of recommendations) {
        for (const term of inappropriateTerms) {
          expect(rec.toLowerCase()).not.toContain(term);
        }
      }

      // Should include age-appropriate activities
      const ageAppropriate = recommendations.some(rec =>
        rec.toLowerCase().includes('play') ||
        rec.toLowerCase().includes('creative') ||
        rec.toLowerCase().includes('learn') ||
        rec.toLowerCase().includes('fun')
      );
      
      expect(ageAppropriate).toBe(true);
    });

    it('should handle mixed-age family recommendations safely', async () => {
      const mixedAgeContext = {
        timeOfDay: 'evening',
        dayOfWeek: 'friday',
        currentActivity: 'family_time',
        familyMembers: ['parent1', 'teen_age_15', 'child_age_7'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'mixed-age-family',
        mixedAgeContext
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should be appropriate for the youngest family member
      const childSafeTerms = ['family', 'together', 'fun', 'game', 'activity'];
      const hasChildSafeContent = recommendations.some(rec =>
        childSafeTerms.some(term => rec.toLowerCase().includes(term))
      );
      
      expect(hasChildSafeContent).toBe(true);

      // Should not include teen-only content when young children are present
      const teenOnlyTerms = ['mature', 'advanced', 'complex', 'sophisticated'];
      const hasTeenOnlyContent = recommendations.some(rec =>
        teenOnlyTerms.some(term => rec.toLowerCase().includes(term))
      );
      
      // In mixed-age scenarios, should lean toward younger-appropriate content
      expect(hasTeenOnlyContent).toBe(false);
    });
  });

  describe('Performance and Scalability Integration', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should handle concurrent requests from multiple families', async () => {
      const familyContexts = Array(20).fill(null).map((_, i) => ({
        familyId: `concurrent-family-${i}`,
        context: {
          timeOfDay: 'morning',
          dayOfWeek: 'saturday',
          currentActivity: 'breakfast',
          familyMembers: [`parent-${i}`, `child-${i}`],
          environmentalFactors: ['home', 'weekend']
        }
      }));

      const startTime = Date.now();
      
      const promises = familyContexts.map(({ familyId, context }) =>
        integration.generatePersonalizedRecommendations(familyId, context)
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // All results should be valid
      results.forEach(recommendations => {
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      });
    });

    it('should maintain performance with multiple family models', async () => {
      // Create multiple family models
      const familyIds = Array(10).fill(null).map((_, i) => `perf-family-${i}`);
      
      for (const familyId of familyIds) {
        const success = await integration.createOrUpdateFamilyModel(familyId);
        expect(success).toBe(true);
      }

      // Verify all models are created
      const metrics = integration.getIntegrationMetrics();
      expect(metrics.totalFamilyModels).toBeGreaterThanOrEqual(familyIds.length);

      // Test recommendation generation performance
      const context = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home']
      };

      const startTime = Date.now();
      
      const promises = familyIds.map(familyId =>
        integration.generatePersonalizedRecommendations(familyId, context)
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(familyIds.length);
      expect(duration).toBeLessThan(5000); // Should be fast with existing models

      // Validate all models still pass safety checks
      const validationResults = await integration.validateAllFamilyModels();
      
      for (const familyId of familyIds) {
        expect(validationResults[familyId]).toBe(true);
      }
    });
  });

  describe('Error Recovery and Resilience Integration', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should recover gracefully from learning engine failures', async () => {
      // Create a failing learning engine
      const failingEngine = {
        getInteractionHistory: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        getFamilyProfile: jest.fn().mockRejectedValue(new Error('Profile service unavailable')),
        generateRecommendations: jest.fn().mockRejectedValue(new Error('Recommendation service down'))
      };

      const failingIntegration = new SimpleFineTuningIntegration(
        await RuntimeConfigDetector.detectOptimalConfig(),
        failingEngine as any
      );

      await failingIntegration.initialize();

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      // Should still provide recommendations despite failures
      const recommendations = await failingIntegration.generatePersonalizedRecommendations(
        'failing-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should be fallback recommendations
      const hasFallbackContent = recommendations.some(rec =>
        rec.toLowerCase().includes('family') ||
        rec.toLowerCase().includes('time') ||
        rec.toLowerCase().includes('activity')
      );
      
      expect(hasFallbackContent).toBe(true);
    });

    it('should handle partial system failures gracefully', async () => {
      // Simulate partial failure - some methods work, others don't
      const partiallyFailingEngine = {
        getInteractionHistory: jest.fn().mockResolvedValue([
          { userId: 'user1', timestamp: new Date(), patterns: [{ description: 'test' }] }
        ]),
        getFamilyProfile: jest.fn().mockRejectedValue(new Error('Profile service timeout')),
        generateRecommendations: jest.fn().mockResolvedValue(['Fallback recommendation'])
      };

      const partialIntegration = new SimpleFineTuningIntegration(
        await RuntimeConfigDetector.detectOptimalConfig(),
        partiallyFailingEngine as any
      );

      await partialIntegration.initialize();

      // Model creation should fail gracefully
      const modelSuccess = await partialIntegration.createOrUpdateFamilyModel('partial-fail-family');
      expect(modelSuccess).toBe(false);

      // But recommendations should still work
      const context = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await partialIntegration.generatePersonalizedRecommendations(
        'partial-fail-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Environment Integration', () => {
    it('should work correctly in different environment configurations', async () => {
      const environments = ['development', 'production', 'jetson', 'child-safe'] as const;
      
      for (const env of environments) {
        const config = FineTuningConfigFactory.getConfig(env);
        const envIntegration = new SimpleFineTuningIntegration(config, learningEngine);
        
        await envIntegration.initialize();
        
        const metrics = envIntegration.getIntegrationMetrics();
        expect(metrics).toBeDefined();
        
        const context = {
          timeOfDay: 'morning',
          dayOfWeek: 'saturday',
          currentActivity: 'breakfast',
          familyMembers: ['parent1'],
          environmentalFactors: ['home']
        };

        const recommendations = await envIntegration.generatePersonalizedRecommendations(
          `${env}-family`,
          context
        );

        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should adapt to hardware constraints automatically', async () => {
      // Test with constrained hardware simulation
      const constrainedConfig = FineTuningConfigFactory.getConfig('jetson');
      constrainedConfig.familyLLMConfig.fineTuningConfig.hardwareConstraints.maxMemoryUsage = 512; // Very limited

      const constrainedIntegration = new SimpleFineTuningIntegration(constrainedConfig, learningEngine);
      
      await constrainedIntegration.initialize();
      
      // Should still work with reduced capabilities
      const metrics = constrainedIntegration.getIntegrationMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.memoryUsage).toBeLessThanOrEqual(512);

      const context = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await constrainedIntegration.generatePersonalizedRecommendations(
        'constrained-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});