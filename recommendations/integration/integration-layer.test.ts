/**
 * Integration Tests for System Coordination
 * 
 * Tests avatar integration, voice pipeline coordination, scheduling system
 * integration, and smart home automation to ensure seamless recommendation
 * delivery and execution across all systems.
 */

import { 
  Recommendation, 
  IntegrationAction, 
  UserContext,
  UserFeedback,
  CalendarEvent,
  TimeRange
} from '../types';
import { RecommendationType } from '../enums';
import { integrationLayer } from './integration-layer';
import { avatarIntegration } from './avatar-integration';
import { voiceIntegration } from './voice-integration';
import { schedulingIntegration } from './scheduling-integration';
// Mock smart home integration
const smartHomeIntegration = {
  integrateWithSmartHome: jest.fn(),
  coordinateSmartDevices: jest.fn(),
  generateAutomationTriggers: jest.fn(),
  considerDeviceStatesInRecommendations: jest.fn(),
  validateSmartHomeSafety: jest.fn()
};
import { 
  PersonalityTraits, 
  EmotionType, 
  ResponseStyle 
} from '../../avatar/types';

// Mock external dependencies
jest.mock('../../avatar/personality-manager');
jest.mock('../../avatar/events');
jest.mock('../../avatar/voice-pipeline-integration');
jest.mock('../../learning/scheduling-integration');

describe('Integration Layer System Coordination', () => {
  let mockRecommendation: Recommendation;
  let mockUserContext: UserContext;
  let mockPersonality: PersonalityTraits;

  beforeEach(() => {
    // Setup mock recommendation
    mockRecommendation = {
      id: 'test-rec-001',
      type: RecommendationType.ACTIVITY,
      title: 'Family Game Night',
      description: 'Enjoy a fun board game session with the whole family',
      confidence: 0.85,
      reasoning: [
        'Family members are all available tonight',
        'Weather is not suitable for outdoor activities',
        'Previous family game nights were highly rated'
      ],
      actionable: true,
      integrationActions: [],
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      metadata: {
        generatedAt: new Date(),
        userId: 'user-123',
        contextId: 'context-456',
        engineVersion: 'test-1.0',
        safetyValidated: true,
        privacyCompliant: true
      }
    };

    // Setup mock user context
    mockUserContext = {
      userId: 'user-123',
      timestamp: new Date(),
      location: { type: 'home', indoorOutdoor: 'indoor' },
      activity: { interruptible: true },
      availability: { 
        freeTime: [
          {
            start: new Date(),
            end: new Date(Date.now() + 3 * 60 * 60 * 1000)
          }
        ], 
        busyTime: [], 
        flexibleTime: [], 
        energyLevel: { level: 'high', trend: 'stable' } 
      },
      mood: { detected: 'happy', confidence: 0.8, source: 'voice' },
      energy: { level: 'high', trend: 'stable' },
      social: { 
        familyMembersPresent: ['parent-1', 'child-1', 'child-2'], 
        socialSetting: 'family', 
        groupActivity: true 
      },
      environmental: { 
        weather: { temperature: 18, condition: 'rainy', humidity: 70, windSpeed: 15, uvIndex: 1 },
        timeOfDay: 'evening',
        season: 'fall',
        dayOfWeek: 'Friday',
        isHoliday: false
      },
      preferences: { 
        preferredActivities: [], 
        avoidedActivities: [], 
        timePreferences: [
          {
            timeOfDay: 'evening',
            preference: 'preferred',

          }
        ], 
        socialPreferences: { 
          familyTime: 'high', 
          aloneTime: 'low', 
          groupActivities: 'preferred' 
        } 
      }
    };

    // Setup mock personality
    mockPersonality = {
      friendliness: 8,
      enthusiasm: 9,
      supportiveness: 7,
      patience: 6,
      humor: 8,
      formality: 3,


    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Avatar Integration and Personalized Delivery', () => {
    it('should integrate recommendation with avatar personality traits', async () => {
      // Mock personality manager
      const mockPersonalityManager = require('../../avatar/personality-manager');
      mockPersonalityManager.personalityManager = {
        getActivePersonality: jest.fn().mockReturnValue(mockPersonality),
        generateResponseStyle: jest.fn().mockReturnValue({
          formality: 0.3,
          enthusiasm: 0.9,
          wordChoice: 'casual',
          responseLength: 'moderate'
        })
      };

      // Mock avatar event bus
      const mockAvatarEventBus = require('../../avatar/events');
      mockAvatarEventBus.avatarEventBus = {
        emit: jest.fn()
      };

      const integrationActions = await avatarIntegration.integrateWithAvatar(
        mockRecommendation, 
        'user-123'
      );

      expect(integrationActions).toHaveLength(4);
      
      // Verify emotional state update
      const emotionalStateAction = integrationActions.find(
        action => action.action === 'updateEmotionalState'
      );
      expect(emotionalStateAction).toBeDefined();
      expect(emotionalStateAction?.parameters.emotion).toBe(EmotionType.EXCITED);
      expect(emotionalStateAction?.parameters.intensity).toBeGreaterThan(0.5);

      // Verify response style configuration
      const responseStyleAction = integrationActions.find(
        action => action.action === 'setResponseStyle'
      );
      expect(responseStyleAction).toBeDefined();
      expect(responseStyleAction?.parameters.enthusiasm).toBe(0.9);
      expect(responseStyleAction?.parameters.formality).toBe(0.3);

      // Verify recommendation presentation
      const presentationAction = integrationActions.find(
        action => action.action === 'presentRecommendation'
      );
      expect(presentationAction).toBeDefined();
      expect(presentationAction?.parameters.title).toContain('Family Game Night');
      expect(presentationAction?.parameters.visualCues).toBeDefined();

      // Verify feedback collection is enabled
      const feedbackAction = integrationActions.find(
        action => action.action === 'enableFeedbackCollection'
      );
      expect(feedbackAction).toBeDefined();
      expect(feedbackAction?.parameters.recommendationId).toBe('test-rec-001');

      // Verify event emission
      expect(mockAvatarEventBus.avatarEventBus.emit).toHaveBeenCalledWith(
        'avatar:recommendation:integrated',
        expect.objectContaining({
          userId: 'user-123',
          recommendationId: 'test-rec-001',
          personalityTraits: mockPersonality
        })
      );
    });

    it('should generate personalized presentation based on personality', async () => {
      const mockPersonalityManager = require('../../avatar/personality-manager');
      mockPersonalityManager.personalityManager = {
        getActivePersonality: jest.fn().mockReturnValue(mockPersonality),
        generateResponseStyle: jest.fn().mockReturnValue({
          formality: 0.3,
          enthusiasm: 0.9,
          wordChoice: 'casual',
          responseLength: 'moderate'
        })
      };

      const presentation = await avatarIntegration.generatePersonalizedPresentation(
        mockRecommendation,
        mockPersonality,
        mockUserContext
      );

      expect(presentation.title).toContain('🌟'); // High enthusiasm adds excitement
      expect(presentation.description).toContain('perfect for you'); // High supportiveness
      expect(presentation.emotionalTone).toBe(EmotionType.EXCITED);
      expect(presentation.responseStyle.enthusiasm).toBe(0.9);
      expect(presentation.voiceCharacteristics.enthusiasm).toBe(0.9);
      expect(presentation.childSafeContent).toBe(true);
    });

    it('should adapt emotional tone based on user mood and personality', async () => {
      // Test with sad mood
      const sadMoodContext = {
        ...mockUserContext,
        mood: { detected: 'sad', confidence: 0.7, source: 'voice_analysis' }
      };

      const emotionalTone = await avatarIntegration.adaptEmotionalTone(
        mockRecommendation,
        'sad',
        mockPersonality
      );

      // High supportiveness should try to lift mood
      expect(emotionalTone).toBe(EmotionType.HAPPY);
    });

    it('should validate child-safe presentation content', async () => {
      const childSafePresentation = {
        title: 'Fun Family Game Night',
        description: 'Let\'s play some safe and fun board games together!',
        explanation: 'This is a great family activity that everyone can enjoy.',
        emotionalTone: EmotionType.HAPPY,
        responseStyle: {
          formality: 0.3,
          enthusiasm: 0.8,
          wordChoice: 'simple' as const,
          responseLength: 'moderate' as const
        },
        visualCues: [],
        voiceCharacteristics: {
          pitch: 0.2,
          speed: 1.0,
          enthusiasm: 0.8,
          formality: 0.3,
          pausePattern: 'natural' as const
        },
        interactionPrompts: ['What do you think?', 'Sounds fun, right?'],
        childSafeContent: true
      };

      const isValid = await avatarIntegration.validateChildSafePresentation(
        childSafePresentation,
        'child-user-123'
      );

      expect(isValid).toBe(true);
    });

    it('should create fallback actions when personality is unavailable', async () => {
      const mockPersonalityManager = require('../../avatar/personality-manager');
      mockPersonalityManager.personalityManager = {
        getActivePersonality: jest.fn().mockReturnValue(null)
      };

      const integrationActions = await avatarIntegration.integrateWithAvatar(
        mockRecommendation,
        'user-123'
      );

      expect(integrationActions).toHaveLength(1);
      expect(integrationActions[0].action).toBe('presentRecommendation');
      expect(integrationActions[0].parameters.emotionalTone).toBe(EmotionType.NEUTRAL);
    });
  });

  describe('Voice Pipeline Coordination', () => {
    it('should integrate recommendation with voice pipeline', async () => {
      const mockPersonalityManager = require('../../avatar/personality-manager');
      mockPersonalityManager.personalityManager = {
        getActivePersonality: jest.fn().mockReturnValue(mockPersonality)
      };

      const integrationActions = await voiceIntegration.integrateWithVoice(
        mockRecommendation,
        'user-123'
      );

      expect(integrationActions.length).toBeGreaterThan(0);

      // Verify voice characteristics are set
      const voiceCharAction = integrationActions.find(
        action => action.action === 'setVoiceCharacteristics'
      );
      expect(voiceCharAction).toBeDefined();
      expect(voiceCharAction?.parameters.characteristics).toBeDefined();

      // Verify recommendation is spoken
      const speakAction = integrationActions.find(
        action => action.action === 'speakRecommendation'
      );
      expect(speakAction).toBeDefined();
      expect(speakAction?.parameters.title).toBeDefined();
      expect(speakAction?.parameters.description).toBeDefined();

      // Verify voice feedback is enabled
      const feedbackAction = integrationActions.find(
        action => action.action === 'enableVoiceFeedback'
      );
      expect(feedbackAction).toBeDefined();
      expect(feedbackAction?.parameters.recommendationId).toBe('test-rec-001');
    });

    it('should generate natural language explanation for voice delivery', async () => {
      const explanation = await voiceIntegration.generateNaturalLanguageExplanation(
        mockRecommendation,
        mockPersonality
      );

      expect(explanation).toContain('excited'); // High enthusiasm
      expect(explanation.length).toBeLessThanOrEqual(300); // Voice length limit
      expect(explanation).not.toContain('because'); // Low formality replaces with 'cause
    });

    it('should process voice-based recommendation requests', async () => {
      const mockPersonalityManager = require('../../avatar/personality-manager');
      mockPersonalityManager.personalityManager = {
        getActivePersonality: jest.fn().mockReturnValue(mockPersonality)
      };

      const voiceResponse = await voiceIntegration.processVoiceRecommendationRequest(
        'user-123',
        'I want something fun to do with my family tonight',
        mockUserContext
      );

      expect(voiceResponse.spokenResponse).toContain('help');
      expect(voiceResponse.recommendations).toHaveLength(1);
      expect(voiceResponse.voiceCharacteristics).toBeDefined();
      expect(voiceResponse.followUpPrompts.length).toBeGreaterThan(0);
      expect(voiceResponse.interactionId).toBeDefined();
    });

    it('should collect and analyze voice feedback', async () => {
      const feedback = await voiceIntegration.collectVoiceFeedback(
        'test-rec-001',
        'user-123',
        'That sounds great! I love this idea!'
      );

      expect(feedback.recommendationId).toBe('test-rec-001');
      expect(feedback.userId).toBe('user-123');
      expect(feedback.rating).toBe(4); // Positive sentiment
      expect(feedback.accepted).toBe(true);
      expect(feedback.feedback).toBe('That sounds great! I love this idea!');
    });

    it('should adapt recommendation for voice context', async () => {
      const voiceContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        conversationHistory: [],
        currentEmotion: 'happy',
        backgroundNoise: 0.2,
        privacyLevel: 'private' as const,
        timeConstraints: {
          hasTimeLimit: true,
          maxDurationSeconds: 30,
          urgency: 'medium' as const
        },
        deviceContext: {
          deviceType: 'smart_speaker' as const,
          audioQuality: 'high' as const,
          isHandsFree: true
        }
      };

      const adaptedRecommendation = await voiceIntegration.adaptToVoiceContext(
        mockRecommendation,
        voiceContext
      );

      expect(adaptedRecommendation.spokenTitle).toBeDefined();
      expect(adaptedRecommendation.spokenDescription).toBeDefined();
      expect(adaptedRecommendation.voicePrompts.length).toBeGreaterThan(0);
      expect(adaptedRecommendation.audioLength).toBeGreaterThan(0);
      expect(adaptedRecommendation.speechRate).toBeGreaterThan(0);
    });

    it('should validate child-safe voice content', async () => {
      const safeContent = 'Let\'s have fun playing games together as a family!';
      const unsafeContent = 'This is a private activity for adults only';

      const safeResult = await voiceIntegration.validateChildSafeVoiceContent(
        safeContent,
        'child-user-123'
      );
      const unsafeResult = await voiceIntegration.validateChildSafeVoiceContent(
        unsafeContent,
        'child-user-123'
      );

      expect(safeResult).toBe(true);
      expect(unsafeResult).toBe(false);
    });
  });

  describe('Scheduling System Integration and Automation', () => {
    it('should integrate recommendation with scheduling system', async () => {
      const integrationActions = await schedulingIntegration.integrateWithScheduling(
        mockRecommendation,
        'user-123'
      );

      expect(integrationActions.length).toBeGreaterThan(0);

      // Verify time slot validation
      const validateAction = integrationActions.find(
        action => action.action === 'validateTimeSlot'
      );
      expect(validateAction).toBeDefined();
      expect(validateAction?.parameters.userId).toBe('user-123');

      // Verify calendar event creation
      const createEventAction = integrationActions.find(
        action => action.action === 'createCalendarEvent'
      );
      expect(createEventAction).toBeDefined();
      expect(createEventAction?.parameters.event).toBeDefined();
      expect(createEventAction?.parameters.source).toBe('recommendation');

      // Verify calendar sync
      const syncAction = integrationActions.find(
        action => action.action === 'syncWithCalendar'
      );
      expect(syncAction).toBeDefined();
      expect(syncAction?.parameters.recommendationId).toBe('test-rec-001');
    });

    it('should create calendar event from recommendation', async () => {
      const calendarEvent = await schedulingIntegration.createCalendarEventFromRecommendation(
        mockRecommendation,
        'user-123'
      );

      expect(calendarEvent.id).toContain('rec-event-test-rec-001');
      expect(calendarEvent.title).toBe('Activity: Family Game Night');
      expect(calendarEvent.start).toBeInstanceOf(Date);
      expect(calendarEvent.end).toBeInstanceOf(Date);
      expect(calendarEvent.attendees).toContain('user-123');
      expect(calendarEvent.flexible).toBe(true); // High confidence = less flexible, but still flexible
      expect((calendarEvent as any).metadata.sourceRecommendation).toBe('test-rec-001');
      expect((calendarEvent as any).childSafe).toBe(true);
    });

    it('should resolve scheduling conflicts intelligently', async () => {
      const mockConflicts = [
        {
          conflictId: 'conflict-001',
          conflictingEvents: [
            {
              id: 'event-1',
              title: 'Existing Event',
              start: new Date(),
              end: new Date(Date.now() + 60 * 60 * 1000)
            }
          ],
          severity: 'medium' as const,
          type: 'scheduling' as const,
          probability: 0.8,
          predictedTime: new Date(),
          affectedUsers: ['user-123'],
          preventionStrategies: ['reschedule', 'adjust_duration'],
          suggestedResolutions: []
        }
      ];

      const resolutions = await schedulingIntegration.resolveSchedulingConflicts(
        mockConflicts,
        'user-123'
      );

      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].conflictId).toBe('conflict-001');
      expect(resolutions[0].resolutionStrategy).toBeDefined();
      expect(resolutions[0].alternativeTimeSlots.length).toBeGreaterThan(0);
      expect(resolutions[0].impactAssessment).toBeDefined();
    });

    it('should optimize schedule with multiple recommendations', async () => {
      const recommendations = [mockRecommendation];

      const optimizationResult = await schedulingIntegration.optimizeScheduleWithRecommendations(
        'user-123',
        recommendations
      );

      expect(optimizationResult.originalSchedule).toBeDefined();
      expect(optimizationResult.optimizedSchedule).toBeDefined();
      expect(optimizationResult.appliedRecommendations).toHaveLength(1);
      expect(optimizationResult.timeEfficiencyGain).toBeGreaterThanOrEqual(0);
      expect(optimizationResult.userSatisfactionPrediction).toBeGreaterThan(0);
      expect(optimizationResult.implementationSteps.length).toBeGreaterThan(0);
    });

    it('should sync recommendations with external calendar', async () => {
      const syncResult = await schedulingIntegration.syncRecommendationsWithCalendar('user-123');

      expect(syncResult.lastSyncTime).toBeInstanceOf(Date);
      expect(syncResult.syncedRecommendations).toBeDefined();
      expect(syncResult.createdEvents).toBeDefined();
      expect(syncResult.conflictsDetected).toBeDefined();
      expect(syncResult.syncErrors).toBeDefined();
    });

    it('should validate scheduling feasibility', async () => {
      const feasibilityResult = await schedulingIntegration.validateSchedulingFeasibility(
        mockRecommendation,
        'user-123'
      );

      expect(feasibilityResult.feasible).toBeDefined();
      expect(feasibilityResult.feasibilityScore).toBeGreaterThanOrEqual(0);
      expect(feasibilityResult.feasibilityScore).toBeLessThanOrEqual(1);
      expect(feasibilityResult.constraints).toBeDefined();
      expect(feasibilityResult.alternativeTimeSlots).toBeDefined();
      expect(feasibilityResult.riskFactors).toBeDefined();
    });
  });

  describe('Smart Home Integration and Automation', () => {
    beforeEach(() => {
      // Setup smart home integration mocks
      smartHomeIntegration.integrateWithSmartHome.mockResolvedValue([
        {
          system: 'smart_home',
          action: 'coordinateDevices',
          parameters: {
            coordinationId: 'coord-test-rec-001-123',
            devices: ['light-living-room'],
            sequence: [],
            safetyChecks: [],
            userConfirmationRequired: false
          }
        },
        {
          system: 'smart_home',
          action: 'monitorDeviceStates',
          parameters: {
            recommendationId: 'test-rec-001',
            monitoredDevices: ['light-living-room'],
            monitoringDuration: 3600,
            alertConditions: []
          }
        }
      ]);

      smartHomeIntegration.coordinateSmartDevices.mockResolvedValue({
        coordinationId: 'coord-test-rec-001-123',
        involvedDevices: ['light-living-room'],
        coordinationSequence: [
          {
            stepId: 'step-1',
            deviceId: 'light-living-room',
            action: {
              action: 'setBrightness',
              parameters: { level: 80 },
              safetyLevel: 'safe',
              energyImpact: 'low',
              reversible: true
            },
            parameters: { level: 80 },
            timing: { delay: 0, timeout: 30, retryCount: 3, retryDelay: 5 },
            dependencies: [],
            safetyCheck: false
          }
        ],
        expectedOutcome: 'Execute 1 device actions to support: Family Game Night',
        safetyChecks: [],
        energyImpact: {
          estimatedUsage: 12,
          duration: 60,
          cost: 0.02,
          peakTimeUsage: false,
          carbonFootprint: 0.006
        },
        userConfirmationRequired: false,
        fallbackActions: []
      });

      smartHomeIntegration.generateAutomationTriggers.mockResolvedValue([
        {
          triggerId: 'trigger-test-rec-001',
          triggerType: 'time_based',
          condition: {
            conditionType: 'time',
            parameters: { time: '19:00' }
          },
          actions: [],
          schedule: { scheduleType: 'immediate' },
          safetyConstraints: [],
          energyConsiderations: [],
          userOverrideEnabled: true
        }
      ]);

      smartHomeIntegration.considerDeviceStatesInRecommendations.mockResolvedValue({
        ...mockUserContext,
        availableDevices: [
          {
            deviceId: 'light-living-room',
            deviceType: 'lighting',
            name: 'Living Room Light',
            location: 'Living Room',
            available: true,
            capabilities: ['brightness', 'color'],
            safetyRating: 'safe',
            energyEfficient: true
          }
        ],
        deviceCapabilities: {
          'light-living-room': ['brightness', 'color']
        },
        energyConstraints: [],
        automationOpportunities: [],
        safetyRestrictions: []
      });

      smartHomeIntegration.validateSmartHomeSafety.mockResolvedValue({
        safe: true,
        safetyScore: 0.9,
        riskFactors: [],
        requiredSafeguards: [],
        parentalApprovalRequired: false,
        childSafetyCompliant: true,
        recommendations: []
      });
    });

    it('should integrate recommendation with smart home devices', async () => {
      const integrationActions = await smartHomeIntegration.integrateWithSmartHome(
        mockRecommendation,
        'user-123'
      );

      expect(integrationActions.length).toBeGreaterThan(0);

      // Verify device coordination
      const coordinateAction = integrationActions.find(
        (action: any) => action.action === 'coordinateDevices'
      );
      expect(coordinateAction).toBeDefined();
      expect(coordinateAction?.parameters.coordinationId).toBeDefined();

      // Verify device state monitoring
      const monitorAction = integrationActions.find(
        (action: any) => action.action === 'monitorDeviceStates'
      );
      expect(monitorAction).toBeDefined();
      expect(monitorAction?.parameters.recommendationId).toBe('test-rec-001');
    });

    it('should coordinate smart devices for recommendation execution', async () => {
      const mockDeviceStates = [
        {
          deviceId: 'light-living-room',
          deviceType: 'lighting' as any,
          name: 'Living Room Light',
          location: 'Living Room',
          status: 'online' as any,
          capabilities: [
            {
              capability: 'brightness',
              parameters: [
                {
                  name: 'level',
                  type: 'number' as const,
                  range: [0, 100] as [number, number],
                  default: 50,
                  childSafe: true
                }
              ],
              safetyLevel: 'safe' as const,
              childAccessible: true,
              energyImpact: 'low' as const
            }
          ],
          currentSettings: { brightness: 75 },
          energyUsage: {
            currentWatts: 12,
            dailyKwh: 0.3,
            monthlyKwh: 9,
            costPerHour: 0.02,
            peakUsageTime: '19:00',
            efficiencyRating: 'A+' as const
          },
          lastUpdated: new Date(),
          childSafetyLocked: false,
          parentalControlsActive: true
        }
      ];

      const coordination = await smartHomeIntegration.coordinateSmartDevices(
        mockRecommendation,
        mockDeviceStates
      );

      expect(coordination.coordinationId).toContain('coord-test-rec-001');
      expect(coordination.involvedDevices).toContain('light-living-room');
      expect(coordination.coordinationSequence.length).toBeGreaterThan(0);
      expect(coordination.safetyChecks).toBeDefined();
      expect(coordination.energyImpact).toBeDefined();
      expect(coordination.expectedOutcome).toContain('Family Game Night');
    });

    it('should generate automation triggers based on recommendations', async () => {
      const triggers = await smartHomeIntegration.generateAutomationTriggers(
        mockRecommendation,
        'user-123'
      );

      expect(triggers.length).toBeGreaterThan(0);
      
      const trigger = triggers[0];
      expect(trigger.triggerId).toBeDefined();
      expect(trigger.triggerType).toBeDefined();
      expect(trigger.condition).toBeDefined();
      expect(trigger.actions).toBeDefined();
      expect(trigger.safetyConstraints).toBeDefined();
      expect(trigger.userOverrideEnabled).toBe(true);
    });

    it('should consider device states in recommendation context', async () => {
      const deviceInfluencedContext = await smartHomeIntegration.considerDeviceStatesInRecommendations(
        'user-123',
        mockUserContext
      );

      expect(deviceInfluencedContext.userId).toBe('user-123');
      expect(deviceInfluencedContext.availableDevices).toBeDefined();
      expect(deviceInfluencedContext.deviceCapabilities).toBeDefined();
      expect(deviceInfluencedContext.energyConstraints).toBeDefined();
      expect(deviceInfluencedContext.automationOpportunities).toBeDefined();
      expect(deviceInfluencedContext.safetyRestrictions).toBeDefined();
    });

    it('should validate smart home automation safety', async () => {
      const mockAutomation = {
        id: 'automation-001',
        name: 'Game Night Lighting',
        description: 'Adjust lighting for family game night',
        triggers: [],
        actions: [],
        safetyLevel: 'safe' as const,
        energyImpact: 'low' as const,
        childSafetyValidated: true
      };

      const safetyResult = await smartHomeIntegration.validateSmartHomeSafety(
        mockAutomation,
        'user-123'
      );

      expect(safetyResult.safe).toBeDefined();
      expect(safetyResult.safetyScore).toBeGreaterThanOrEqual(0);
      expect(safetyResult.safetyScore).toBeLessThanOrEqual(1);
      expect(safetyResult.riskFactors).toBeDefined();
      expect(safetyResult.requiredSafeguards).toBeDefined();
      expect(safetyResult.childSafetyCompliant).toBeDefined();
    });
  });

  describe('End-to-End Integration Coordination', () => {
    it('should coordinate all systems for complete recommendation delivery', async () => {
      // Test complete integration workflow
      const voiceActions = await integrationLayer.integrateWithVoice(mockRecommendation);
      const avatarActions = await integrationLayer.integrateWithAvatar(mockRecommendation);
      const schedulingActions = await integrationLayer.integrateWithScheduling(mockRecommendation);
      const smartHomeActions = await integrationLayer.integrateWithSmartHome(mockRecommendation);

      // Verify all systems return integration actions
      expect(voiceActions.length).toBeGreaterThan(0);
      expect(avatarActions.length).toBeGreaterThan(0);
      expect(schedulingActions.length).toBeGreaterThan(0);
      expect(smartHomeActions.length).toBeGreaterThan(0);

      // Verify action execution
      const allActions = [...voiceActions, ...avatarActions, ...schedulingActions, ...smartHomeActions];
      
      for (const action of allActions) {
        const executed = await integrationLayer.executeIntegrationAction(action);
        expect(executed).toBe(true);
      }
    });

    it('should validate all system integrations', async () => {
      const voiceValid = await integrationLayer.validateIntegration('voice');
      const avatarValid = await integrationLayer.validateIntegration('avatar');
      const schedulingValid = await integrationLayer.validateIntegration('scheduling');
      const smartHomeValid = await integrationLayer.validateIntegration('smart_home');

      expect(voiceValid).toBe(true);
      expect(avatarValid).toBe(true);
      expect(schedulingValid).toBe(true);
      expect(smartHomeValid).toBe(true);
    });

    it('should handle integration failures gracefully', async () => {
      // Test with invalid system
      const invalidValid = await integrationLayer.validateIntegration('invalid_system');
      expect(invalidValid).toBe(false);

      // Test action execution with invalid system
      const invalidAction: IntegrationAction = {
        system: 'invalid_system',
        action: 'test_action',
        parameters: {}
      };

      const executed = await integrationLayer.executeIntegrationAction(invalidAction);
      expect(executed).toBe(false);
    });

    it('should maintain child safety across all integrations', async () => {
      // Create child user recommendation
      const childRecommendation = {
        ...mockRecommendation,
        metadata: {
          ...mockRecommendation.metadata,
          userId: 'child-user-123'
        }
      };

      const voiceActions = await integrationLayer.integrateWithVoice(childRecommendation);
      const avatarActions = await integrationLayer.integrateWithAvatar(childRecommendation);
      const schedulingActions = await integrationLayer.integrateWithScheduling(childRecommendation);
      const smartHomeActions = await integrationLayer.integrateWithSmartHome(childRecommendation);

      // Verify child safety is maintained across all systems
      const allActions = [...voiceActions, ...avatarActions, ...schedulingActions, ...smartHomeActions];
      
      // Check for child safety parameters in actions
      const childSafetyActions = allActions.filter(action => 
        action.parameters.childSafeMode === true ||
        action.parameters.childSafe === true ||
        action.parameters.parentalApprovalRequired === true
      );

      expect(childSafetyActions.length).toBeGreaterThan(0);
    });

    it('should coordinate timing across all systems', async () => {
      const startTime = Date.now();

      // Execute all integrations simultaneously
      const [voiceActions, avatarActions, schedulingActions, smartHomeActions] = await Promise.all([
        integrationLayer.integrateWithVoice(mockRecommendation),
        integrationLayer.integrateWithAvatar(mockRecommendation),
        integrationLayer.integrateWithScheduling(mockRecommendation),
        integrationLayer.integrateWithSmartHome(mockRecommendation)
      ]);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify reasonable response time (under 2 seconds for all integrations)
      expect(totalTime).toBeLessThan(2000);

      // Verify all systems returned actions
      expect(voiceActions.length).toBeGreaterThan(0);
      expect(avatarActions.length).toBeGreaterThan(0);
      expect(schedulingActions.length).toBeGreaterThan(0);
      expect(smartHomeActions.length).toBeGreaterThan(0);
    });

    it('should handle concurrent user interactions across systems', async () => {
      const users = ['user-1', 'user-2', 'user-3'];
      const recommendations = users.map(userId => ({
        ...mockRecommendation,
        id: `rec-${userId}`,
        metadata: {
          ...mockRecommendation.metadata,
          userId
        }
      }));

      // Process multiple users concurrently
      const integrationPromises = recommendations.map(async (rec) => {
        const [voice, avatar, scheduling, smartHome] = await Promise.all([
          integrationLayer.integrateWithVoice(rec),
          integrationLayer.integrateWithAvatar(rec),
          integrationLayer.integrateWithScheduling(rec),
          integrationLayer.integrateWithSmartHome(rec)
        ]);

        return { voice, avatar, scheduling, smartHome };
      });

      const results = await Promise.all(integrationPromises);

      // Verify all users got proper integration actions
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.voice.length).toBeGreaterThan(0);
        expect(result.avatar.length).toBeGreaterThan(0);
        expect(result.scheduling.length).toBeGreaterThan(0);
        expect(result.smartHome.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle avatar integration failures gracefully', async () => {
      // Mock personality manager to throw error
      const mockPersonalityManager = require('../../avatar/personality-manager');
      mockPersonalityManager.personalityManager = {
        getActivePersonality: jest.fn().mockImplementation(() => {
          throw new Error('Personality service unavailable');
        })
      };

      const integrationActions = await avatarIntegration.integrateWithAvatar(
        mockRecommendation,
        'user-123'
      );

      // Should return fallback actions instead of throwing
      expect(integrationActions).toHaveLength(1);
      expect(integrationActions[0].action).toBe('presentRecommendation');
    });

    it('should handle voice integration failures gracefully', async () => {
      // Test with invalid user context
      const invalidContext = null as any;

      const voiceResponse = await voiceIntegration.processVoiceRecommendationRequest(
        'user-123',
        'test input',
        invalidContext
      );

      // Should return fallback response
      expect(voiceResponse.spokenResponse).toContain('trouble understanding');
      expect(voiceResponse.recommendations).toHaveLength(0);
    });

    it('should handle scheduling integration failures gracefully', async () => {
      // Test with invalid recommendation
      const invalidRecommendation = {
        ...mockRecommendation,
        metadata: null as any
      };

      const integrationActions = await schedulingIntegration.integrateWithScheduling(
        invalidRecommendation,
        'user-123'
      );

      // Should return fallback actions
      expect(integrationActions.length).toBeGreaterThan(0);
      const fallbackAction = integrationActions.find(action => 
        action.parameters.fallbackMode === true
      );
      expect(fallbackAction).toBeDefined();
    });

    it('should handle smart home integration failures gracefully', async () => {
      // Test with empty device states
      const coordination = await smartHomeIntegration.coordinateSmartDevices(
        mockRecommendation,
        []
      );

      // Should return fallback coordination
      expect(coordination.coordinationId).toContain('fallback');
      expect(coordination.involvedDevices).toHaveLength(0);
      expect(coordination.userConfirmationRequired).toBe(true);
    });
  });
});