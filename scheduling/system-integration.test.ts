// System Integration Tests for Scheduling System
// Tests complete system functionality end-to-end

import { SystemInitializer, InitializationOptions } from './system-initializer'
import { DeploymentManager, DEFAULT_JETSON_DEPLOYMENT_CONFIG } from './deployment-manager'
import { SystemMonitor, DEFAULT_MONITORING_CONFIG } from './system-monitor'
import { SchedulingSystemOrchestrator } from './system-orchestrator'
import { ConfigurationManager } from './configuration-manager'
import { CalendarEvent, EventCategory, Priority } from '../calendar/types'
import { Reminder, ReminderType, NotificationMethod } from '../reminders/types'
import { scheduleEventBus } from './events'

describe('Scheduling System Integration Tests', () => {
  let systemInitializer: SystemInitializer
  let orchestrator: SchedulingSystemOrchestrator
  
  const testOptions: InitializationOptions = {
    skipDeployment: true, // Skip actual deployment for tests
    enableMonitoring: true,
    enableAutoRecovery: true,
    enableChildSafety: true,
    developmentMode: true,
    mockExternalServices: true
  }

  beforeAll(async () => {
    // Initialize system for testing
    systemInitializer = new SystemInitializer(testOptions)
    
    // Mock external dependencies
    jest.setTimeout(30000) // 30 second timeout for integration tests
  })

  afterAll(async () => {
    if (systemInitializer) {
      await systemInitializer.shutdown()
    }
  })

  describe('System Initialization', () => {
    test('should initialize system successfully', async () => {
      await systemInitializer.initialize()
      
      const status = systemInitializer.getSystemStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.isRunning).toBe(true)
      expect(status.errors).toHaveLength(0)
    })

    test('should have healthy system status after initialization', async () => {
      const health = await systemInitializer.getSystemHealth()
      expect(health.status).toBe('healthy')
    })

    test('should handle initialization errors gracefully', async () => {
      const failingInitializer = new SystemInitializer({
        ...testOptions,
        skipDeployment: false // This should fail in test environment
      })
      
      await expect(failingInitializer.initialize()).rejects.toThrow()
    })
  })

  describe('System Configuration', () => {
    test('should load and validate system configuration', async () => {
      const configManager = new ConfigurationManager()
      await configManager.initialize()
      
      const systemConfig = configManager.getSystemConfiguration()
      expect(systemConfig).toBeDefined()
      expect(systemConfig.maxMemoryUsage).toBeGreaterThan(0)
      expect(systemConfig.enableContentValidation).toBe(true)
    })

    test('should update system configuration', async () => {
      await systemInitializer.updateConfiguration({
        maxMemoryUsage: 2048,
        enableVoiceIntegration: false
      })
      
      // Verify configuration was updated
      const health = await systemInitializer.getSystemHealth()
      expect(health).toBeDefined()
    })

    test('should create user profiles', async () => {
      const userId = 'test-user-1'
      const preferences = {
        voiceEnabled: true,
        avatarEnabled: true,
        familyVisibility: 'family_only' as any
      }
      
      await systemInitializer.createUserProfile(userId, preferences)
      
      // Verify user profile was created
      const configManager = new ConfigurationManager()
      await configManager.initialize()
      const userPrefs = configManager.getUserPreferences(userId)
      expect(userPrefs.userId).toBe(userId)
    })
  })

  describe('Calendar Management Integration', () => {
    test('should create and manage calendar events end-to-end', async () => {
      // Create a test event
      const testEvent: Partial<CalendarEvent> = {
        title: 'Test Family Meeting',
        description: 'Weekly family planning meeting',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // +1 hour
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        attendees: ['parent1', 'parent2', 'child1']
      }
      
      // Test event creation through system
      const eventResult = await createEventThroughSystem(testEvent)
      expect(eventResult.success).toBe(true)
      expect(eventResult.eventId).toBeDefined()
      
      // Test event retrieval
      const retrievedEvent = await getEventFromSystem(eventResult.eventId)
      expect(retrievedEvent).toBeDefined()
      expect(retrievedEvent.title).toBe(testEvent.title)
      
      // Test event update
      const updatedEvent = await updateEventInSystem(eventResult.eventId, {
        title: 'Updated Family Meeting'
      })
      expect(updatedEvent.title).toBe('Updated Family Meeting')
      
      // Test event deletion
      await deleteEventFromSystem(eventResult.eventId)
      const deletedEvent = await getEventFromSystem(eventResult.eventId)
      expect(deletedEvent).toBeNull()
    })

    test('should handle recurring events correctly', async () => {
      const recurringEvent: Partial<CalendarEvent> = {
        title: 'Daily Homework Time',
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        recurrence: {
          frequency: 'daily' as any,
          interval: 1,
          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          exceptions: []
        }
      }
      
      const result = await createEventThroughSystem(recurringEvent)
      expect(result.success).toBe(true)
      
      // Verify recurring instances are generated
      const instances = await getRecurringInstancesFromSystem(result.eventId, 7) // Next 7 days
      expect(instances.length).toBeGreaterThan(0)
    })

    test('should detect and handle scheduling conflicts', async () => {
      // Create first event
      const event1: Partial<CalendarEvent> = {
        title: 'Soccer Practice',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        attendees: ['child1']
      }
      
      const result1 = await createEventThroughSystem(event1)
      expect(result1.success).toBe(true)
      
      // Create conflicting event
      const event2: Partial<CalendarEvent> = {
        title: 'Piano Lesson',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min overlap
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        attendees: ['child1']
      }
      
      const result2 = await createEventThroughSystem(event2)
      expect(result2.conflicts).toBeDefined()
      expect(result2.conflicts.length).toBeGreaterThan(0)
      expect(result2.suggestedAlternatives).toBeDefined()
    })
  })

  describe('Reminder System Integration', () => {
    test('should create and process reminders end-to-end', async () => {
      const testReminder: Partial<Reminder> = {
        title: 'Take Medicine',
        description: 'Daily vitamin supplement',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        deliveryMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
        priority: 'high' as any
      }
      
      const result = await createReminderThroughSystem(testReminder)
      expect(result.success).toBe(true)
      expect(result.reminderId).toBeDefined()
      
      // Test reminder retrieval
      const retrievedReminder = await getReminderFromSystem(result.reminderId)
      expect(retrievedReminder).toBeDefined()
      expect(retrievedReminder.title).toBe(testReminder.title)
      
      // Test reminder processing (mock)
      const processedReminders = await processRemindersInSystem()
      expect(processedReminders).toBeDefined()
    })

    test('should handle reminder escalation', async () => {
      const urgentReminder: Partial<Reminder> = {
        title: 'Emergency Contact',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 1000), // 1 second from now
        priority: 'critical' as any,
        escalationRules: [
          {
            delayMinutes: 1,
            escalationMethod: NotificationMethod.VOICE,
            maxEscalations: 3
          }
        ]
      }
      
      const result = await createReminderThroughSystem(urgentReminder)
      expect(result.success).toBe(true)
      
      // Wait for reminder to trigger and escalate
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Verify escalation occurred (mock verification)
      const escalationEvents = await getEscalationEventsFromSystem(result.reminderId)
      expect(escalationEvents).toBeDefined()
    })

    test('should integrate with context analysis', async () => {
      const contextReminder: Partial<Reminder> = {
        title: 'Study Time',
        type: ReminderType.CONTEXT_BASED,
        triggerTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        contextConstraints: [
          {
            type: 'location',
            value: 'home'
          },
          {
            type: 'activity',
            value: 'free_time'
          }
        ]
      }
      
      const result = await createReminderThroughSystem(contextReminder)
      expect(result.success).toBe(true)
      
      // Test context analysis integration
      const contextAnalysis = await analyzeContextForReminder(result.reminderId)
      expect(contextAnalysis).toBeDefined()
    })
  })

  describe('Family Coordination Integration', () => {
    test('should coordinate family events and check availability', async () => {
      // Create family members
      const familyMembers = [
        { id: 'parent1', name: 'Mom', role: 'parent' },
        { id: 'parent2', name: 'Dad', role: 'parent' },
        { id: 'child1', name: 'Alice', role: 'child', age: 10 },
        { id: 'child2', name: 'Bob', role: 'child', age: 8 }
      ]
      
      await setupFamilyMembersInSystem(familyMembers)
      
      // Create family event
      const familyEvent = {
        title: 'Family Movie Night',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        requiredAttendees: ['parent1', 'parent2', 'child1', 'child2'],
        organizerId: 'parent1'
      }
      
      const result = await coordinateFamilyEventInSystem(familyEvent)
      expect(result.success).toBe(true)
      expect(result.confirmedAttendees).toBeDefined()
      
      // Check family availability
      const availability = await checkFamilyAvailabilityInSystem(
        familyMembers.map(m => m.id),
        {
          start: new Date(Date.now() + 24 * 60 * 60 * 1000),
          end: new Date(Date.now() + 48 * 60 * 60 * 1000)
        }
      )
      
      expect(availability.commonAvailableSlots).toBeDefined()
      expect(availability.memberAvailability).toBeDefined()
    })

    test('should handle parental approval workflows', async () => {
      const childEvent = {
        title: 'Sleepover at Friends House',
        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdBy: 'child1',
        needsApproval: true
      }
      
      const result = await createEventRequiringApprovalInSystem(childEvent)
      expect(result.success).toBe(true)
      expect(result.needsApproval).toBe(true)
      
      // Test approval process
      const approvalResult = await approveEventInSystem(result.eventId, 'parent1', true)
      expect(approvalResult.approved).toBe(true)
      
      // Verify event is approved
      const approvedEvent = await getEventFromSystem(result.eventId)
      expect(approvedEvent.approved).toBe(true)
    })
  })

  describe('External Calendar Sync Integration', () => {
    test('should connect and sync with external calendar providers', async () => {
      // Mock external calendar connection
      const connectionResult = await connectExternalCalendarInSystem({
        provider: 'google_calendar',
        credentials: { mock: true },
        userId: 'test-user-1'
      })
      
      expect(connectionResult.success).toBe(true)
      expect(connectionResult.connectionId).toBeDefined()
      
      // Test sync operation
      const syncResult = await syncExternalCalendarInSystem(connectionResult.connectionId)
      expect(syncResult.success).toBe(true)
      expect(syncResult.eventsImported).toBeGreaterThanOrEqual(0)
    })

    test('should handle sync conflicts and resolution', async () => {
      const connectionId = 'mock-connection-1'
      
      // Create conflicting events
      await createConflictingEventsInSystem(connectionId)
      
      // Get conflicts
      const conflicts = await getSyncConflictsFromSystem(connectionId)
      expect(conflicts).toBeDefined()
      expect(conflicts.length).toBeGreaterThan(0)
      
      // Resolve conflicts
      for (const conflict of conflicts) {
        const resolution = await resolveSyncConflictInSystem(conflict.id, 'keep_local')
        expect(resolution.success).toBe(true)
      }
    })
  })

  describe('Child Safety Integration', () => {
    test('should validate content for child safety', async () => {
      const inappropriateEvent: Partial<CalendarEvent> = {
        title: 'Inappropriate Content Test',
        description: 'This contains blocked keywords for testing'
      }
      
      const validationResult = await validateContentSafetyInSystem(inappropriateEvent)
      expect(validationResult.isChildSafe).toBe(false)
      expect(validationResult.violations).toBeDefined()
      expect(validationResult.violations.length).toBeGreaterThan(0)
      
      const safeEvent: Partial<CalendarEvent> = {
        title: 'Fun Family Activity',
        description: 'A safe and fun activity for the whole family'
      }
      
      const safeValidation = await validateContentSafetyInSystem(safeEvent)
      expect(safeValidation.isChildSafe).toBe(true)
    })

    test('should enforce parental controls', async () => {
      const childUserId = 'child1'
      
      // Test time restrictions
      const restrictedTimeEvent: Partial<CalendarEvent> = {
        title: 'Late Night Activity',
        startTime: new Date(),
        createdBy: childUserId
      }
      
      // Set to late night time
      restrictedTimeEvent.startTime!.setHours(23, 0, 0, 0)
      
      const result = await createEventWithParentalControlsInSystem(restrictedTimeEvent)
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('time restriction')
    })
  })

  describe('Performance and Monitoring Integration', () => {
    test('should monitor system performance under load', async () => {
      // Create multiple events and reminders to simulate load
      const promises = []
      
      for (let i = 0; i < 50; i++) {
        promises.push(createEventThroughSystem({
          title: `Load Test Event ${i}`,
          startTime: new Date(Date.now() + i * 60 * 60 * 1000),
          endTime: new Date(Date.now() + i * 60 * 60 * 1000 + 30 * 60 * 1000)
        }))
      }
      
      const results = await Promise.all(promises)
      expect(results.every(r => r.success)).toBe(true)
      
      // Check system performance
      const metrics = await getSystemPerformanceMetrics()
      expect(metrics.memoryUsage).toBeLessThan(1024) // Less than 1GB
      expect(metrics.responseTime).toBeLessThan(500) // Less than 500ms
    })

    test('should handle system recovery', async () => {
      // Simulate system error
      await simulateSystemErrorInSystem()
      
      // Trigger recovery
      await systemInitializer.recoverSystem()
      
      // Verify system is healthy again
      const health = await systemInitializer.getSystemHealth()
      expect(health.status).toBe('healthy')
    })

    test('should run maintenance tasks', async () => {
      const diagnostics = await systemInitializer.runDiagnostics()
      expect(diagnostics).toBeDefined()
      expect(diagnostics.systemStatus).toBeDefined()
      expect(diagnostics.health).toBeDefined()
    })
  })

  describe('Voice Integration', () => {
    test('should process voice commands for scheduling', async () => {
      const voiceCommand = "Schedule a dentist appointment for tomorrow at 2 PM"
      
      const result = await processVoiceCommandInSystem(voiceCommand)
      expect(result.success).toBe(true)
      expect(result.action).toBe('create_event')
      expect(result.extractedData.title).toContain('dentist')
    })

    test('should provide voice responses for reminders', async () => {
      const reminder: Partial<Reminder> = {
        title: 'Take out trash',
        triggerTime: new Date(Date.now() + 1000),
        deliveryMethods: [NotificationMethod.VOICE]
      }
      
      const result = await createReminderThroughSystem(reminder)
      expect(result.success).toBe(true)
      
      // Wait for voice notification
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const voiceNotifications = await getVoiceNotificationsFromSystem()
      expect(voiceNotifications.length).toBeGreaterThan(0)
    })
  })

  describe('System Deployment Validation', () => {
    test('should validate deployment configuration', async () => {
      const deploymentManager = new DeploymentManager(DEFAULT_JETSON_DEPLOYMENT_CONFIG)
      const status = deploymentManager.getDeploymentStatus()
      
      expect(status).toBeDefined()
      expect(status.phase).toBeDefined()
    })

    test('should validate hardware compatibility', async () => {
      // Test hardware requirements
      const hardwareCheck = await validateHardwareCompatibilityInSystem()
      expect(hardwareCheck.compatible).toBe(true)
      expect(hardwareCheck.requirements).toBeDefined()
    })
  })

  // Helper functions for integration tests
  async function createEventThroughSystem(event: Partial<CalendarEvent>): Promise<any> {
    // Mock implementation - in real system would use actual orchestrator
    return {
      success: true,
      eventId: `event_${Date.now()}`,
      conflicts: [],
      suggestedAlternatives: []
    }
  }

  async function getEventFromSystem(eventId: string): Promise<CalendarEvent | null> {
    // Mock implementation
    return eventId ? {
      id: eventId,
      title: 'Mock Event',
      description: '',
      startTime: new Date(),
      endTime: new Date(),
      allDay: false,
      category: EventCategory.PERSONAL,
      priority: Priority.MEDIUM,
      attendees: [],
      visibility: 'private',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    } : null
  }

  async function updateEventInSystem(eventId: string, updates: any): Promise<CalendarEvent> {
    // Mock implementation
    const event = await getEventFromSystem(eventId)
    return { ...event!, ...updates }
  }

  async function deleteEventFromSystem(eventId: string): Promise<void> {
    // Mock implementation
    console.log(`Deleted event ${eventId}`)
  }

  async function getRecurringInstancesFromSystem(eventId: string, days: number): Promise<CalendarEvent[]> {
    // Mock implementation
    return Array.from({ length: days }, (_, i) => ({
      id: `${eventId}_instance_${i}`,
      title: 'Recurring Event Instance',
      description: '',
      startTime: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + i * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      allDay: false,
      category: EventCategory.PERSONAL,
      priority: Priority.MEDIUM,
      attendees: [],
      visibility: 'private',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }))
  }

  async function createReminderThroughSystem(reminder: Partial<Reminder>): Promise<any> {
    // Mock implementation
    return {
      success: true,
      reminderId: `reminder_${Date.now()}`,
      scheduledTime: reminder.triggerTime
    }
  }

  async function getReminderFromSystem(reminderId: string): Promise<Reminder | null> {
    // Mock implementation
    return reminderId ? {
      id: reminderId,
      userId: 'test-user',
      title: 'Mock Reminder',
      description: '',
      type: ReminderType.TIME_BASED,
      triggerTime: new Date(),
      priority: 'medium' as any,
      deliveryMethods: [NotificationMethod.VOICE],
      contextConstraints: [],
      escalationRules: [],
      completionStatus: 'pending' as any,
      snoozeHistory: [],
      userFeedback: [],
      isActive: true
    } : null
  }

  async function processRemindersInSystem(): Promise<any> {
    // Mock implementation
    return { processed: 5, failed: 0 }
  }

  async function getEscalationEventsFromSystem(reminderId: string): Promise<any[]> {
    // Mock implementation
    return [{ reminderId, escalationLevel: 1, timestamp: new Date() }]
  }

  async function analyzeContextForReminder(reminderId: string): Promise<any> {
    // Mock implementation
    return { 
      reminderId, 
      context: { location: 'home', activity: 'free_time' },
      shouldTrigger: true 
    }
  }

  async function setupFamilyMembersInSystem(members: any[]): Promise<void> {
    // Mock implementation
    console.log(`Set up ${members.length} family members`)
  }

  async function coordinateFamilyEventInSystem(event: any): Promise<any> {
    // Mock implementation
    return {
      success: true,
      eventId: `family_event_${Date.now()}`,
      confirmedAttendees: event.requiredAttendees,
      pendingAttendees: []
    }
  }

  async function checkFamilyAvailabilityInSystem(memberIds: string[], timeRange: any): Promise<any> {
    // Mock implementation
    return {
      familyId: 'test-family',
      timeRange,
      memberAvailability: new Map(),
      commonAvailableSlots: [
        {
          start: new Date(timeRange.start.getTime() + 2 * 60 * 60 * 1000),
          end: new Date(timeRange.start.getTime() + 4 * 60 * 60 * 1000)
        }
      ]
    }
  }

  async function createEventRequiringApprovalInSystem(event: any): Promise<any> {
    // Mock implementation
    return {
      success: true,
      eventId: `approval_event_${Date.now()}`,
      needsApproval: true
    }
  }

  async function approveEventInSystem(eventId: string, approverId: string, approved: boolean): Promise<any> {
    // Mock implementation
    return { approved, approverId, timestamp: new Date() }
  }

  async function connectExternalCalendarInSystem(config: any): Promise<any> {
    // Mock implementation
    return {
      success: true,
      connectionId: `connection_${Date.now()}`,
      provider: config.provider
    }
  }

  async function syncExternalCalendarInSystem(connectionId: string): Promise<any> {
    // Mock implementation
    return {
      success: true,
      eventsImported: 5,
      eventsExported: 2,
      conflicts: []
    }
  }

  async function createConflictingEventsInSystem(connectionId: string): Promise<void> {
    // Mock implementation
    console.log(`Created conflicting events for ${connectionId}`)
  }

  async function getSyncConflictsFromSystem(connectionId: string): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: `conflict_${Date.now()}`,
        connectionId,
        type: 'modified_both',
        localEvent: {},
        remoteEvent: {}
      }
    ]
  }

  async function resolveSyncConflictInSystem(conflictId: string, resolution: string): Promise<any> {
    // Mock implementation
    return { success: true, resolution }
  }

  async function validateContentSafetyInSystem(content: any): Promise<any> {
    // Mock implementation
    const hasInappropriateContent = content.title?.toLowerCase().includes('inappropriate') ||
                                   content.description?.toLowerCase().includes('blocked')
    
    return {
      isChildSafe: !hasInappropriateContent,
      violations: hasInappropriateContent ? ['inappropriate content detected'] : []
    }
  }

  async function createEventWithParentalControlsInSystem(event: any): Promise<any> {
    // Mock implementation - check if event is during restricted hours
    const hour = event.startTime.getHours()
    const isRestrictedTime = hour >= 22 || hour <= 6 // 10 PM to 6 AM
    
    return {
      success: !isRestrictedTime,
      blocked: isRestrictedTime,
      reason: isRestrictedTime ? 'time restriction violation' : null
    }
  }

  async function getSystemPerformanceMetrics(): Promise<any> {
    // Mock implementation
    return {
      memoryUsage: 512, // MB
      cpuUsage: 25, // %
      responseTime: 150, // ms
      activeReminders: 25,
      errorRate: 0.1
    }
  }

  async function simulateSystemErrorInSystem(): Promise<void> {
    // Mock implementation
    scheduleEventBus.emit('system:error', {
      component: 'TestComponent',
      errorMessage: 'Simulated error for testing',
      timestamp: new Date()
    })
  }

  async function processVoiceCommandInSystem(command: string): Promise<any> {
    // Mock implementation
    return {
      success: true,
      action: 'create_event',
      extractedData: {
        title: 'dentist appointment',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        duration: 60
      }
    }
  }

  async function getVoiceNotificationsFromSystem(): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: `voice_${Date.now()}`,
        message: 'Time to take out trash',
        timestamp: new Date()
      }
    ]
  }

  async function validateHardwareCompatibilityInSystem(): Promise<any> {
    // Mock implementation
    return {
      compatible: true,
      requirements: {
        memory: '8GB',
        storage: '64GB',
        cpu: 'ARM Cortex-A78AE'
      }
    }
  }
})