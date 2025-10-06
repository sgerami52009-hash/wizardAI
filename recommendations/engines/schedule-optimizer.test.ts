/**
 * Unit tests for Schedule Optimizer Engine
 * 
 * Tests schedule analysis and gap detection, conflict resolution algorithms,
 * and routine optimization suggestions.
 * 
 * Requirements: 2.1, 2.2, 2.4, 2.5
 */

import { ScheduleOptimizer } from './schedule-optimizer';
import {
  ScheduleOptimization,
  TimeRange,
  CalendarEvent,
  SchedulingConstraints,
  TimeSlot,
  RoutineRecommendation,
  ConflictPrediction,
  Activity,
  TimeBlockSuggestion,
  EfficiencyAnalysis,
  UserContext,
  SchedulePreferences,
  RecommendationConstraints
} from '../types';
import {
  OptimizationType,
  DifficultyLevel,
  RecommendationType,
  ActivityCategory
} from '../enums';

describe('ScheduleOptimizer', () => {
  let optimizer: ScheduleOptimizer;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    optimizer = new ScheduleOptimizer();
  });

  describe('Schedule Analysis and Gap Detection', () => {
    test('should identify schedule gaps between events', async () => {
      // Requirement: 2.1 - Schedule gap analysis and optimization detection
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T08:00:00Z'),
        end: new Date('2024-01-15T18:00:00Z')
      };

      // Mock calendar events with gaps
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          title: 'Morning Meeting',
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T10:00:00Z'),
          location: 'Office',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        },
        {
          id: 'event-2',
          title: 'Lunch Meeting',
          start: new Date('2024-01-15T12:00:00Z'),
          end: new Date('2024-01-15T13:00:00Z'),
          location: 'Restaurant',
          attendees: [testUserId],
          flexible: true,
          priority: 'medium'
        }
      ];

      // Mock the getCalendarEvents method
      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue(mockEvents);
      jest.spyOn(optimizer as any, 'calculateTravelTime').mockResolvedValue(15);

      const optimizations = await optimizer.optimizeSchedule(testUserId, timeRange);

      expect(optimizations).toBeDefined();
      expect(optimizations.length).toBeGreaterThan(0);

      // Should identify the 2-hour gap between 10:00 and 12:00
      const gapOptimization = optimizations.find(opt => 
        opt.title.includes('Time Block') || opt.title.includes('Task Batch')
      );
      expect(gapOptimization).toBeDefined();
      expect(gapOptimization?.timesSaved).toBeGreaterThan(60); // Should be around 105 minutes (2 hours - 15 min travel)
    });

    test('should not suggest optimizations for gaps too small to be useful', async () => {
      // Requirement: 2.1 - Only suggest optimizations for gaps >= 30 minutes
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T08:00:00Z'),
        end: new Date('2024-01-15T18:00:00Z')
      };

      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          title: 'Meeting 1',
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T09:30:00Z'),
          location: 'Office A',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        },
        {
          id: 'event-2',
          title: 'Meeting 2',
          start: new Date('2024-01-15T09:45:00Z'), // Only 15 minute gap
          end: new Date('2024-01-15T10:30:00Z'),
          location: 'Office B',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        }
      ];

      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue(mockEvents);
      jest.spyOn(optimizer as any, 'calculateTravelTime').mockResolvedValue(15); // 15 min travel time

      const optimizations = await optimizer.optimizeSchedule(testUserId, timeRange);

      // Should not suggest optimization for 15-minute gap with 15 min travel time (usableTime = 15-15-10 = -10)
      const gapOptimizations = optimizations.filter(opt => 
        opt.description.includes('gap') || opt.description.includes('minute')
      );
      expect(gapOptimizations.length).toBe(0);
    });

    test('should account for travel time in gap analysis', async () => {
      // Requirement: 2.2 - Travel time calculation and automatic scheduling
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T08:00:00Z'),
        end: new Date('2024-01-15T18:00:00Z')
      };

      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          title: 'Office Meeting',
          start: new Date('2024-01-15T10:00:00Z'),
          end: new Date('2024-01-15T11:00:00Z'),
          location: 'Downtown Office',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        },
        {
          id: 'event-2',
          title: 'Client Visit',
          start: new Date('2024-01-15T13:00:00Z'),
          end: new Date('2024-01-15T14:00:00Z'),
          location: 'Client Site',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        }
      ];

      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue(mockEvents);
      jest.spyOn(optimizer as any, 'calculateTravelTime').mockResolvedValue(45); // 45 minutes travel time

      const optimizations = await optimizer.optimizeSchedule(testUserId, timeRange);

      const gapOptimization = optimizations.find(opt => 
        opt.reasoning.some(reason => reason.includes('Travel time'))
      );
      
      expect(gapOptimization).toBeDefined();
      // Should account for 45 min travel + 10 min buffer = 55 min, leaving ~65 min usable from 2-hour gap
      expect(gapOptimization?.timesSaved).toBeLessThan(75);
      expect(gapOptimization?.timesSaved).toBeGreaterThan(50);
    });

    test('should identify routine inefficiencies', async () => {
      // Requirement: 2.4 - Routine optimization and habit formation recommendations
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T00:00:00Z'),
        end: new Date('2024-01-21T23:59:59Z') // Full week
      };

      // Mock routine patterns with inefficiencies
      jest.spyOn(optimizer as any, 'analyzeRoutinePatterns').mockResolvedValue([
        {
          type: 'errands',
          frequency: 5, // 5 trips per week - inefficient
          averageTime: new Date('2024-01-15T14:00:00Z')
        },
        {
          type: 'commute',
          frequency: 10, // Daily commute
          averageTime: new Date('2024-01-15T08:00:00Z') // Rush hour
        }
      ]);

      jest.spyOn(optimizer as any, 'isDuringRushHour').mockReturnValue(true);
      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue([]);

      const optimizations = await optimizer.optimizeSchedule(testUserId, timeRange);

      // Should identify batching opportunity for errands
      const batchingOptimization = optimizations.find(opt => 
        opt.description.includes('batched together')
      );
      expect(batchingOptimization).toBeDefined();
      expect(batchingOptimization?.optimizationType).toBe(OptimizationType.ROUTINE_OPTIMIZATION);

      // Should identify timing optimization for commute
      const timingOptimization = optimizations.find(opt => 
        opt.description.includes('rush hour')
      );
      expect(timingOptimization).toBeDefined();
      expect(timingOptimization?.optimizationType).toBe(OptimizationType.ROUTINE_OPTIMIZATION);
    });

    test('should prioritize optimizations by impact and feasibility', async () => {
      // Requirement: 2.1 - Sort by impact, feasibility, and stress reduction potential
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T08:00:00Z'),
        end: new Date('2024-01-15T18:00:00Z')
      };

      // Mock multiple optimization opportunities
      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'analyzeScheduleGaps').mockResolvedValue([
        {
          start: new Date('2024-01-15T10:00:00Z'),
          end: new Date('2024-01-15T12:00:00Z'),
          duration: 120,
          travelTimeNeeded: 15
        },
        {
          start: new Date('2024-01-15T14:00:00Z'),
          end: new Date('2024-01-15T15:00:00Z'),
          duration: 60,
          travelTimeNeeded: 10
        }
      ]);
      jest.spyOn(optimizer as any, 'identifyRoutineInefficiencies').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'identifyStressReductionOpportunities').mockResolvedValue([]);

      const optimizations = await optimizer.optimizeSchedule(testUserId, timeRange);

      expect(optimizations.length).toBeGreaterThan(1);
      
      // Should be sorted by combined score (impact * feasibility + stress reduction * 20)
      for (let i = 0; i < optimizations.length - 1; i++) {
        const currentScore = (optimizations[i].impact.timeImpact * optimizations[i].feasibilityScore) + 
                           (optimizations[i].stressReduction * 20);
        const nextScore = (optimizations[i + 1].impact.timeImpact * optimizations[i + 1].feasibilityScore) + 
                         (optimizations[i + 1].stressReduction * 20);
        expect(currentScore).toBeGreaterThanOrEqual(nextScore);
      }
    });
  });

  describe('Conflict Resolution Algorithms', () => {
    test('should suggest alternative times for scheduling conflicts', async () => {
      // Requirement: 2.2 - Conflict resolution with alternative suggestions
      const conflictingEvent: CalendarEvent = {
        id: 'new-event',
        title: 'New Meeting',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
        location: 'Conference Room',
        attendees: [testUserId],
        flexible: true,
        priority: 'medium'
      };

      const constraints: SchedulingConstraints = {
        fixedEvents: [
          {
            id: 'existing-event',
            title: 'Existing Meeting',
            start: new Date('2024-01-15T10:00:00Z'),
            end: new Date('2024-01-15T11:00:00Z'),
            location: 'Office',
            attendees: [testUserId],
            flexible: false,
            priority: 'high'
          }
        ],
        preferences: {
          preferredWakeTime: '07:00',
          preferredBedTime: '22:00',
          workingHours: [{
            start: new Date('2024-01-15T09:00:00Z'),
            end: new Date('2024-01-15T17:00:00Z')
          }],
          breakPreferences: [],
          flexibilityLevel: 'moderate'
        },
        constraints: {
          timeAvailable: {
            start: new Date('2024-01-15T09:00:00Z'),
            end: new Date('2024-01-15T17:00:00Z')
          },
          locationConstraints: [],
          resourceConstraints: [],
          socialConstraints: [],
          budgetConstraints: { maxCost: 0, currency: 'USD' },
          safetyConstraints: []
        },
        flexibility: 0.7
      };

      // Mock available time slots
      jest.spyOn(optimizer as any, 'findAvailableTimeSlots').mockResolvedValue([
        {
          start: new Date('2024-01-15T11:30:00Z'),
          end: new Date('2024-01-15T13:00:00Z')
        },
        {
          start: new Date('2024-01-15T14:00:00Z'),
          end: new Date('2024-01-15T16:00:00Z')
        }
      ]);

      jest.spyOn(optimizer as any, 'calculateTravelTimeToSlot').mockResolvedValue(10);
      jest.spyOn(optimizer as any, 'calculateTravelTimeFromSlot').mockResolvedValue(10);
      jest.spyOn(optimizer as any, 'checkForConflicts').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'calculateFlexibility').mockReturnValue(0.8);

      const alternatives = await optimizer.suggestAlternativeTimes(conflictingEvent, constraints);

      expect(alternatives).toBeDefined();
      expect(alternatives.length).toBeGreaterThan(0);
      
      // Should prioritize available slots
      expect(alternatives[0].available).toBe(true);
      
      // Should account for travel time
      const eventDuration = conflictingEvent.end.getTime() - conflictingEvent.start.getTime();
      const slotDuration = alternatives[0].end.getTime() - alternatives[0].start.getTime();
      expect(slotDuration).toBe(eventDuration);
      
      // Should be sorted by availability first, then flexibility
      for (let i = 0; i < alternatives.length - 1; i++) {
        if (alternatives[i].available !== alternatives[i + 1].available) {
          expect(alternatives[i].available).toBe(true);
        } else {
          expect(alternatives[i].flexibility).toBeGreaterThanOrEqual(alternatives[i + 1].flexibility);
        }
      }
    });

    test('should identify and predict scheduling conflicts', async () => {
      // Requirement: 2.2 - Conflict resolution with alternative suggestions
      const lookahead = 7; // 7 days
      
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          title: 'Meeting A',
          start: new Date('2024-01-16T10:00:00Z'),
          end: new Date('2024-01-16T11:30:00Z'),
          location: 'Office A',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        },
        {
          id: 'event-2',
          title: 'Meeting B',
          start: new Date('2024-01-16T11:00:00Z'), // Overlaps with Meeting A
          end: new Date('2024-01-16T12:00:00Z'),
          location: 'Office B',
          attendees: [testUserId],
          flexible: true,
          priority: 'medium'
        },
        {
          id: 'event-3',
          title: 'Client Visit',
          start: new Date('2024-01-16T13:00:00Z'),
          end: new Date('2024-01-16T14:00:00Z'),
          location: 'Client Site',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        },
        {
          id: 'event-4',
          title: 'Follow-up Meeting',
          start: new Date('2024-01-16T14:00:00Z'), // No travel time from client site
          end: new Date('2024-01-16T15:00:00Z'),
          location: 'Office A',
          attendees: [testUserId],
          flexible: true,
          priority: 'medium'
        }
      ];

      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue(mockEvents);
      jest.spyOn(optimizer as any, 'calculateTravelTime').mockImplementation((from, to) => {
        if (from === 'Client Site' && to === 'Office A') return Promise.resolve(30);
        return Promise.resolve(15);
      });

      const conflicts = await optimizer.identifyScheduleConflicts(testUserId, lookahead);

      expect(conflicts).toBeDefined();
      expect(conflicts.length).toBeGreaterThan(0);

      // Should identify direct scheduling conflict
      const schedulingConflict = conflicts.find(c => 
        c.type === 'scheduling' && c.severity === 'high'
      );
      expect(schedulingConflict).toBeDefined();
      expect(schedulingConflict?.probability).toBe(1.0);

      // Should identify travel time conflict
      const travelConflict = conflicts.find(c => 
        c.type === 'scheduling' && c.severity === 'medium'
      );
      expect(travelConflict).toBeDefined();
      expect(travelConflict?.probability).toBe(0.8);

      // Should be sorted by severity and probability
      for (let i = 0; i < conflicts.length - 1; i++) {
        const severityOrder: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
        if (conflicts[i].severity !== conflicts[i + 1].severity) {
          expect(severityOrder[conflicts[i].severity]).toBeGreaterThanOrEqual(
            severityOrder[conflicts[i + 1].severity]
          );
        } else {
          expect(conflicts[i].probability).toBeGreaterThanOrEqual(conflicts[i + 1].probability);
        }
      }
    });

    test('should provide actionable conflict resolution suggestions', async () => {
      // Requirement: 2.2 - Alternative suggestions and prevention strategies
      const lookahead = 3;
      
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          title: 'Important Meeting',
          start: new Date('2024-01-16T10:00:00Z'),
          end: new Date('2024-01-16T11:00:00Z'),
          location: 'Conference Room A',
          attendees: [testUserId],
          flexible: false,
          priority: 'high'
        },
        {
          id: 'event-2',
          title: 'Team Standup',
          start: new Date('2024-01-16T10:30:00Z'), // Overlaps
          end: new Date('2024-01-16T11:00:00Z'),
          location: 'Conference Room B',
          attendees: [testUserId],
          flexible: true,
          priority: 'medium'
        }
      ];

      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue(mockEvents);

      const conflicts = await optimizer.identifyScheduleConflicts(testUserId, lookahead);

      const conflict = conflicts[0];
      expect(conflict.suggestedResolutions).toBeDefined();
      expect(conflict.suggestedResolutions.length).toBeGreaterThan(0);
      expect(conflict.preventionStrategies).toBeDefined();
      expect(conflict.preventionStrategies.length).toBeGreaterThan(0);

      // Should suggest specific actions
      expect(conflict.suggestedResolutions.some(res => 
        res.includes('Reschedule') || res.includes('Combine')
      )).toBe(true);

      // Should provide prevention strategies
      expect(conflict.preventionStrategies.some(strategy => 
        strategy.includes('buffer time') || strategy.includes('conflict detection')
      )).toBe(true);
    });
  });

  describe('Routine Optimization Suggestions', () => {
    test('should recommend morning routine improvements', async () => {
      // Requirement: 2.4, 2.5 - Routine optimization and habit formation
      
      // Mock morning routine analysis
      jest.spyOn(optimizer as any, 'analyzeMorningRoutine').mockResolvedValue({
        steps: [
          { order: 1, activity: 'wake up', duration: 5, flexibility: 0.1 },
          { order: 2, activity: 'shower', duration: 20, flexibility: 0.3 },
          { order: 3, activity: 'breakfast', duration: 25, flexibility: 0.7 },
          { order: 4, activity: 'commute prep', duration: 15, flexibility: 0.2 }
        ],
        inefficiencies: ['breakfast takes too long', 'no prep the night before']
      });

      jest.spyOn(optimizer as any, 'optimizeMorningRoutine').mockResolvedValue({
        steps: [
          { order: 1, activity: 'wake up', duration: 5, flexibility: 0.1 },
          { order: 2, activity: 'shower', duration: 15, flexibility: 0.3 },
          { order: 3, activity: 'quick breakfast', duration: 15, flexibility: 0.5 },
          { order: 4, activity: 'commute prep', duration: 10, flexibility: 0.2 }
        ],
        benefits: ['Save 15 minutes', 'Reduce morning stress'],
        timeSavings: 15
      });

      jest.spyOn(optimizer as any, 'analyzeEveningRoutine').mockResolvedValue({
        steps: [],
        inefficiencies: []
      });

      jest.spyOn(optimizer as any, 'analyzeWeeklyRoutines').mockResolvedValue([]);

      const improvements = await optimizer.recommendRoutineImprovements(testUserId);

      expect(improvements).toBeDefined();
      expect(improvements.length).toBeGreaterThan(0);

      const morningImprovement = improvements.find(imp => 
        imp.title.includes('Morning Routine')
      );
      expect(morningImprovement).toBeDefined();
      expect(morningImprovement?.timeSavings).toBe(15);
      expect(morningImprovement?.implementationDifficulty).toBe(DifficultyLevel.EASY);
      expect(morningImprovement?.benefits).toContain('Save 15 minutes');
      expect(morningImprovement?.familyImpact.disruptionLevel).toBe('low');
    });

    test('should recommend evening routine improvements', async () => {
      // Requirement: 2.4, 2.5 - Routine optimization
      
      jest.spyOn(optimizer as any, 'analyzeMorningRoutine').mockResolvedValue({
        steps: [],
        inefficiencies: []
      });

      jest.spyOn(optimizer as any, 'analyzeEveningRoutine').mockResolvedValue({
        steps: [
          { order: 1, activity: 'dinner cleanup', duration: 30, flexibility: 0.5 },
          { order: 2, activity: 'family time', duration: 60, flexibility: 0.8 },
          { order: 3, activity: 'bedtime prep', duration: 20, flexibility: 0.3 }
        ],
        inefficiencies: ['cleanup takes too long', 'no next-day prep']
      });

      jest.spyOn(optimizer as any, 'optimizeEveningRoutine').mockResolvedValue({
        steps: [
          { order: 1, activity: 'efficient cleanup', duration: 20, flexibility: 0.5 },
          { order: 2, activity: 'family time', duration: 60, flexibility: 0.8 },
          { order: 3, activity: 'next-day prep', duration: 10, flexibility: 0.3 },
          { order: 4, activity: 'bedtime prep', duration: 15, flexibility: 0.3 }
        ],
        benefits: ['Save 5 minutes', 'Better morning preparation'],
        timeSavings: 5
      });

      jest.spyOn(optimizer as any, 'analyzeWeeklyRoutines').mockResolvedValue([]);

      const improvements = await optimizer.recommendRoutineImprovements(testUserId);

      const eveningImprovement = improvements.find(imp => 
        imp.title.includes('Evening Routine')
      );
      expect(eveningImprovement).toBeDefined();
      expect(eveningImprovement?.timeSavings).toBe(5);
      expect(eveningImprovement?.benefits).toContain('Better morning preparation');
    });

    test('should recommend weekly routine optimizations', async () => {
      // Requirement: 2.4 - Routine optimization
      
      jest.spyOn(optimizer as any, 'analyzeMorningRoutine').mockResolvedValue({
        steps: [],
        inefficiencies: []
      });

      jest.spyOn(optimizer as any, 'analyzeEveningRoutine').mockResolvedValue({
        steps: [],
        inefficiencies: []
      });

      jest.spyOn(optimizer as any, 'analyzeWeeklyRoutines').mockResolvedValue([
        {
          type: 'grocery shopping',
          steps: [
            { order: 1, activity: 'make list', duration: 10, flexibility: 0.8 },
            { order: 2, activity: 'drive to store', duration: 15, flexibility: 0.2 },
            { order: 3, activity: 'shop', duration: 45, flexibility: 0.5 },
            { order: 4, activity: 'return home', duration: 15, flexibility: 0.2 }
          ],
          optimizationPotential: 0.4,
          complexity: DifficultyLevel.INTERMEDIATE
        }
      ]);

      jest.spyOn(optimizer as any, 'optimizeWeeklyRoutine').mockResolvedValue({
        steps: [
          { order: 1, activity: 'online order', duration: 15, flexibility: 0.9 },
          { order: 2, activity: 'pickup', duration: 10, flexibility: 0.3 }
        ],
        benefits: ['Save 50 minutes per week', 'Reduce stress'],
        timeSavings: 50,
        familyImpact: {
          affectedMembers: [testUserId],
          disruptionLevel: 'low',
          adaptationTime: 14,
          overallBenefit: 4,
          benefits: ['More family time', 'Less shopping stress']
        }
      });

      const improvements = await optimizer.recommendRoutineImprovements(testUserId);

      const weeklyImprovement = improvements.find(imp => 
        imp.title.includes('grocery shopping')
      );
      expect(weeklyImprovement).toBeDefined();
      expect(weeklyImprovement?.timeSavings).toBe(50);
      expect(weeklyImprovement?.implementationDifficulty).toBe(DifficultyLevel.INTERMEDIATE);
    });

    test('should sort routine improvements by time savings', async () => {
      // Requirement: 2.5 - Prioritize suggestions by impact
      
      jest.spyOn(optimizer as any, 'analyzeMorningRoutine').mockResolvedValue({
        steps: [],
        inefficiencies: ['minor inefficiency']
      });

      jest.spyOn(optimizer as any, 'optimizeMorningRoutine').mockResolvedValue({
        steps: [],
        benefits: ['Small improvement'],
        timeSavings: 5
      });

      jest.spyOn(optimizer as any, 'analyzeEveningRoutine').mockResolvedValue({
        steps: [],
        inefficiencies: ['major inefficiency']
      });

      jest.spyOn(optimizer as any, 'optimizeEveningRoutine').mockResolvedValue({
        steps: [],
        benefits: ['Major improvement'],
        timeSavings: 20
      });

      jest.spyOn(optimizer as any, 'analyzeWeeklyRoutines').mockResolvedValue([
        {
          type: 'meal prep',
          optimizationPotential: 0.6,
          complexity: DifficultyLevel.EASY
        }
      ]);

      jest.spyOn(optimizer as any, 'optimizeWeeklyRoutine').mockResolvedValue({
        steps: [],
        benefits: ['Huge improvement'],
        timeSavings: 120,
        familyImpact: {
          affectedMembers: [testUserId],
          disruptionLevel: 'low',
          adaptationTime: 7,
          overallBenefit: 5,
          benefits: ['Much more time']
        }
      });

      const improvements = await optimizer.recommendRoutineImprovements(testUserId);

      expect(improvements.length).toBe(3);
      
      // Should be sorted by time savings (descending)
      expect(improvements[0].timeSavings).toBeGreaterThanOrEqual(improvements[1].timeSavings);
      expect(improvements[1].timeSavings).toBeGreaterThanOrEqual(improvements[2].timeSavings);
      
      // Highest savings should be meal prep (120 min)
      expect(improvements[0].timeSavings).toBe(120);
    });
  });

  describe('Time Blocking Suggestions', () => {
    test('should suggest optimal time blocks for activities', async () => {
      // Requirement: 2.1, 2.4 - Time blocking and energy optimization
      const activities: Activity[] = [
        {
          id: 'activity-1',
          name: 'Deep Work',
          category: ActivityCategory.WORK,
          duration: 120, // 2 hours
          requirements: [],
          difficulty: DifficultyLevel.HARD
        },
        {
          id: 'activity-2',
          name: 'Exercise',
          category: ActivityCategory.PHYSICAL,
          duration: 60, // 1 hour
          requirements: [],
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ];

      // Mock available time slots
      jest.spyOn(optimizer as any, 'getAvailableTimeSlots').mockResolvedValue([
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T12:00:00Z') // 3 hours available
        },
        {
          start: new Date('2024-01-15T14:00:00Z'),
          end: new Date('2024-01-15T16:00:00Z') // 2 hours available
        }
      ]);

      // Mock energy patterns
      jest.spyOn(optimizer as any, 'analyzeEnergyPatterns').mockResolvedValue([
        {
          timeOfDay: 'morning',
          startHour: 9,
          endHour: 12,
          energyLevel: 'high',
          productivityScore: 0.9,
          consistency: 0.8,
          activities: ['focused_work']
        },
        {
          timeOfDay: 'afternoon',
          startHour: 14,
          endHour: 16,
          energyLevel: 'medium',
          productivityScore: 0.6,
          consistency: 0.7,
          activities: ['exercise', 'routine_tasks']
        }
      ]);

      jest.spyOn(optimizer as any, 'recommendProductivityBasedScheduling').mockResolvedValue([
        {
          activity: activities[0],
          energyOptimizationScore: 0.9
        },
        {
          activity: activities[1],
          energyOptimizationScore: 0.7
        }
      ]);

      jest.spyOn(optimizer as any, 'findBestTimeSlotWithEnergy').mockImplementation((activity: any) => {
        if (activity.name === 'Deep Work') {
          return Promise.resolve({
            start: new Date('2024-01-15T09:00:00Z'),
            end: new Date('2024-01-15T11:00:00Z')
          });
        } else {
          return Promise.resolve({
            start: new Date('2024-01-15T14:00:00Z'),
            end: new Date('2024-01-15T15:00:00Z')
          });
        }
      });

      jest.spyOn(optimizer as any, 'generateEnhancedTimeBlockReasoning').mockResolvedValue([
        'Optimal energy period for focused work',
        'High productivity score during morning hours'
      ]);

      const suggestions = await optimizer.suggestTimeBlocking(testUserId, activities);

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBe(2);

      // Should prioritize by energy optimization score
      expect(suggestions[0].activity.name).toBe('Deep Work');
      expect(suggestions[1].activity.name).toBe('Exercise');

      // Should provide reasoning
      expect(suggestions[0].reasoning).toBeDefined();
      expect(suggestions[0].reasoning.length).toBeGreaterThan(0);

      // Should suggest appropriate time slots based on mocked times
      // The mock returns UTC times, so we check UTC hours
      expect(suggestions[0].suggestedTime.start.getUTCHours()).toBe(9); // Morning for deep work (UTC)
      expect(suggestions[1].suggestedTime.start.getUTCHours()).toBe(14); // Afternoon for exercise (UTC)
    });

    test('should provide alternative time slots', async () => {
      // Requirement: 2.2 - Alternative time suggestions
      const activities: Activity[] = [
        {
          id: 'activity-1',
          name: 'Meeting Prep',
          category: ActivityCategory.WORK,
          duration: 30,
          requirements: [],
          difficulty: DifficultyLevel.EASY
        }
      ];

      const availableSlots = [
        {
          start: new Date('2024-01-15T10:00:00Z'),
          end: new Date('2024-01-15T11:00:00Z')
        },
        {
          start: new Date('2024-01-15T14:00:00Z'),
          end: new Date('2024-01-15T15:00:00Z')
        },
        {
          start: new Date('2024-01-15T16:00:00Z'),
          end: new Date('2024-01-15T17:00:00Z')
        }
      ];

      jest.spyOn(optimizer as any, 'getAvailableTimeSlots').mockResolvedValue(availableSlots);
      jest.spyOn(optimizer as any, 'analyzeEnergyPatterns').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'recommendProductivityBasedScheduling').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'findBestTimeSlotWithEnergy').mockResolvedValue(availableSlots[0]);
      jest.spyOn(optimizer as any, 'generateEnhancedTimeBlockReasoning').mockResolvedValue(['Good time for prep work']);

      const suggestions = await optimizer.suggestTimeBlocking(testUserId, activities);

      expect(suggestions[0].alternatives).toBeDefined();
      expect(suggestions[0].alternatives.length).toBe(2); // Top 3 alternatives, excluding the best slot
      expect(suggestions[0].alternatives).not.toContain(suggestions[0].suggestedTime);
    });
  });

  describe('Schedule Efficiency Analysis', () => {
    test('should analyze overall schedule efficiency', async () => {
      // Requirement: 2.1, 2.5 - Efficiency analysis and metrics
      
      // Mock various analysis methods
      jest.spyOn(optimizer as any, 'analyzeTimeWaste').mockResolvedValue({
        inefficiencies: [
          {
            type: 'time_waste',
            description: 'Too much time between meetings',
            impact: { timeImpact: 30, stressImpact: 0.2 },
            frequency: 'daily',
            rootCause: 'Poor scheduling',
            solutions: ['Better time blocking']
          }
        ]
      });

      jest.spyOn(optimizer as any, 'analyzeSchedulingPatterns').mockResolvedValue({
        inefficiencies: [
          {
            type: 'poor_scheduling',
            description: 'Meetings scheduled during low energy periods',
            impact: { timeImpact: 15, stressImpact: 0.4 },
            frequency: 'weekly',
            rootCause: 'No energy awareness',
            solutions: ['Energy-based scheduling']
          }
        ]
      });

      jest.spyOn(optimizer as any, 'identifyBatchingOpportunities').mockResolvedValue([
        {
          type: OptimizationType.TASK_BATCHING,
          description: 'Batch similar tasks together',
          potentialBenefit: { timeImpact: 45, stressImpact: -0.3 },
          implementationEffort: DifficultyLevel.EASY,
          prerequisites: [],
          timeline: 7
        }
      ]);

      jest.spyOn(optimizer as any, 'identifyAutomationOpportunities').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'identifyRoutineOptimizations').mockResolvedValue([]);

      // Mock metrics calculations
      jest.spyOn(optimizer as any, 'calculateTimeEfficiency').mockResolvedValue(0.7);
      jest.spyOn(optimizer as any, 'calculateStressLevel').mockResolvedValue(6);
      jest.spyOn(optimizer as any, 'calculateTaskCompletionRate').mockResolvedValue(0.85);
      jest.spyOn(optimizer as any, 'calculateResourceUtilization').mockResolvedValue(0.6);
      jest.spyOn(optimizer as any, 'calculateFamilySatisfaction').mockResolvedValue(7.5);
      jest.spyOn(optimizer as any, 'calculateAutomationLevel').mockResolvedValue(0.3);

      const analysis = await optimizer.analyzeScheduleEfficiency(testUserId);

      expect(analysis).toBeDefined();
      expect(analysis.analysisId).toBeDefined();
      expect(analysis.familyId).toBe(testUserId);
      expect(analysis.timeframe).toBeDefined();
      
      // Should identify inefficiencies
      expect(analysis.inefficiencies).toBeDefined();
      expect(analysis.inefficiencies.length).toBeGreaterThan(0);
      
      // Should identify opportunities
      expect(analysis.opportunities).toBeDefined();
      expect(analysis.opportunities.length).toBeGreaterThan(0);
      
      // Should have current metrics
      expect(analysis.currentMetrics).toBeDefined();
      expect(analysis.currentMetrics.timeEfficiency).toBe(0.7);
      expect(analysis.currentMetrics.stressLevel).toBe(6);
      
      // Should project improvements
      expect(analysis.projectedImprovements).toBeDefined();
      expect(analysis.projectedImprovements.timeEfficiency).toBeGreaterThan(analysis.currentMetrics.timeEfficiency);
      expect(analysis.projectedImprovements.stressLevel).toBeLessThan(analysis.currentMetrics.stressLevel);
      
      // Should provide recommendations
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty calendar gracefully', async () => {
      // Requirement: 2.1 - Handle edge cases
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T08:00:00Z'),
        end: new Date('2024-01-15T18:00:00Z')
      };

      jest.spyOn(optimizer as any, 'getCalendarEvents').mockResolvedValue([]);

      const optimizations = await optimizer.optimizeSchedule(testUserId, timeRange);

      expect(optimizations).toBeDefined();
      expect(Array.isArray(optimizations)).toBe(true);
      // May be empty or contain general suggestions
    });

    test('should handle invalid time ranges', async () => {
      // Requirement: 2.1 - Input validation
      const invalidTimeRange: TimeRange = {
        start: new Date('2024-01-15T18:00:00Z'),
        end: new Date('2024-01-15T08:00:00Z') // End before start
      };

      await expect(optimizer.optimizeSchedule(testUserId, invalidTimeRange))
        .resolves.not.toThrow();
    });

    test('should handle missing location data', async () => {
      // Requirement: 2.2 - Handle missing data gracefully
      const event: CalendarEvent = {
        id: 'event-1',
        title: 'Meeting',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
        location: undefined, // Missing location
        attendees: [testUserId],
        flexible: true,
        priority: 'medium'
      };

      const constraints: SchedulingConstraints = {
        fixedEvents: [],
        preferences: {
          preferredWakeTime: '07:00',
          preferredBedTime: '22:00',
          workingHours: [],
          breakPreferences: [],
          flexibilityLevel: 'moderate'
        },
        constraints: {
          timeAvailable: {
            start: new Date('2024-01-15T09:00:00Z'),
            end: new Date('2024-01-15T17:00:00Z')
          },
          locationConstraints: [],
          resourceConstraints: [],
          socialConstraints: [],
          budgetConstraints: { maxCost: 0, currency: 'USD' },
          safetyConstraints: []
        },
        flexibility: 0.5
      };

      jest.spyOn(optimizer as any, 'findAvailableTimeSlots').mockResolvedValue([
        {
          start: new Date('2024-01-15T11:30:00Z'),
          end: new Date('2024-01-15T13:00:00Z')
        }
      ]);

      jest.spyOn(optimizer as any, 'calculateTravelTimeToSlot').mockResolvedValue(0);
      jest.spyOn(optimizer as any, 'calculateTravelTimeFromSlot').mockResolvedValue(0);
      jest.spyOn(optimizer as any, 'checkForConflicts').mockResolvedValue([]);
      jest.spyOn(optimizer as any, 'calculateFlexibility').mockReturnValue(0.5);

      const alternatives = await optimizer.suggestAlternativeTimes(event, constraints);

      expect(alternatives).toBeDefined();
      expect(alternatives.length).toBeGreaterThan(0);
    });
  });
});