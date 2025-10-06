/**
 * Global Test Utilities and Constants for Recommendations Integration Tests
 * Provides shared utilities, mocks, and constants for all integration tests
 */

// Global test constants
export const TEST_CONSTANTS = {
  PERFORMANCE: {
    MAX_LATENCY: 2000, // 2 seconds
    MAX_MEMORY_MB: 1500, // 1.5GB
    MAX_CONCURRENT_REQUESTS: 5,
    TIMEOUT_SHORT: 5000,
    TIMEOUT_MEDIUM: 15000,
    TIMEOUT_LONG: 30000,
    TIMEOUT_EXTENDED: 120000
  },
  USERS: {
    PARENT: 'test-parent-001',
    CHILD: 'test-child-001',
    TEEN: 'test-teen-001',
    FAMILY: 'test-family-001'
  },
  SAFETY: {
    CHILD_SAFE_CONFIDENCE_THRESHOLD: 0.9,
    PARENTAL_APPROVAL_REQUIRED: true,
    MAX_CHILD_SCREEN_TIME: 3600, // 1 hour
    RESTRICTED_CATEGORIES: ['adult', 'violent', 'inappropriate']
  },
  PRIVACY: {
    DATA_RETENTION_PERIOD: 86400000, // 24 hours for tests
    ENCRYPTION_REQUIRED: false, // Disabled for faster tests
    ANONYMIZATION_LEVEL: 'medium'
  }
};

// Global mock implementations
export const GLOBAL_MOCKS = {
  // Mock avatar system
  avatarSystem: {
    isInitialized: jest.fn(() => true),
    getPersonalityTraits: jest.fn((userId: string) => ({
      friendliness: 8,
      formality: 5,
      humor: 7,
      enthusiasm: 6,
      patience: 8,
      supportiveness: 9
    })),
    updateEmotionalState: jest.fn((userId: string, emotion: string) => Promise.resolve()),
    deliverRecommendation: jest.fn((userId: string, recommendation: any) => Promise.resolve({
      delivered: true,
      deliveryMethod: 'visual',
      userResponse: 'acknowledged'
    })),
    getDeliveryCapabilities: jest.fn(() => ({
      visual: true,
      audio: true,
      gesture: true,
      emotion: true
    }))
  },

  // Mock voice integration
  voiceIntegration: {
    isAvailable: jest.fn(() => true),
    deliverVoiceRecommendation: jest.fn((userId: string, recommendation: any) => Promise.resolve({
      delivered: true,
      naturalLanguageResponse: `Here's a suggestion: ${recommendation.title}`,
      userEngagement: 'high'
    })),
    collectVoiceFeedback: jest.fn((userId: string, recommendationId: string) => Promise.resolve({
      feedback: 'positive',
      rating: 4,
      comments: 'That was helpful'
    })),
    processNaturalLanguageRequest: jest.fn((userId: string, request: string) => Promise.resolve({
      intent: 'get_recommendations',
      parameters: { type: 'activity' },
      confidence: 0.9
    })),
    generateNaturalResponse: jest.fn((recommendation: any) => 
      `I think you might enjoy ${recommendation.title}. ${recommendation.description}`
    )
  },

  // Mock scheduling integration
  schedulingIntegration: {
    isAvailable: jest.fn(() => true),
    getCalendarEvents: jest.fn((userId: string, timeRange: any) => Promise.resolve([
      {
        id: 'event-001',
        title: 'Work Meeting',
        start: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000),
        type: 'work'
      }
    ])),
    createCalendarEvent: jest.fn((userId: string, event: any) => Promise.resolve({
      created: true,
      eventId: `event-${Date.now()}`,
      conflicts: []
    })),
    checkScheduleConflicts: jest.fn((userId: string, timeSlot: any) => Promise.resolve([])),
    suggestAlternativeTimes: jest.fn((userId: string, duration: number) => Promise.resolve([
      {
        start: new Date(Date.now() + 4 * 60 * 60 * 1000),
        end: new Date(Date.now() + 5 * 60 * 60 * 1000),
        confidence: 0.8
      }
    ]))
  },

  // Mock smart home integration
  smartHomeIntegration: {
    isAvailable: jest.fn(() => true),
    getDeviceStatus: jest.fn((deviceType: string) => Promise.resolve({
      type: deviceType,
      status: 'online',
      controllable: true,
      capabilities: ['on_off', 'dimming']
    })),
    controlDevice: jest.fn((deviceId: string, action: any) => Promise.resolve({
      success: true,
      newState: action.targetState
    })),
    createAutomation: jest.fn((automation: any) => Promise.resolve({
      created: true,
      automationId: `automation-${Date.now()}`
    })),
    getAutomationOpportunities: jest.fn((context: any) => Promise.resolve([
      {
        type: 'lighting',
        description: 'Automatically adjust lighting for activity',
        energySavings: 0.2,
        convenience: 0.8
      }
    ]))
  },

  // Mock learning engine
  learningEngine: {
    updateUserModel: jest.fn((userId: string, interactions: any[]) => Promise.resolve()),
    adaptToUserFeedback: jest.fn((userId: string, feedback: any) => Promise.resolve()),
    getRecommendationModel: jest.fn((userId: string) => Promise.resolve({
      accuracy: 0.85,
      confidence: 0.8,
      lastUpdated: new Date()
    })),
    trainModel: jest.fn((trainingData: any) => Promise.resolve({
      success: true,
      accuracy: 0.87,
      trainingTime: 1500
    }))
  },

  // Mock privacy manager
  privacyManager: {
    enforcePrivacyPreferences: jest.fn((userId: string, operation: any) => Promise.resolve({
      allowed: true,
      restrictions: [],
      anonymizationRequired: false,
      consentRequired: false,
      auditRequired: true
    })),
    encryptUserData: jest.fn((data: any) => Promise.resolve(data)), // No-op for tests
    anonymizeUserData: jest.fn((data: any, level: string) => Promise.resolve({
      ...data,
      userId: 'anonymous',
      anonymized: true
    })),
    updatePrivacySettings: jest.fn((userId: string, settings: any) => Promise.resolve()),
    auditDataUsage: jest.fn((userId: string, timeRange: any) => Promise.resolve({
      operations: [],
      totalOperations: 0,
      privacyViolations: 0
    }))
  }
};

// Global test utilities
export const TEST_UTILS = {
  // Create standardized test contexts
  createTestContext: (userId: string, overrides: any = {}) => ({
    userId,
    timestamp: new Date(),
    location: {
      type: 'home',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      weather: { condition: 'sunny', temperature: 22 },
      indoorOutdoor: 'indoor'
    },
    activity: {
      current: 'free_time',
      availableTime: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
      energyLevel: 'medium',
      mood: 'content'
    },
    availability: {
      status: 'available',
      until: new Date(Date.now() + 2 * 60 * 60 * 1000),
      constraints: []
    },
    mood: {
      primary: 'content',
      energy: 'medium',
      stress: 'low'
    },
    energy: 'medium',
    social: {
      familyPresent: [],
      preferredSocialLevel: 'individual',
      groupSize: 1
    },
    environmental: {
      location: 'home',
      weather: { condition: 'sunny', temperature: 22 },
      timeOfDay: 'afternoon',
      season: 'spring'
    },
    preferences: {
      activityTypes: ['general'],
      difficultyLevel: 'medium',
      duration: 'medium',
      socialLevel: 'individual'
    },
    ...overrides
  }),

  // Create test feedback
  createTestFeedback: (userId: string, recommendationId: string, overrides: any = {}) => ({
    userId,
    recommendationId,
    rating: 4,
    completionRate: 0.8,
    timeSpent: 1800, // 30 minutes
    contextAccuracy: 0.9,
    timestamp: new Date(),
    comments: 'Good suggestion',
    ...overrides
  }),

  // Create test user preferences
  createTestUserPreferences: (userId: string, overrides: any = {}) => ({
    userId,
    interests: [
      { category: 'general', subcategory: 'misc', strength: 0.5, recency: new Date(), source: 'default' }
    ],
    activityPreferences: {
      preferredCategories: ['general'],
      difficultyLevel: 'medium',
      durationPreference: 'medium',
      socialPreference: 'individual'
    },
    schedulePreferences: {
      preferredTimes: ['any'],
      flexibilityLevel: 'medium',
      priorityTypes: ['personal']
    },
    learningPreferences: {
      adaptationRate: 0.5,
      explorationRate: 0.3,
      feedbackSensitivity: 0.7
    },
    privacyPreferences: {
      dataMinimization: false,
      shareWithFamily: false,
      allowLearning: true,
      retentionPeriod: TEST_CONSTANTS.PRIVACY.DATA_RETENTION_PERIOD,
      encryptionRequired: TEST_CONSTANTS.PRIVACY.ENCRYPTION_REQUIRED
    },
    notificationPreferences: {
      enabled: true,
      frequency: 'moderate',
      channels: ['system'],
      quietHours: { start: '22:00', end: '07:00' }
    },
    lastUpdated: new Date(),
    ...overrides
  }),

  // Performance measurement utilities
  measurePerformance: async <T>(operation: () => Promise<T>) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await operation();
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      result,
      duration: endTime - startTime,
      memoryUsage: (endMemory - startMemory) / 1024 / 1024 // MB
    };
  },

  // Wait for condition utility
  waitForCondition: async (
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 10000,
    intervalMs: number = 100
  ) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  },

  // Validation utilities
  validateRecommendation: (recommendation: any) => {
    const requiredFields = ['id', 'type', 'title', 'description', 'confidence', 'reasoning', 'actionable'];
    const missingFields = requiredFields.filter(field => !(field in recommendation));
    
    if (missingFields.length > 0) {
      throw new Error(`Recommendation missing required fields: ${missingFields.join(', ')}`);
    }
    
    if (recommendation.confidence < 0 || recommendation.confidence > 1) {
      throw new Error(`Invalid confidence value: ${recommendation.confidence}`);
    }
    
    if (!Array.isArray(recommendation.reasoning) || recommendation.reasoning.length === 0) {
      throw new Error('Recommendation must have non-empty reasoning array');
    }
    
    return true;
  },

  validateChildSafety: (recommendation: any) => {
    if (!recommendation.metadata) {
      throw new Error('Recommendation must have metadata for child safety validation');
    }
    
    if (recommendation.metadata.childSafe !== true) {
      throw new Error('Recommendation not marked as child safe');
    }
    
    if (recommendation.metadata.ageAppropriate !== true) {
      throw new Error('Recommendation not marked as age appropriate');
    }
    
    return true;
  },

  validatePrivacyCompliance: (recommendation: any) => {
    if (!recommendation.metadata) {
      throw new Error('Recommendation must have metadata for privacy validation');
    }
    
    if (recommendation.metadata.privacyCompliant !== true) {
      throw new Error('Recommendation not marked as privacy compliant');
    }
    
    return true;
  }
};

// Setup global mocks
beforeAll(() => {
  // Apply global mocks
  Object.keys(GLOBAL_MOCKS).forEach(mockName => {
    (global as any)[mockName] = GLOBAL_MOCKS[mockName as keyof typeof GLOBAL_MOCKS];
  });
});

// Cleanup global mocks
afterAll(() => {
  // Clean up global mocks
  Object.keys(GLOBAL_MOCKS).forEach(mockName => {
    delete (global as any)[mockName];
  });
});

// Export everything for use in tests
export default {
  TEST_CONSTANTS,
  GLOBAL_MOCKS,
  TEST_UTILS
};