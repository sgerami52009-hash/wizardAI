/**
 * Schedule Optimizer Engine
 * 
 * Analyzes schedules and provides intelligent optimization suggestions
 * for time management and conflict resolution.
 */

import { IScheduleOptimizer } from '../interfaces';
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
  Inefficiency,
  OptimizationOpportunity,
  HouseholdMetrics,
  ImpactAssessment,
  ImplementationStep,
  RoutineStep,
  FamilyImpactAssessment
} from '../types';
import { OptimizationType, DifficultyLevel, RecommendationType, ActivityCategory } from '../enums';

export class ScheduleOptimizer implements IScheduleOptimizer {
  
  async optimizeSchedule(userId: string, timeRange: TimeRange): Promise<ScheduleOptimization[]> {
    const optimizations: ScheduleOptimization[] = [];
    
    // Analyze current schedule for gaps and inefficiencies
    const scheduleGaps = await this.analyzeScheduleGaps(userId, timeRange);
    const routineInefficiencies = await this.identifyRoutineInefficiencies(userId, timeRange);
    
    // Analyze energy patterns and stress reduction opportunities
    const stressReductionOpportunities = await this.identifyStressReductionOpportunities(userId, timeRange);
    
    // Generate optimization suggestions for schedule gaps
    for (const gap of scheduleGaps) {
      if (gap.duration >= 30) { // Only suggest optimizations for gaps >= 30 minutes
        const optimization = await this.createGapOptimization(gap, userId);
        if (optimization) {
          optimizations.push(optimization);
        }
      }
    }
    
    // Generate optimization suggestions for routine improvements
    for (const inefficiency of routineInefficiencies) {
      const optimization = await this.createRoutineOptimization(inefficiency, userId);
      if (optimization) {
        optimizations.push(optimization);
      }
    }
    
    // Generate optimization suggestions for stress reduction and energy alignment
    for (const opportunity of stressReductionOpportunities) {
      const optimization = await this.createStressReductionOptimization(opportunity, userId);
      if (optimization) {
        optimizations.push(optimization);
      }
    }
    
    // Sort by impact, feasibility, and stress reduction potential
    return optimizations.sort((a, b) => {
      const scoreA = (a.impact.timeImpact * a.feasibilityScore) + (a.stressReduction * 20);
      const scoreB = (b.impact.timeImpact * b.feasibilityScore) + (b.stressReduction * 20);
      return scoreB - scoreA;
    });
  }

  async suggestAlternativeTimes(event: CalendarEvent, constraints: SchedulingConstraints): Promise<TimeSlot[]> {
    const alternatives: TimeSlot[] = [];
    const eventDuration = event.end.getTime() - event.start.getTime();
    
    // Get available time slots from constraints
    const availableSlots = await this.findAvailableTimeSlots(constraints, eventDuration);
    
    for (const slot of availableSlots) {
      // Calculate travel time to/from this slot
      const travelTimeBefore = await this.calculateTravelTimeToSlot(slot, constraints);
      const travelTimeAfter = await this.calculateTravelTimeFromSlot(slot, constraints);
      
      // Check if slot has enough buffer time for travel
      const requiredBuffer = travelTimeBefore + travelTimeAfter + 15; // 15 min buffer
      const slotDuration = slot.end.getTime() - slot.start.getTime();
      
      if (slotDuration >= eventDuration + requiredBuffer) {
        const conflicts = await this.checkForConflicts(slot, constraints.fixedEvents);
        
        alternatives.push({
          start: new Date(slot.start.getTime() + travelTimeBefore),
          end: new Date(slot.start.getTime() + travelTimeBefore + eventDuration),
          available: conflicts.length === 0,
          flexibility: this.calculateFlexibility(slot, constraints),
          conflicts: conflicts
        });
      }
    }
    
    // Sort by preference: available first, then by flexibility
    return alternatives.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return b.flexibility - a.flexibility;
    });
  }

  async recommendRoutineImprovements(userId: string): Promise<RoutineRecommendation[]> {
    const improvements: RoutineRecommendation[] = [];
    
    // Analyze current routines
    const morningRoutine = await this.analyzeMorningRoutine(userId);
    const eveningRoutine = await this.analyzeEveningRoutine(userId);
    const weeklyRoutines = await this.analyzeWeeklyRoutines(userId);
    
    // Generate morning routine improvements
    if (morningRoutine.inefficiencies.length > 0) {
      const optimizedMorning = await this.optimizeMorningRoutine(morningRoutine);
      improvements.push({
        id: `morning-routine-${userId}`,
        title: 'Optimize Morning Routine',
        description: 'Streamline your morning routine to save time and reduce stress',
        currentRoutine: morningRoutine.steps,
        optimizedRoutine: optimizedMorning.steps,
        benefits: optimizedMorning.benefits,
        timeSavings: optimizedMorning.timeSavings,
        implementationDifficulty: DifficultyLevel.EASY,
        familyImpact: {
          affectedMembers: [userId],
          disruptionLevel: 'low',
          adaptationTime: 7, // days
          overallBenefit: 3,
          benefits: ['Reduced morning stress', 'More time for family breakfast']
        }
      });
    }
    
    // Generate evening routine improvements
    if (eveningRoutine.inefficiencies.length > 0) {
      const optimizedEvening = await this.optimizeEveningRoutine(eveningRoutine);
      improvements.push({
        id: `evening-routine-${userId}`,
        title: 'Optimize Evening Routine',
        description: 'Improve your evening routine for better relaxation and preparation',
        currentRoutine: eveningRoutine.steps,
        optimizedRoutine: optimizedEvening.steps,
        benefits: optimizedEvening.benefits,
        timeSavings: optimizedEvening.timeSavings,
        implementationDifficulty: DifficultyLevel.EASY,
        familyImpact: {
          affectedMembers: [userId],
          disruptionLevel: 'low',
          adaptationTime: 5,
          overallBenefit: 2,
          benefits: ['Better sleep preparation', 'More family time']
        }
      });
    }
    
    // Generate weekly routine improvements
    for (const routine of weeklyRoutines) {
      if (routine.optimizationPotential > 0.3) {
        const optimized = await this.optimizeWeeklyRoutine(routine);
        improvements.push({
          id: `weekly-${routine.type}-${userId}`,
          title: `Optimize ${routine.type} Routine`,
          description: `Improve your weekly ${routine.type} routine for better efficiency`,
          currentRoutine: routine.steps,
          optimizedRoutine: optimized.steps,
          benefits: optimized.benefits,
          timeSavings: optimized.timeSavings,
          implementationDifficulty: routine.complexity,
          familyImpact: optimized.familyImpact
        });
      }
    }
    
    return improvements.sort((a, b) => b.timeSavings - a.timeSavings);
  }

  async identifyScheduleConflicts(userId: string, lookahead: number): Promise<ConflictPrediction[]> {
    const conflicts: ConflictPrediction[] = [];
    const endDate = new Date(Date.now() + lookahead * 24 * 60 * 60 * 1000);
    const timeRange = { start: new Date(), end: endDate };
    
    // Get scheduled events
    const events = await this.getCalendarEvents(userId, timeRange);
    
    // Check for direct scheduling conflicts
    for (let i = 0; i < events.length - 1; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        if (this.eventsOverlap(event1, event2)) {
          conflicts.push({
            conflictId: `overlap-${event1.id}-${event2.id}`,
            type: 'scheduling',
            severity: 'high',
            probability: 1.0,
            predictedTime: event1.start < event2.start ? event1.start : event2.start,
            affectedUsers: [userId],
            suggestedResolutions: [
              `Reschedule ${event1.title} to avoid overlap`,
              `Reschedule ${event2.title} to avoid overlap`,
              'Combine events if possible'
            ],
            preventionStrategies: [
              'Add buffer time between events',
              'Use calendar conflict detection',
              'Review schedule weekly'
            ]
          });
        }
      }
    }
    
    // Check for travel time conflicts
    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];
      
      const travelTime = await this.calculateTravelTime(currentEvent.location, nextEvent.location);
      const availableTime = (nextEvent.start.getTime() - currentEvent.end.getTime()) / (1000 * 60);
      
      if (travelTime > availableTime) {
        conflicts.push({
          conflictId: `travel-${currentEvent.id}-${nextEvent.id}`,
          type: 'scheduling',
          severity: 'medium',
          probability: 0.8,
          predictedTime: currentEvent.end,
          affectedUsers: [userId],
          suggestedResolutions: [
            `Add ${travelTime - availableTime} minutes buffer time`,
            `Move ${nextEvent.title} later`,
            'Consider remote participation if possible'
          ],
          preventionStrategies: [
            'Always account for travel time when scheduling',
            'Use location-aware calendar apps',
            'Group events by location when possible'
          ]
        });
      }
    }
    
    return conflicts.sort((a, b) => {
      if (a.severity !== b.severity) {
        const severityOrder: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return b.probability - a.probability;
    });
  }

  async suggestTimeBlocking(userId: string, activities: Activity[]): Promise<TimeBlockSuggestion[]> {
    const suggestions: TimeBlockSuggestion[] = [];
    const timeRange = { 
      start: new Date(), 
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
    };
    
    // Get available time slots and energy patterns
    const availableSlots = await this.getAvailableTimeSlots(userId, timeRange);
    const energyPatterns = await this.analyzeEnergyPatterns(userId, timeRange);
    
    // Get productivity-based recommendations
    const productivityRecommendations = await this.recommendProductivityBasedScheduling(userId, activities);
    
    for (const activity of activities) {
      const suitableSlots = availableSlots.filter(slot => {
        const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
        return slotDuration >= activity.duration + 15; // 15 min buffer
      });
      
      if (suitableSlots.length > 0) {
        // Find the best slot based on activity requirements, user patterns, and energy levels
        const bestSlot = await this.findBestTimeSlotWithEnergy(activity, suitableSlots, energyPatterns, userId);
        const alternatives = suitableSlots
          .filter(slot => slot !== bestSlot)
          .slice(0, 3); // Top 3 alternatives
        
        // Enhanced reasoning that includes energy and productivity considerations
        const reasoning = await this.generateEnhancedTimeBlockReasoning(activity, bestSlot, energyPatterns, userId);
        
        suggestions.push({
          activity,
          suggestedTime: bestSlot,
          reasoning,
          alternatives
        });
      }
    }
    
    // Sort by energy optimization score and difficulty
    return suggestions.sort((a, b) => {
      const productivityA = productivityRecommendations.find(r => r.activity.id === a.activity.id);
      const productivityB = productivityRecommendations.find(r => r.activity.id === b.activity.id);
      
      const scoreA = (productivityA?.energyOptimizationScore || 0.5) * 10;
      const scoreB = (productivityB?.energyOptimizationScore || 0.5) * 10;
      
      return scoreB - scoreA;
    });
  }

  async analyzeScheduleEfficiency(userId: string): Promise<EfficiencyAnalysis> {
    const timeRange = { 
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date() 
    };
    
    const inefficiencies: Inefficiency[] = [];
    const opportunities: OptimizationOpportunity[] = [];
    
    // Analyze time waste patterns
    const timeWasteAnalysis = await this.analyzeTimeWaste(userId, timeRange);
    inefficiencies.push(...timeWasteAnalysis.inefficiencies);
    
    // Analyze scheduling patterns
    const schedulingAnalysis = await this.analyzeSchedulingPatterns(userId, timeRange);
    inefficiencies.push(...schedulingAnalysis.inefficiencies);
    
    // Identify optimization opportunities
    opportunities.push(...await this.identifyBatchingOpportunities(userId, timeRange));
    opportunities.push(...await this.identifyAutomationOpportunities(userId, timeRange));
    opportunities.push(...await this.identifyRoutineOptimizations(userId, timeRange));
    
    // Calculate current metrics
    const currentMetrics: HouseholdMetrics = {
      timeEfficiency: await this.calculateTimeEfficiency(userId, timeRange),
      stressLevel: await this.calculateStressLevel(userId, timeRange),
      taskCompletionRate: await this.calculateTaskCompletionRate(userId, timeRange),
      resourceUtilization: await this.calculateResourceUtilization(userId, timeRange),
      familySatisfaction: await this.calculateFamilySatisfaction(userId, timeRange),
      automationLevel: await this.calculateAutomationLevel(userId, timeRange)
    };
    
    // Project improvements if optimizations are implemented
    const projectedImprovements: HouseholdMetrics = {
      timeEfficiency: Math.min(1.0, currentMetrics.timeEfficiency + 0.15),
      stressLevel: Math.max(1, currentMetrics.stressLevel - 1.5),
      taskCompletionRate: Math.min(1.0, currentMetrics.taskCompletionRate + 0.1),
      resourceUtilization: Math.min(1.0, currentMetrics.resourceUtilization + 0.12),
      familySatisfaction: Math.min(10, currentMetrics.familySatisfaction + 1.2),
      automationLevel: Math.min(1.0, currentMetrics.automationLevel + 0.2)
    };
    
    return {
      analysisId: `efficiency-${userId}-${Date.now()}`,
      familyId: userId, // Assuming single user for now
      timeframe: timeRange,
      inefficiencies,
      opportunities,
      currentMetrics,
      projectedImprovements,
      recommendations: [
        'Batch similar activities together to reduce context switching',
        'Use time blocking for focused work periods',
        'Automate recurring tasks where possible',
        'Review and optimize weekly routines',
        'Add buffer time between appointments for travel'
      ]
    };
  }

  // Helper methods and supporting functionality

  /**
   * Analyzes user's energy patterns and productivity cycles
   */
  private async analyzeEnergyPatterns(userId: string, timeRange: TimeRange): Promise<EnergyPattern[]> {
    // Mock analysis - in real implementation, would analyze historical data and user feedback
    return [
      {
        timeOfDay: 'morning',
        startHour: 6,
        endHour: 10,
        energyLevel: 'high',
        productivityScore: 0.9,
        consistency: 0.8,
        activities: ['exercise', 'focused_work', 'planning']
      },
      {
        timeOfDay: 'midday',
        startHour: 10,
        endHour: 14,
        energyLevel: 'medium',
        productivityScore: 0.7,
        consistency: 0.6,
        activities: ['meetings', 'collaborative_work', 'errands']
      },
      {
        timeOfDay: 'afternoon',
        startHour: 14,
        endHour: 17,
        energyLevel: 'low',
        productivityScore: 0.4,
        consistency: 0.5,
        activities: ['routine_tasks', 'administrative_work']
      },
      {
        timeOfDay: 'evening',
        startHour: 17,
        endHour: 21,
        energyLevel: 'medium',
        productivityScore: 0.6,
        consistency: 0.7,
        activities: ['family_time', 'relaxation', 'light_exercise']
      }
    ];
  }

  /**
   * Recommends optimal time slots based on energy and productivity patterns
   */
  private async recommendProductivityBasedScheduling(userId: string, activities: Activity[]): Promise<ProductivityRecommendation[]> {
    const energyPatterns = await this.analyzeEnergyPatterns(userId, { start: new Date(), end: new Date() });
    const recommendations: ProductivityRecommendation[] = [];

    for (const activity of activities) {
      const bestPattern = this.findBestEnergyPatternForActivity(activity, energyPatterns);
      
      if (bestPattern) {
        recommendations.push({
          activity,
          recommendedTimeSlot: {
            startHour: bestPattern.startHour,
            endHour: Math.min(bestPattern.endHour, bestPattern.startHour + Math.ceil(activity.duration / 60)),
            energyLevel: bestPattern.energyLevel,
            productivityScore: bestPattern.productivityScore
          },
          reasoning: [
            `Your ${bestPattern.energyLevel} energy period (${bestPattern.startHour}:00-${bestPattern.endHour}:00)`,
            `Productivity score: ${Math.round(bestPattern.productivityScore * 100)}%`,
            `Consistency: ${Math.round(bestPattern.consistency * 100)}%`,
            `Optimal for ${activity.category} activities`
          ],
          stressReductionScore: this.calculateStressReduction(activity, bestPattern),
          energyOptimizationScore: bestPattern.productivityScore * bestPattern.consistency
        });
      }
    }

    return recommendations.sort((a, b) => b.energyOptimizationScore - a.energyOptimizationScore);
  }

  /**
   * Identifies stress reduction opportunities in scheduling
   */
  private async identifyStressReductionOpportunities(userId: string, timeRange: TimeRange): Promise<StressReductionOpportunity[]> {
    const opportunities: StressReductionOpportunity[] = [];
    const energyPatterns = await this.analyzeEnergyPatterns(userId, timeRange);
    const events = await this.getCalendarEvents(userId, timeRange);

    // Identify energy-activity mismatches
    for (const event of events) {
      const eventHour = event.start.getHours();
      const currentPattern = energyPatterns.find(p => eventHour >= p.startHour && eventHour < p.endHour);
      
      if (currentPattern) {
        const activityType = this.categorizeEventActivity(event);
        const isOptimalTiming = this.isOptimalTimingForActivity(activityType, currentPattern);
        
        if (!isOptimalTiming) {
          const betterPattern = this.findBestEnergyPatternForActivityType(activityType, energyPatterns);
          
          if (betterPattern && betterPattern !== currentPattern) {
            opportunities.push({
              type: 'energy_mismatch',
              description: `${event.title} scheduled during ${currentPattern.energyLevel} energy period`,
              currentStressLevel: this.calculateEventStressLevel(event, currentPattern),
              potentialStressReduction: this.calculatePotentialStressReduction(currentPattern, betterPattern),
              suggestedTimeSlot: {
                startHour: betterPattern.startHour,
                endHour: betterPattern.endHour,
                energyLevel: betterPattern.energyLevel,
                productivityScore: betterPattern.productivityScore
              },
              implementation: `Move ${event.title} to ${betterPattern.startHour}:00-${betterPattern.endHour}:00 (${betterPattern.energyLevel} energy period)`,
              priority: this.calculateOpportunityPriority(currentPattern, betterPattern)
            });
          }
        }
      }
    }

    // Identify buffer time needs
    const bufferOpportunities = await this.identifyBufferTimeNeeds(events, energyPatterns);
    opportunities.push(...bufferOpportunities);

    // Identify batch scheduling opportunities
    const batchOpportunities = await this.identifyBatchSchedulingOpportunities(events, energyPatterns);
    opportunities.push(...batchOpportunities);

    return opportunities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyzes schedule for gaps that could be optimized
   */
  private async analyzeScheduleGaps(userId: string, timeRange: TimeRange): Promise<ScheduleGap[]> {
    // Mock calendar events - in real implementation, this would fetch from calendar service
    const events = await this.getCalendarEvents(userId, timeRange);
    const gaps: ScheduleGap[] = [];
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // Find gaps between events
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEvent = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];
      
      const gapStart = currentEvent.end;
      const gapEnd = nextEvent.start;
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60); // minutes
      
      if (gapDuration > 15) { // Only consider gaps > 15 minutes
        gaps.push({
          start: gapStart,
          end: gapEnd,
          duration: gapDuration,
          beforeEvent: currentEvent,
          afterEvent: nextEvent,
          travelTimeNeeded: await this.calculateTravelTime(currentEvent.location, nextEvent.location)
        });
      }
    }
    
    return gaps;
  }

  /**
   * Identifies routine inefficiencies in the schedule
   */
  private async identifyRoutineInefficiencies(userId: string, timeRange: TimeRange): Promise<RoutineInefficiency[]> {
    const inefficiencies: RoutineInefficiency[] = [];
    
    // Analyze common patterns and identify inefficiencies
    const routinePatterns = await this.analyzeRoutinePatterns(userId, timeRange);
    
    for (const pattern of routinePatterns) {
      // Check for batching opportunities
      if (pattern.type === 'errands' && pattern.frequency > 3) {
        inefficiencies.push({
          type: 'batching_opportunity',
          description: `Multiple ${pattern.type} trips could be batched together`,
          impact: { timeImpact: pattern.frequency * 15, stressImpact: 0.3 },
          frequency: pattern.frequency,
          solution: `Batch ${pattern.type} into 1-2 trips per week`
        });
      }
      
      // Check for poor timing
      if (pattern.type === 'commute' && this.isDuringRushHour(pattern.averageTime)) {
        inefficiencies.push({
          type: 'timing_optimization',
          description: 'Commute during rush hour increases travel time',
          impact: { timeImpact: 20, stressImpact: 0.4 },
          frequency: pattern.frequency,
          solution: 'Adjust schedule to avoid peak traffic hours'
        });
      }
    }
    
    return inefficiencies;
  }

  /**
   * Creates optimization suggestion for a schedule gap
   */
  private async createGapOptimization(gap: ScheduleGap, userId: string): Promise<ScheduleOptimization | null> {
    const usableTime = gap.duration - gap.travelTimeNeeded - 10; // 10 min buffer
    
    if (usableTime < 15) return null;
    
    let optimizationType: OptimizationType;
    let title: string;
    let description: string;
    
    if (usableTime >= 60) {
      optimizationType = OptimizationType.TIME_BLOCKING;
      title = 'Productive Time Block';
      description = `Use this ${Math.round(usableTime)} minute gap for focused work or personal tasks`;
    } else if (usableTime >= 30) {
      optimizationType = OptimizationType.TASK_BATCHING;
      title = 'Quick Task Batch';
      description = `Perfect time slot for quick tasks like emails or calls (${Math.round(usableTime)} minutes)`;
    } else {
      optimizationType = OptimizationType.ROUTINE_OPTIMIZATION;
      title = 'Buffer Time';
      description = `Keep as buffer time for travel and transitions (${Math.round(usableTime)} minutes)`;
    }
    
    return {
      id: `gap-opt-${gap.start.getTime()}`,
      type: RecommendationType.SCHEDULE,
      title,
      description,
      confidence: 0.8,
      reasoning: [
        `${Math.round(usableTime)} minutes available between appointments`,
        `Travel time of ${gap.travelTimeNeeded} minutes already accounted for`,
        'Optimal for maintaining schedule flow'
      ],
      actionable: true,
      integrationActions: [{
        system: 'scheduling',
        action: 'suggest_time_block',
        parameters: { start: gap.start, duration: usableTime }
      }],
      expiresAt: new Date(gap.start.getTime() + 24 * 60 * 60 * 1000),
      metadata: {
        generatedAt: new Date(),
        userId,
        contextId: `gap-${gap.start.getTime()}`,
        engineVersion: '1.0.0',
        safetyValidated: true,
        privacyCompliant: true
      },
      optimizationType,
      impact: {
        timeImpact: usableTime,
        stressImpact: -0.2,
        costImpact: 0,
        familyImpact: 0.1,
        healthImpact: 0.1,
        qualityImpact: 0.3
      },
      implementation: [{
        order: 1,
        description: `Block ${Math.round(usableTime)} minutes in calendar`,
        estimatedTime: 2,
        difficulty: DifficultyLevel.EASY,
        dependencies: [],
        resources: []
      }],
      timesSaved: usableTime,
      stressReduction: 0.2,
      feasibilityScore: 0.9
    };
  }

  /**
   * Creates optimization suggestion for stress reduction opportunity
   */
  private async createStressReductionOptimization(opportunity: StressReductionOpportunity, userId: string): Promise<ScheduleOptimization | null> {
    let optimizationType: OptimizationType;
    
    switch (opportunity.type) {
      case 'energy_mismatch':
        optimizationType = OptimizationType.STRESS_REDUCTION;
        break;
      case 'insufficient_buffer':
        optimizationType = OptimizationType.TIME_SAVING;
        break;
      case 'batch_scheduling':
        optimizationType = OptimizationType.EFFICIENCY;
        break;
      default:
        optimizationType = OptimizationType.STRESS_REDUCTION;
    }
    
    return {
      id: `stress-reduction-${Date.now()}`,
      type: RecommendationType.SCHEDULE,
      title: `Reduce Stress: ${opportunity.type.replace('_', ' ')}`,
      description: opportunity.description,
      confidence: 0.8,
      reasoning: [
        `Current stress level: ${Math.round(opportunity.currentStressLevel * 100)}%`,
        `Potential stress reduction: ${Math.round(opportunity.potentialStressReduction * 100)}%`,
        `Optimal timing: ${opportunity.suggestedTimeSlot.startHour}:00-${opportunity.suggestedTimeSlot.endHour}:00`,
        `Energy level: ${opportunity.suggestedTimeSlot.energyLevel}`
      ],
      actionable: true,
      integrationActions: [{
        system: 'scheduling',
        action: 'suggest_energy_optimization',
        parameters: { 
          type: opportunity.type,
          timeSlot: opportunity.suggestedTimeSlot,
          implementation: opportunity.implementation
        }
      }],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: {
        generatedAt: new Date(),
        userId,
        contextId: `stress-reduction-${opportunity.type}`,
        engineVersion: '1.0.0',
        safetyValidated: true,
        privacyCompliant: true
      },
      optimizationType,
      impact: {
        timeImpact: opportunity.potentialStressReduction * 30, // Convert to minutes saved
        stressImpact: -opportunity.potentialStressReduction * 5, // Negative = stress reduction
        costImpact: 0,
        familyImpact: opportunity.potentialStressReduction * 2,
        healthImpact: opportunity.potentialStressReduction * 3,
        qualityImpact: opportunity.potentialStressReduction * 0.8
      },
      implementation: [{
        order: 1,
        description: opportunity.implementation,
        estimatedTime: 15,
        difficulty: DifficultyLevel.EASY,
        dependencies: [],
        resources: []
      }],
      timesSaved: opportunity.potentialStressReduction * 30,
      stressReduction: opportunity.potentialStressReduction,
      feasibilityScore: Math.max(0.1, 1.0 - (opportunity.priority / 10))
    };
  }

  /**
   * Creates optimization suggestion for routine inefficiency
   */
  private async createRoutineOptimization(inefficiency: RoutineInefficiency, userId: string): Promise<ScheduleOptimization | null> {
    return {
      id: `routine-opt-${Date.now()}`,
      type: RecommendationType.SCHEDULE,
      title: `Optimize ${inefficiency.type}`,
      description: inefficiency.description,
      confidence: 0.7,
      reasoning: [
        `Current approach wastes ${inefficiency.impact.timeImpact} minutes`,
        `Occurs ${inefficiency.frequency} times per week`,
        inefficiency.solution
      ],
      actionable: true,
      integrationActions: [{
        system: 'scheduling',
        action: 'suggest_routine_change',
        parameters: { type: inefficiency.type, solution: inefficiency.solution }
      }],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: {
        generatedAt: new Date(),
        userId,
        contextId: `routine-${inefficiency.type}`,
        engineVersion: '1.0.0',
        safetyValidated: true,
        privacyCompliant: true
      },
      optimizationType: OptimizationType.ROUTINE_OPTIMIZATION,
      impact: {
        timeImpact: inefficiency.impact.timeImpact * inefficiency.frequency,
        stressImpact: -inefficiency.impact.stressImpact,
        costImpact: 0,
        familyImpact: 0.2,
        healthImpact: 0.1,
        qualityImpact: 0.2
      },
      implementation: [{
        order: 1,
        description: inefficiency.solution,
        estimatedTime: 30,
        difficulty: DifficultyLevel.EASY,
        dependencies: [],
        resources: []
      }],
      timesSaved: inefficiency.impact.timeImpact * inefficiency.frequency,
      stressReduction: inefficiency.impact.stressImpact,
      feasibilityScore: 0.8
    };
  }

  /**
   * Mock calendar events - in real implementation, would integrate with calendar service
   */
  private async getCalendarEvents(userId: string, timeRange: TimeRange): Promise<CalendarEvent[]> {
    // Mock data for demonstration
    return [
      {
        id: 'work-meeting-1',
        title: 'Team Meeting',
        start: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        end: new Date(Date.now() + 3 * 60 * 60 * 1000),   // 3 hours from now
        location: 'work',
        attendees: [userId, 'colleague1'],
        flexible: false,
        priority: 'high'
      },
      {
        id: 'gym-session',
        title: 'Gym Workout',
        start: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
        end: new Date(Date.now() + 6 * 60 * 60 * 1000),   // 6 hours from now
        location: 'gym',
        attendees: [userId],
        flexible: true,
        priority: 'medium'
      }
    ];
  }

  /**
   * Calculates travel time between two locations
   */
  private async calculateTravelTime(fromLocation?: string, toLocation?: string): Promise<number> {
    if (!fromLocation || !toLocation || fromLocation === toLocation) {
      return 0;
    }
    
    // Simple heuristic - in real implementation, would use mapping service
    const locationTypes: Record<string, { x: number; y: number }> = {
      'home': { x: 0, y: 0 },
      'work': { x: 10, y: 5 },
      'school': { x: -5, y: 8 },
      'gym': { x: 3, y: -4 },
      'store': { x: -2, y: 3 }
    };
    
    const from = locationTypes[fromLocation.toLowerCase()] || { x: 0, y: 0 };
    const to = locationTypes[toLocation.toLowerCase()] || { x: 0, y: 0 };
    
    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    return Math.max(5, Math.round(distance * 3)); // Minimum 5 minutes, ~3 minutes per unit
  }

  /**
   * Analyzes routine patterns to identify optimization opportunities
   */
  private async analyzeRoutinePatterns(userId: string, timeRange: TimeRange): Promise<RoutinePattern[]> {
    // Mock analysis - in real implementation, would analyze historical data
    return [
      {
        type: 'errands',
        frequency: 5, // times per week
        averageTime: new Date(Date.now() + 14 * 60 * 60 * 1000), // 2 PM
        duration: 45,
        locations: ['store', 'bank', 'pharmacy']
      },
      {
        type: 'commute',
        frequency: 10, // times per week (to/from work)
        averageTime: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 AM
        duration: 30,
        locations: ['home', 'work']
      }
    ];
  }

  /**
   * Checks if a time falls during rush hour
   */
  private isDuringRushHour(time: Date): boolean {
    const hour = time.getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  }

  /**
   * Finds available time slots within constraints
   */
  private async findAvailableTimeSlots(constraints: SchedulingConstraints, duration: number): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const workingHours = constraints.preferences.workingHours || [
      { start: new Date(2024, 0, 1, 9, 0), end: new Date(2024, 0, 1, 17, 0) }
    ];
    
    // Generate time slots based on working hours and fixed events
    for (const workingPeriod of workingHours) {
      let currentTime = new Date(workingPeriod.start);
      const endTime = new Date(workingPeriod.end);
      
      while (currentTime.getTime() + duration <= endTime.getTime()) {
        const slotEnd = new Date(currentTime.getTime() + duration);
        const conflicts = await this.checkForConflicts(
          { start: currentTime, end: slotEnd, available: true, flexibility: 0.5, conflicts: [] },
          constraints.fixedEvents
        );
        
        if (conflicts.length === 0) {
          slots.push({
            start: new Date(currentTime),
            end: slotEnd,
            available: true,
            flexibility: 0.8,
            conflicts: []
          });
        }
        
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // 30-minute increments
      }
    }
    
    return slots;
  }

  /**
   * Checks for conflicts with existing events
   */
  private async checkForConflicts(slot: TimeSlot, fixedEvents: CalendarEvent[]): Promise<string[]> {
    const conflicts: string[] = [];
    
    for (const event of fixedEvents) {
      if (this.timeRangesOverlap(
        { start: slot.start, end: slot.end },
        { start: event.start, end: event.end }
      )) {
        conflicts.push(event.id);
      }
    }
    
    return conflicts;
  }

  /**
   * Checks if two time ranges overlap
   */
  private timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
    return range1.start < range2.end && range2.start < range1.end;
  }

  /**
   * Checks if two events overlap
   */
  private eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return this.timeRangesOverlap(
      { start: event1.start, end: event1.end },
      { start: event2.start, end: event2.end }
    );
  }

  /**
   * Calculates flexibility score for a time slot
   */
  private calculateFlexibility(slot: TimeSlot, constraints: SchedulingConstraints): number {
    // Higher flexibility for slots with more buffer time and fewer constraints
    let flexibility = 0.5;
    
    // Increase flexibility if slot is during preferred hours
    const hour = slot.start.getHours();
    if (hour >= 9 && hour <= 17) flexibility += 0.3;
    
    // Decrease flexibility if close to fixed events
    const bufferTime = this.getMinimumBufferTime(slot, constraints.fixedEvents);
    if (bufferTime > 60) flexibility += 0.2;
    else if (bufferTime < 30) flexibility -= 0.2;
    
    return Math.max(0, Math.min(1, flexibility));
  }

  /**
   * Gets minimum buffer time around a slot
   */
  private getMinimumBufferTime(slot: TimeSlot, fixedEvents: CalendarEvent[]): number {
    let minBuffer = Infinity;
    
    for (const event of fixedEvents) {
      const bufferBefore = slot.start.getTime() - event.end.getTime();
      const bufferAfter = event.start.getTime() - slot.end.getTime();
      
      if (bufferBefore > 0) minBuffer = Math.min(minBuffer, bufferBefore / (1000 * 60));
      if (bufferAfter > 0) minBuffer = Math.min(minBuffer, bufferAfter / (1000 * 60));
    }
    
    return minBuffer === Infinity ? 120 : minBuffer; // Default 2 hours if no nearby events
  }

  // Additional helper methods for routine analysis and optimization
  
  private async calculateTravelTimeToSlot(slot: TimeSlot, constraints: SchedulingConstraints): Promise<number> {
    // Find the event before this slot
    const eventsBefore = constraints.fixedEvents.filter(e => e.end <= slot.start);
    if (eventsBefore.length === 0) return 0;
    
    const lastEvent = eventsBefore.sort((a, b) => b.end.getTime() - a.end.getTime())[0];
    return this.calculateTravelTime(lastEvent.location, 'proposed-location');
  }

  private async calculateTravelTimeFromSlot(slot: TimeSlot, constraints: SchedulingConstraints): Promise<number> {
    // Find the event after this slot
    const eventsAfter = constraints.fixedEvents.filter(e => e.start >= slot.end);
    if (eventsAfter.length === 0) return 0;
    
    const nextEvent = eventsAfter.sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    return this.calculateTravelTime('proposed-location', nextEvent.location);
  }

  private async getAvailableTimeSlots(userId: string, timeRange: TimeRange): Promise<TimeSlot[]> {
    const events = await this.getCalendarEvents(userId, timeRange);
    const slots: TimeSlot[] = [];
    
    // Generate slots between events
    const sortedEvents = events.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEvent = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];
      
      const gapStart = currentEvent.end;
      const gapEnd = nextEvent.start;
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60);
      
      if (gapDuration >= 30) { // Minimum 30-minute slots
        slots.push({
          start: gapStart,
          end: gapEnd,
          available: true,
          flexibility: 0.7,
          conflicts: []
        });
      }
    }
    
    return slots;
  }

  private async findBestTimeSlotWithEnergy(activity: Activity, slots: TimeSlot[], energyPatterns: EnergyPattern[], userId: string): Promise<TimeSlot> {
    // Score slots based on activity requirements, user patterns, and energy levels
    const scoredSlots = await Promise.all(slots.map(async slot => {
      let score = slot.flexibility;
      
      // Get energy pattern for this time slot
      const slotHour = slot.start.getHours();
      const energyPattern = energyPatterns.find(p => slotHour >= p.startHour && slotHour < p.endHour);
      
      if (energyPattern) {
        // Boost score based on energy-activity match
        const energyMatch = this.getEnergyMatchScore(activity, energyPattern);
        score += energyMatch * 0.4;
        
        // Boost score based on productivity score
        score += energyPattern.productivityScore * 0.3;
        
        // Boost score based on consistency
        score += energyPattern.consistency * 0.2;
        
        // Check if activity type matches pattern's optimal activities
        const activityType = this.getActivityTypeFromCategory(activity.category);
        if (energyPattern.activities.includes(activityType)) {
          score += 0.3;
        }
      }
      
      // Original activity category timing preferences
      const hour = slot.start.getHours();
      if (activity.category === ActivityCategory.EXERCISE && (hour >= 6 && hour <= 8 || hour >= 17 && hour <= 19)) {
        score += 0.2;
      } else if (activity.category === ActivityCategory.WORK && hour >= 9 && hour <= 17) {
        score += 0.2;
      }
      
      // Prefer longer slots for complex activities
      const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
      if (activity.difficulty === DifficultyLevel.HARD && slotDuration > activity.duration * 1.5) {
        score += 0.1;
      }
      
      return { slot, score };
    }));
    
    return scoredSlots.sort((a, b) => b.score - a.score)[0].slot;
  }

  private async findBestTimeSlot(activity: Activity, slots: TimeSlot[], userId: string): Promise<TimeSlot> {
    // Score slots based on activity requirements and user patterns
    const scoredSlots = await Promise.all(slots.map(async slot => {
      let score = slot.flexibility;
      
      // Prefer slots that match activity category timing preferences
      const hour = slot.start.getHours();
      if (activity.category === ActivityCategory.EXERCISE && (hour >= 6 && hour <= 8 || hour >= 17 && hour <= 19)) {
        score += 0.3;
      } else if (activity.category === ActivityCategory.WORK && hour >= 9 && hour <= 17) {
        score += 0.3;
      }
      
      // Prefer longer slots for complex activities
      const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
      if (activity.difficulty === DifficultyLevel.HARD && slotDuration > activity.duration * 1.5) {
        score += 0.2;
      }
      
      return { slot, score };
    }));
    
    return scoredSlots.sort((a, b) => b.score - a.score)[0].slot;
  }

  private async generateEnhancedTimeBlockReasoning(activity: Activity, slot: TimeSlot, energyPatterns: EnergyPattern[], userId: string): Promise<string[]> {
    const reasoning: string[] = [];
    const hour = slot.start.getHours();
    const duration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
    
    reasoning.push(`${Math.round(duration)} minutes available for ${activity.name}`);
    
    // Find energy pattern for this time slot
    const energyPattern = energyPatterns.find(p => hour >= p.startHour && hour < p.endHour);
    
    if (energyPattern) {
      reasoning.push(`${energyPattern.energyLevel.charAt(0).toUpperCase() + energyPattern.energyLevel.slice(1)} energy period (${energyPattern.startHour}:00-${energyPattern.endHour}:00)`);
      reasoning.push(`Productivity score: ${Math.round(energyPattern.productivityScore * 100)}%`);
      
      const activityType = this.getActivityTypeFromCategory(activity.category);
      if (energyPattern.activities.includes(activityType)) {
        reasoning.push(`Optimal time for ${activityType.replace('_', ' ')} activities`);
      }
      
      const energyMatch = this.getEnergyMatchScore(activity, energyPattern);
      if (energyMatch > 0.7) {
        reasoning.push('Excellent energy-activity match');
      } else if (energyMatch > 0.5) {
        reasoning.push('Good energy-activity match');
      }
    }
    
    // Original category-based reasoning
    if (activity.category === ActivityCategory.EXERCISE && (hour >= 6 && hour <= 8)) {
      reasoning.push('Morning time slot ideal for exercise and energy boost');
    } else if (activity.category === ActivityCategory.WORK && hour >= 9 && hour <= 11) {
      reasoning.push('Morning hours optimal for focused work tasks');
    }
    
    if (duration > activity.duration * 1.2) {
      reasoning.push('Extra time available for preparation and wrap-up');
    }
    
    return reasoning;
  }

  private async generateTimeBlockReasoning(activity: Activity, slot: TimeSlot, userId: string): Promise<string[]> {
    const reasoning: string[] = [];
    const hour = slot.start.getHours();
    const duration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
    
    reasoning.push(`${Math.round(duration)} minutes available for ${activity.name}`);
    
    if (activity.category === ActivityCategory.EXERCISE && (hour >= 6 && hour <= 8)) {
      reasoning.push('Morning time slot ideal for exercise and energy boost');
    } else if (activity.category === ActivityCategory.WORK && hour >= 9 && hour <= 11) {
      reasoning.push('Morning hours optimal for focused work tasks');
    }
    
    if (duration > activity.duration * 1.2) {
      reasoning.push('Extra time available for preparation and wrap-up');
    }
    
    return reasoning;
  }

  // Energy and productivity analysis helper methods

  /**
   * Finds the best energy pattern for a specific activity
   */
  private findBestEnergyPatternForActivity(activity: Activity, patterns: EnergyPattern[]): EnergyPattern | null {
    const activityType = this.getActivityTypeFromCategory(activity.category);
    return this.findBestEnergyPatternForActivityType(activityType, patterns);
  }

  /**
   * Finds the best energy pattern for a specific activity type
   */
  private findBestEnergyPatternForActivityType(activityType: string, patterns: EnergyPattern[]): EnergyPattern | null {
    // Score patterns based on how well they match the activity type
    const scoredPatterns = patterns.map(pattern => {
      let score = pattern.productivityScore * pattern.consistency;
      
      // Boost score if activity type matches pattern's optimal activities
      if (pattern.activities.includes(activityType)) {
        score += 0.3;
      }
      
      // Adjust score based on energy requirements
      if (activityType === 'focused_work' && pattern.energyLevel === 'high') {
        score += 0.2;
      } else if (activityType === 'routine_tasks' && pattern.energyLevel === 'low') {
        score += 0.1;
      } else if (activityType === 'meetings' && pattern.energyLevel === 'medium') {
        score += 0.15;
      }
      
      return { pattern, score };
    });
    
    const best = scoredPatterns.sort((a, b) => b.score - a.score)[0];
    return best ? best.pattern : null;
  }

  /**
   * Calculates stress reduction score for activity-pattern match
   */
  private calculateStressReduction(activity: Activity, pattern: EnergyPattern): number {
    const activityType = this.getActivityTypeFromCategory(activity.category);
    const isOptimal = pattern.activities.includes(activityType);
    const energyMatch = this.getEnergyMatchScore(activity, pattern);
    
    return (isOptimal ? 0.4 : 0) + (energyMatch * 0.6);
  }

  /**
   * Gets activity type from activity category
   */
  private getActivityTypeFromCategory(category: ActivityCategory): string {
    const categoryMap: Record<ActivityCategory, string> = {
      [ActivityCategory.WORK]: 'focused_work',
      [ActivityCategory.EXERCISE]: 'exercise',
      [ActivityCategory.SOCIAL]: 'meetings',
      [ActivityCategory.HOUSEHOLD]: 'routine_tasks',
      [ActivityCategory.RELAXATION]: 'relaxation',
      [ActivityCategory.FAMILY]: 'family_time',
      [ActivityCategory.EDUCATIONAL]: 'focused_work',
      [ActivityCategory.CREATIVE]: 'focused_work',
      [ActivityCategory.PHYSICAL]: 'exercise',
      [ActivityCategory.ENTERTAINMENT]: 'relaxation',
      [ActivityCategory.OUTDOOR]: 'exercise',
      [ActivityCategory.INDOOR]: 'routine_tasks',
      [ActivityCategory.SOLO]: 'focused_work',
      [ActivityCategory.SKILL_BUILDING]: 'focused_work',
      [ActivityCategory.HEALTH]: 'exercise',
      [ActivityCategory.CULTURAL]: 'relaxation',
      [ActivityCategory.VOLUNTEER]: 'meetings'
    };
    
    return categoryMap[category] || 'routine_tasks';
  }

  /**
   * Calculates energy match score between activity and pattern
   */
  private getEnergyMatchScore(activity: Activity, pattern: EnergyPattern): number {
    // High difficulty activities need high energy
    if (activity.difficulty === DifficultyLevel.HARD || activity.difficulty === DifficultyLevel.EXPERT) {
      return pattern.energyLevel === 'high' ? 1.0 : pattern.energyLevel === 'medium' ? 0.6 : 0.2;
    }
    
    // Medium difficulty activities work well with medium energy
    if (activity.difficulty === DifficultyLevel.MEDIUM || activity.difficulty === DifficultyLevel.INTERMEDIATE) {
      return pattern.energyLevel === 'medium' ? 1.0 : pattern.energyLevel === 'high' ? 0.8 : 0.4;
    }
    
    // Easy activities can work with any energy level
    return pattern.energyLevel === 'low' ? 1.0 : pattern.energyLevel === 'medium' ? 0.9 : 0.7;
  }

  /**
   * Categorizes calendar event into activity type
   */
  private categorizeEventActivity(event: CalendarEvent): string {
    const title = event.title.toLowerCase();
    
    if (title.includes('meeting') || title.includes('call') || title.includes('discussion')) {
      return 'meetings';
    } else if (title.includes('workout') || title.includes('gym') || title.includes('exercise')) {
      return 'exercise';
    } else if (title.includes('focus') || title.includes('work') || title.includes('project')) {
      return 'focused_work';
    } else if (title.includes('admin') || title.includes('email') || title.includes('routine')) {
      return 'routine_tasks';
    } else if (title.includes('family') || title.includes('dinner') || title.includes('personal')) {
      return 'family_time';
    } else if (title.includes('break') || title.includes('lunch') || title.includes('relax')) {
      return 'relaxation';
    }
    
    return 'routine_tasks'; // Default
  }

  /**
   * Checks if timing is optimal for activity type
   */
  private isOptimalTimingForActivity(activityType: string, pattern: EnergyPattern): boolean {
    return pattern.activities.includes(activityType);
  }

  /**
   * Calculates stress level for event in given pattern
   */
  private calculateEventStressLevel(event: CalendarEvent, pattern: EnergyPattern): number {
    const activityType = this.categorizeEventActivity(event);
    const isOptimal = pattern.activities.includes(activityType);
    const energyMismatch = this.getEnergyMismatchScore(activityType, pattern);
    
    // Base stress level (0-1 scale)
    let stressLevel = 0.3;
    
    if (!isOptimal) stressLevel += 0.3;
    stressLevel += energyMismatch * 0.4;
    
    return Math.min(1.0, stressLevel);
  }

  /**
   * Calculates potential stress reduction from moving to better pattern
   */
  private calculatePotentialStressReduction(currentPattern: EnergyPattern, betterPattern: EnergyPattern): number {
    const currentScore = currentPattern.productivityScore * currentPattern.consistency;
    const betterScore = betterPattern.productivityScore * betterPattern.consistency;
    
    return Math.max(0, (betterScore - currentScore) * 0.8);
  }

  /**
   * Gets energy mismatch score for activity type and pattern
   */
  private getEnergyMismatchScore(activityType: string, pattern: EnergyPattern): number {
    const energyRequirements: Record<string, string> = {
      'focused_work': 'high',
      'exercise': 'high',
      'meetings': 'medium',
      'routine_tasks': 'low',
      'family_time': 'medium',
      'relaxation': 'low'
    };
    
    const requiredEnergy = energyRequirements[activityType] || 'medium';
    
    if (requiredEnergy === pattern.energyLevel) return 0;
    if (requiredEnergy === 'high' && pattern.energyLevel === 'medium') return 0.3;
    if (requiredEnergy === 'high' && pattern.energyLevel === 'low') return 0.7;
    if (requiredEnergy === 'medium' && pattern.energyLevel === 'high') return 0.2;
    if (requiredEnergy === 'medium' && pattern.energyLevel === 'low') return 0.4;
    if (requiredEnergy === 'low' && pattern.energyLevel === 'high') return 0.1;
    if (requiredEnergy === 'low' && pattern.energyLevel === 'medium') return 0.1;
    
    return 0.5; // Default mismatch
  }

  /**
   * Calculates priority for stress reduction opportunity
   */
  private calculateOpportunityPriority(currentPattern: EnergyPattern, betterPattern: EnergyPattern): number {
    const improvementPotential = betterPattern.productivityScore - currentPattern.productivityScore;
    const consistencyFactor = betterPattern.consistency;
    
    return improvementPotential * consistencyFactor * 10; // Scale to 0-10
  }

  /**
   * Identifies buffer time needs between events
   */
  private async identifyBufferTimeNeeds(events: CalendarEvent[], patterns: EnergyPattern[]): Promise<StressReductionOpportunity[]> {
    const opportunities: StressReductionOpportunity[] = [];
    
    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];
      
      const timeBetween = (nextEvent.start.getTime() - currentEvent.end.getTime()) / (1000 * 60);
      const travelTime = await this.calculateTravelTime(currentEvent.location, nextEvent.location);
      
      if (timeBetween < travelTime + 15) { // Less than travel time + 15 min buffer
        opportunities.push({
          type: 'insufficient_buffer',
          description: `Insufficient buffer time between ${currentEvent.title} and ${nextEvent.title}`,
          currentStressLevel: 0.7,
          potentialStressReduction: 0.4,
          suggestedTimeSlot: {
            startHour: currentEvent.end.getHours(),
            endHour: nextEvent.start.getHours(),
            energyLevel: 'medium',
            productivityScore: 0.5
          },
          implementation: `Add ${Math.max(0, travelTime + 15 - timeBetween)} minutes buffer time`,
          priority: 8
        });
      }
    }
    
    return opportunities;
  }

  /**
   * Identifies batch scheduling opportunities
   */
  private async identifyBatchSchedulingOpportunities(events: CalendarEvent[], patterns: EnergyPattern[]): Promise<StressReductionOpportunity[]> {
    const opportunities: StressReductionOpportunity[] = [];
    
    // Group events by type and location
    const eventGroups = this.groupEventsByTypeAndLocation(events);
    
    for (const [groupKey, groupEvents] of eventGroups.entries()) {
      if (groupEvents.length > 1) {
        const scattered = this.areEventsScattered(groupEvents);
        
        if (scattered) {
          const optimalPattern = this.findOptimalPatternForEventGroup(groupEvents, patterns);
          
          if (optimalPattern) {
            opportunities.push({
              type: 'batch_scheduling',
              description: `Batch ${groupEvents.length} similar events (${groupKey}) together`,
              currentStressLevel: 0.6,
              potentialStressReduction: 0.5,
              suggestedTimeSlot: {
                startHour: optimalPattern.startHour,
                endHour: optimalPattern.endHour,
                energyLevel: optimalPattern.energyLevel,
                productivityScore: optimalPattern.productivityScore
              },
              implementation: `Schedule all ${groupKey} events during ${optimalPattern.energyLevel} energy period`,
              priority: 6
            });
          }
        }
      }
    }
    
    return opportunities;
  }

  /**
   * Groups events by type and location
   */
  private groupEventsByTypeAndLocation(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const groups = new Map<string, CalendarEvent[]>();
    
    for (const event of events) {
      const activityType = this.categorizeEventActivity(event);
      const location = event.location || 'unknown';
      const key = `${activityType}_${location}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }
    
    return groups;
  }

  /**
   * Checks if events are scattered across different time periods
   */
  private areEventsScattered(events: CalendarEvent[]): boolean {
    const hours = events.map(e => e.start.getHours());
    const minHour = Math.min(...hours);
    const maxHour = Math.max(...hours);
    
    return (maxHour - minHour) > 4; // Scattered if span more than 4 hours
  }

  /**
   * Finds optimal pattern for a group of events
   */
  private findOptimalPatternForEventGroup(events: CalendarEvent[], patterns: EnergyPattern[]): EnergyPattern | null {
    if (events.length === 0) return null;
    
    const activityType = this.categorizeEventActivity(events[0]);
    return this.findBestEnergyPatternForActivityType(activityType, patterns);
  }

  // Mock analysis methods - in real implementation, these would analyze historical data
  
  private async analyzeMorningRoutine(userId: string): Promise<RoutineAnalysis> {
    return {
      steps: [
        { order: 1, activity: 'Wake up', duration: 5, dependencies: [], flexibility: 0.1 },
        { order: 2, activity: 'Shower', duration: 15, dependencies: ['Wake up'], flexibility: 0.3 },
        { order: 3, activity: 'Breakfast', duration: 20, dependencies: ['Shower'], flexibility: 0.5 },
        { order: 4, activity: 'Commute', duration: 30, dependencies: ['Breakfast'], flexibility: 0.2 }
      ],
      inefficiencies: ['Long breakfast time', 'No preparation the night before'],
      totalTime: 70,
      optimizationPotential: 0.4
    };
  }

  private async analyzeEveningRoutine(userId: string): Promise<RoutineAnalysis> {
    return {
      steps: [
        { order: 1, activity: 'Dinner', duration: 30, dependencies: [], flexibility: 0.4 },
        { order: 2, activity: 'Cleanup', duration: 20, dependencies: ['Dinner'], flexibility: 0.6 },
        { order: 3, activity: 'Relaxation', duration: 60, dependencies: ['Cleanup'], flexibility: 0.8 },
        { order: 4, activity: 'Sleep prep', duration: 15, dependencies: ['Relaxation'], flexibility: 0.3 }
      ],
      inefficiencies: ['Inefficient cleanup process'],
      totalTime: 125,
      optimizationPotential: 0.2
    };
  }

  private async analyzeWeeklyRoutines(userId: string): Promise<WeeklyRoutineAnalysis[]> {
    return [
      {
        type: 'grocery_shopping',
        steps: [
          { order: 1, activity: 'Plan meals', duration: 15, dependencies: [], flexibility: 0.7 },
          { order: 2, activity: 'Make list', duration: 10, dependencies: ['Plan meals'], flexibility: 0.5 },
          { order: 3, activity: 'Shop', duration: 60, dependencies: ['Make list'], flexibility: 0.3 }
        ],
        frequency: 2, // times per week
        complexity: DifficultyLevel.EASY,
        optimizationPotential: 0.5
      }
    ];
  }

  private async optimizeMorningRoutine(routine: RoutineAnalysis): Promise<OptimizedRoutine> {
    return {
      steps: [
        { order: 1, activity: 'Wake up', duration: 5, dependencies: [], flexibility: 0.1 },
        { order: 2, activity: 'Quick shower', duration: 10, dependencies: ['Wake up'], flexibility: 0.3 },
        { order: 3, activity: 'Quick breakfast', duration: 15, dependencies: ['Shower'], flexibility: 0.5 },
        { order: 4, activity: 'Commute', duration: 30, dependencies: ['Breakfast'], flexibility: 0.2 }
      ],
      benefits: ['Save 15 minutes each morning', 'Less rushed feeling', 'More time for family'],
      timeSavings: 15
    };
  }

  private async optimizeEveningRoutine(routine: RoutineAnalysis): Promise<OptimizedRoutine> {
    return {
      steps: [
        { order: 1, activity: 'Dinner', duration: 30, dependencies: [], flexibility: 0.4 },
        { order: 2, activity: 'Efficient cleanup', duration: 15, dependencies: ['Dinner'], flexibility: 0.6 },
        { order: 3, activity: 'Relaxation', duration: 60, dependencies: ['Cleanup'], flexibility: 0.8 },
        { order: 4, activity: 'Sleep prep', duration: 15, dependencies: ['Relaxation'], flexibility: 0.3 }
      ],
      benefits: ['Save 5 minutes on cleanup', 'More relaxation time'],
      timeSavings: 5
    };
  }

  private async optimizeWeeklyRoutine(routine: WeeklyRoutineAnalysis): Promise<OptimizedWeeklyRoutine> {
    return {
      steps: [
        { order: 1, activity: 'Batch meal planning', duration: 20, dependencies: [], flexibility: 0.7 },
        { order: 2, activity: 'Online ordering', duration: 15, dependencies: ['Batch meal planning'], flexibility: 0.8 },
        { order: 3, activity: 'Quick pickup', duration: 20, dependencies: ['Online ordering'], flexibility: 0.5 }
      ],
      benefits: ['Save 30 minutes per shopping trip', 'Reduce impulse purchases', 'Better meal planning'],
      timeSavings: 30,
      familyImpact: {
        affectedMembers: ['family'],
        disruptionLevel: 'low',
        adaptationTime: 14,
        overallBenefit: 3,
        benefits: ['More family time', 'Better organized meals']
      }
    };
  }

  // Efficiency calculation methods
  
  private async analyzeTimeWaste(userId: string, timeRange: TimeRange): Promise<{ inefficiencies: Inefficiency[] }> {
    return {
      inefficiencies: [
        {
          type: 'time_waste',
          description: 'Multiple short trips instead of batching errands',
          impact: { timeImpact: 45, stressImpact: 0.3, costImpact: 10, familyImpact: 0.2, healthImpact: 0.1, qualityImpact: -0.2 },
          frequency: 'weekly',
          rootCause: 'Poor planning and scheduling',
          solutions: ['Batch errands into single trips', 'Use online services where possible']
        }
      ]
    };
  }

  private async analyzeSchedulingPatterns(userId: string, timeRange: TimeRange): Promise<{ inefficiencies: Inefficiency[] }> {
    return {
      inefficiencies: [
        {
          type: 'poor_scheduling',
          description: 'Back-to-back meetings without travel time buffer',
          impact: { timeImpact: 20, stressImpact: 0.5, costImpact: 0, familyImpact: 0.3, healthImpact: 0.2, qualityImpact: -0.3 },
          frequency: 'daily',
          rootCause: 'Not accounting for travel time between locations',
          solutions: ['Add 15-minute buffers between meetings', 'Group meetings by location']
        }
      ]
    };
  }

  private async identifyBatchingOpportunities(userId: string, timeRange: TimeRange): Promise<OptimizationOpportunity[]> {
    return [
      {
        type: OptimizationType.TASK_BATCHING,
        description: 'Batch email processing into 2-3 focused sessions per day',
        potentialBenefit: { timeImpact: 30, stressImpact: -0.4, costImpact: 0, familyImpact: 0.2, healthImpact: 0.1, qualityImpact: 0.3 },
        implementationEffort: DifficultyLevel.EASY,
        prerequisites: ['Email notification management'],
        timeline: 7
      }
    ];
  }

  private async identifyAutomationOpportunities(userId: string, timeRange: TimeRange): Promise<OptimizationOpportunity[]> {
    return [
      {
        type: OptimizationType.AUTOMATION,
        description: 'Automate bill payments and recurring transactions',
        potentialBenefit: { timeImpact: 60, stressImpact: -0.3, costImpact: 0, familyImpact: 0.3, healthImpact: 0.1, qualityImpact: 0.2 },
        implementationEffort: DifficultyLevel.MEDIUM,
        prerequisites: ['Online banking setup', 'Budget review'],
        timeline: 14
      }
    ];
  }

  private async identifyRoutineOptimizations(userId: string, timeRange: TimeRange): Promise<OptimizationOpportunity[]> {
    return [
      {
        type: OptimizationType.ROUTINE_OPTIMIZATION,
        description: 'Optimize morning routine to reduce preparation time',
        potentialBenefit: { timeImpact: 15, stressImpact: -0.5, costImpact: 0, familyImpact: 0.4, healthImpact: 0.3, qualityImpact: 0.4 },
        implementationEffort: DifficultyLevel.EASY,
        prerequisites: ['Evening preparation habits'],
        timeline: 21
      }
    ];
  }

  // Metric calculation methods
  
  private async calculateTimeEfficiency(userId: string, timeRange: TimeRange): Promise<number> {
    // Mock calculation - in real implementation, would analyze actual time usage
    return 0.72; // 72% efficiency
  }

  private async calculateStressLevel(userId: string, timeRange: TimeRange): Promise<number> {
    // Mock calculation - in real implementation, would analyze schedule density and conflicts
    return 6.2; // On a scale of 1-10
  }

  private async calculateTaskCompletionRate(userId: string, timeRange: TimeRange): Promise<number> {
    // Mock calculation - in real implementation, would track task completion
    return 0.85; // 85% completion rate
  }

  private async calculateResourceUtilization(userId: string, timeRange: TimeRange): Promise<number> {
    // Mock calculation - in real implementation, would analyze resource usage patterns
    return 0.68; // 68% utilization
  }

  private async calculateFamilySatisfaction(userId: string, timeRange: TimeRange): Promise<number> {
    // Mock calculation - in real implementation, would use feedback and surveys
    return 7.3; // On a scale of 1-10
  }

  private async calculateAutomationLevel(userId: string, timeRange: TimeRange): Promise<number> {
    // Mock calculation - in real implementation, would track automated vs manual tasks
    return 0.35; // 35% automation
  }
}

// Supporting interfaces and types

interface ScheduleGap {
  start: Date;
  end: Date;
  duration: number; // minutes
  beforeEvent: CalendarEvent;
  afterEvent: CalendarEvent;
  travelTimeNeeded: number;
}

interface RoutineInefficiency {
  type: string;
  description: string;
  impact: { timeImpact: number; stressImpact: number };
  frequency: number;
  solution: string;
}

interface RoutinePattern {
  type: string;
  frequency: number;
  averageTime: Date;
  duration: number;
  locations: string[];
}

interface RoutineAnalysis {
  steps: RoutineStep[];
  inefficiencies: string[];
  totalTime: number;
  optimizationPotential: number;
}

interface WeeklyRoutineAnalysis {
  type: string;
  steps: RoutineStep[];
  frequency: number;
  complexity: DifficultyLevel;
  optimizationPotential: number;
}

interface OptimizedRoutine {
  steps: RoutineStep[];
  benefits: string[];
  timeSavings: number;
}

interface OptimizedWeeklyRoutine {
  steps: RoutineStep[];
  benefits: string[];
  timeSavings: number;
  familyImpact: FamilyImpactAssessment;
}

// Energy and productivity interfaces

interface EnergyPattern {
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening';
  startHour: number;
  endHour: number;
  energyLevel: 'high' | 'medium' | 'low';
  productivityScore: number; // 0-1 scale
  consistency: number; // 0-1 scale
  activities: string[]; // Optimal activity types for this period
}

interface ProductivityRecommendation {
  activity: Activity;
  recommendedTimeSlot: {
    startHour: number;
    endHour: number;
    energyLevel: 'high' | 'medium' | 'low';
    productivityScore: number;
  };
  reasoning: string[];
  stressReductionScore: number;
  energyOptimizationScore: number;
}

interface StressReductionOpportunity {
  type: 'energy_mismatch' | 'insufficient_buffer' | 'batch_scheduling';
  description: string;
  currentStressLevel: number; // 0-1 scale
  potentialStressReduction: number; // 0-1 scale
  suggestedTimeSlot: {
    startHour: number;
    endHour: number;
    energyLevel: 'high' | 'medium' | 'low';
    productivityScore: number;
  };
  implementation: string;
  priority: number; // 1-10 scale
}