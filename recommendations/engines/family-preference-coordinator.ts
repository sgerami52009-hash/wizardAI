/**
 * Family Preference Coordinator
 * 
 * Manages family-wide preference aggregation, conflict resolution for competing preferences,
 * and shared activity preference matching across family members.
 * 
 * Requirements: 1.2, 4.3, 6.3
 */

import {
  UserPreferences,
  Interest,
  FamilyContext,
  PreferenceConflict,
  GroupDynamics,
  ActivityPreferences,
  SchedulePreferences,
  LearningPreferences,
  UserContext,
  ConflictResolution,
  RoleAssignment
} from '../types';

import {
  ActivityRecommendation,
  FamilyActivityRecommendation
} from '../interfaces';

import {
  InterestCategory,
  ActivityCategory,
  DifficultyLevel,
  PrivacyLevel,
  Subject
} from '../enums';

import { UserPreferenceEngine } from './user-preference-engine';
import { IPrivacyManager } from '../interfaces';

/**
 * Interface for family data storage operations
 */
export interface IFamilyStorage {
  getFamilyMembers(familyId: string): Promise<string[]>;
  getFamilyDynamics(familyId: string): Promise<GroupDynamics>;
  saveFamilyDynamics(familyId: string, dynamics: GroupDynamics): Promise<void>;
  getFamilyConflictHistory(familyId: string): Promise<PreferenceConflict[]>;
  saveConflictResolution(familyId: string, conflict: PreferenceConflict): Promise<void>;
}

/**
 * Family Preference Coordination Engine
 * 
 * Handles all aspects of family preference management including:
 * - Aggregating individual preferences into family preferences
 * - Resolving conflicts between family members' preferences
 * - Matching shared activities based on combined preferences
 * - Managing family dynamics and decision-making patterns
 */
export class FamilyPreferenceCoordinator {
  private userPreferenceEngine: UserPreferenceEngine;
  private familyStorage: IFamilyStorage;
  private privacyManager: IPrivacyManager;

  // Configuration for preference aggregation
  private readonly adultWeight = 1.0;
  private readonly childWeight = 0.7; // Children's preferences weighted slightly less
  private readonly consensusThreshold = 0.6; // 60% agreement needed for consensus
  private readonly conflictThreshold = 0.3; // 30% disagreement triggers conflict resolution

  constructor(
    userPreferenceEngine: UserPreferenceEngine,
    familyStorage: IFamilyStorage,
    privacyManager: IPrivacyManager
  ) {
    this.userPreferenceEngine = userPreferenceEngine;
    this.familyStorage = familyStorage;
    this.privacyManager = privacyManager;
  }

  /**
   * Aggregate individual family member preferences into family-wide preferences
   * Requirements: 1.2, 4.3
   */
  async aggregateFamilyPreferences(familyId: string): Promise<UserPreferences> {
    // Get all family members
    const familyMembers = await this.familyStorage.getFamilyMembers(familyId);
    
    if (familyMembers.length === 0) {
      throw new Error('No family members found');
    }

    // Get individual preferences for each member
    const memberPreferences: UserPreferences[] = [];
    for (const memberId of familyMembers) {
      try {
        const prefs = await this.userPreferenceEngine.getUserPreferences(memberId);
        memberPreferences.push(prefs);
      } catch (error) {
        console.warn(`Failed to load preferences for family member ${memberId}:`, error);
        // Continue with other members
      }
    }

    if (memberPreferences.length === 0) {
      throw new Error('No valid family member preferences found');
    }

    // Aggregate preferences
    const aggregatedPreferences: UserPreferences = {
      userId: familyId,
      interests: await this.aggregateInterests(memberPreferences, familyMembers),
      activityPreferences: this.aggregateActivityPreferences(memberPreferences),
      schedulePreferences: this.aggregateSchedulePreferences(memberPreferences),
      learningPreferences: this.aggregateLearningPreferences(memberPreferences),
      privacyPreferences: this.aggregatePrivacyPreferences(memberPreferences),
      notificationPreferences: this.aggregateNotificationPreferences(memberPreferences),
      lastUpdated: new Date()
    };

    return aggregatedPreferences;
  }

  /**
   * Identify and resolve conflicts between family member preferences
   * Requirements: 1.2, 4.3
   */
  async identifyAndResolveConflicts(familyId: string): Promise<PreferenceConflict[]> {
    const familyMembers = await this.familyStorage.getFamilyMembers(familyId);
    const familyDynamics = await this.familyStorage.getFamilyDynamics(familyId);
    
    // Get all member preferences
    const memberPreferences: UserPreferences[] = [];
    for (const memberId of familyMembers) {
      try {
        const prefs = await this.userPreferenceEngine.getUserPreferences(memberId);
        memberPreferences.push(prefs);
      } catch (error) {
        console.warn(`Failed to load preferences for conflict analysis: ${memberId}`);
      }
    }

    // Identify conflicts
    const conflicts: PreferenceConflict[] = [];
    
    // Activity preference conflicts
    const activityConflicts = this.identifyActivityConflicts(memberPreferences, familyMembers);
    conflicts.push(...activityConflicts);

    // Schedule preference conflicts
    const scheduleConflicts = this.identifyScheduleConflicts(memberPreferences, familyMembers);
    conflicts.push(...scheduleConflicts);

    // Interest conflicts
    const interestConflicts = this.identifyInterestConflicts(memberPreferences, familyMembers);
    conflicts.push(...interestConflicts);

    // Resolve conflicts based on family dynamics
    const resolvedConflicts = await this.resolveConflicts(conflicts, familyDynamics);

    // Save conflict resolutions for learning
    for (const conflict of resolvedConflicts) {
      await this.familyStorage.saveConflictResolution(familyId, conflict);
    }

    return resolvedConflicts;
  }

  /**
   * Find shared activities that match family preferences
   * Requirements: 1.2, 4.3
   */
  async findSharedActivityPreferences(
    familyId: string,
    availableActivities: ActivityRecommendation[]
  ): Promise<FamilyActivityRecommendation[]> {
    const familyMembers = await this.familyStorage.getFamilyMembers(familyId);
    const familyPreferences = await this.aggregateFamilyPreferences(familyId);
    
    const sharedActivities: FamilyActivityRecommendation[] = [];

    for (const activity of availableActivities) {
      // Check if activity matches family preferences
      const matchScore = this.calculateFamilyActivityMatch(activity, familyPreferences);
      
      if (matchScore >= this.consensusThreshold) {
        // Create family activity recommendation
        const familyActivity: FamilyActivityRecommendation = {
          ...activity,
          familyMembers: familyMembers,
          roleAssignments: await this.assignActivityRoles(activity, familyMembers),
          coordinationRequired: this.requiresCoordination(activity),
          conflictResolution: await this.getConflictResolutionStrategy(familyId, activity)
        };

        sharedActivities.push(familyActivity);
      }
    }

    // Sort by match score and family benefit
    return sharedActivities.sort((a, b) => {
      const scoreA = this.calculateFamilyBenefit(a);
      const scoreB = this.calculateFamilyBenefit(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Update family dynamics based on interaction patterns
   * Requirements: 4.3
   */
  async updateFamilyDynamics(
    familyId: string,
    interactions: { userId: string; decision: string; outcome: string }[]
  ): Promise<void> {
    const currentDynamics = await this.familyStorage.getFamilyDynamics(familyId);
    
    // Analyze interaction patterns
    const leadershipPatterns = this.analyzeLeadershipPatterns(interactions);
    const decisionPatterns = this.analyzeDecisionPatterns(interactions);
    const conflictPatterns = this.analyzeConflictPatterns(interactions);

    // Update dynamics
    const updatedDynamics: GroupDynamics = {
      leadershipStyle: this.determineLeadershipStyle(leadershipPatterns),
      decisionMaking: this.determineDecisionMaking(decisionPatterns),
      conflictResolution: this.determineConflictResolution(conflictPatterns)
    };

    await this.familyStorage.saveFamilyDynamics(familyId, updatedDynamics);
  }

  /**
   * Get family context for recommendation generation
   * Requirements: 4.3
   */
  async getFamilyContext(familyId: string, presentMembers: string[]): Promise<FamilyContext> {
    const allMembers = await this.familyStorage.getFamilyMembers(familyId);
    const familyPreferences = await this.aggregateFamilyPreferences(familyId);
    const conflicts = await this.identifyAndResolveConflicts(familyId);
    const dynamics = await this.familyStorage.getFamilyDynamics(familyId);

    return {
      familyId,
      membersPresent: presentMembers,
      sharedPreferences: familyPreferences,
      conflictingPreferences: conflicts,
      groupDynamics: dynamics
    };
  }

  /**
   * Aggregate interests from all family members
   * Requirements: 1.2, 6.3
   */
  private async aggregateInterests(
    memberPreferences: UserPreferences[],
    familyMembers: string[]
  ): Promise<Interest[]> {
    const interestMap = new Map<string, Interest>();

    for (let i = 0; i < memberPreferences.length; i++) {
      const prefs = memberPreferences[i];
      const memberId = familyMembers[i];
      const weight = await this.getMemberWeight(memberId);

      for (const interest of prefs.interests) {
        const key = `${interest.category}-${interest.subcategory}`;
        
        if (interestMap.has(key)) {
          // Combine with existing interest
          const existing = interestMap.get(key)!;
          existing.strength = (existing.strength + interest.strength * weight) / 2;
          existing.recency = interest.recency > existing.recency ? interest.recency : existing.recency;
        } else {
          // Add new interest with weight applied
          interestMap.set(key, {
            ...interest,
            strength: interest.strength * weight,
            source: 'social' // Mark as derived from family aggregation
          });
        }
      }
    }

    // Convert back to array and sort by strength
    return Array.from(interestMap.values())
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 30); // Limit family interests
  }

  /**
   * Aggregate activity preferences from family members
   * Requirements: 1.2
   */
  private aggregateActivityPreferences(memberPreferences: UserPreferences[]): ActivityPreferences {
    const categoryVotes = new Map<ActivityCategory, number>();
    const difficultyVotes = new Map<DifficultyLevel, number>();
    let indoorCount = 0, outdoorCount = 0, bothCount = 0;
    let soloCount = 0, groupCount = 0, socialBothCount = 0;
    let physicalLevels: string[] = [];

    for (const prefs of memberPreferences) {
      const activityPrefs = prefs.activityPreferences;

      // Count category preferences
      for (const category of activityPrefs.preferredCategories) {
        categoryVotes.set(category, (categoryVotes.get(category) || 0) + 1);
      }

      // Count difficulty preferences
      difficultyVotes.set(activityPrefs.preferredDifficulty, 
        (difficultyVotes.get(activityPrefs.preferredDifficulty) || 0) + 1);

      // Count location preferences
      switch (activityPrefs.indoorOutdoorPreference) {
        case 'indoor': indoorCount++; break;
        case 'outdoor': outdoorCount++; break;
        case 'both': bothCount++; break;
      }

      // Count social preferences
      switch (activityPrefs.socialPreference) {
        case 'solo': soloCount++; break;
        case 'group': groupCount++; break;
        case 'both': socialBothCount++; break;
      }

      physicalLevels.push(activityPrefs.physicalActivityLevel);
    }

    // Determine aggregated preferences
    const preferredCategories = Array.from(categoryVotes.entries())
      .filter(([_, count]) => count >= memberPreferences.length * 0.3) // 30% threshold
      .map(([category, _]) => category);

    const preferredDifficulty = Array.from(difficultyVotes.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || DifficultyLevel.INTERMEDIATE;

    const indoorOutdoorPreference = 
      bothCount > indoorCount && bothCount > outdoorCount ? 'both' :
      indoorCount > outdoorCount ? 'indoor' : 'outdoor';

    const socialPreference = 
      socialBothCount > soloCount && socialBothCount > groupCount ? 'both' :
      groupCount > soloCount ? 'group' : 'solo';

    const physicalActivityLevel = this.aggregatePhysicalLevel(physicalLevels);

    return {
      preferredCategories,
      preferredDifficulty,
      preferredDuration: this.aggregateDuration(memberPreferences),
      indoorOutdoorPreference,
      socialPreference,
      physicalActivityLevel
    };
  }

  /**
   * Aggregate schedule preferences from family members
   * Requirements: 1.2
   */
  private aggregateSchedulePreferences(memberPreferences: UserPreferences[]): SchedulePreferences {
    const wakeTimes: string[] = [];
    const bedTimes: string[] = [];
    const flexibilityLevels: string[] = [];

    for (const prefs of memberPreferences) {
      wakeTimes.push(prefs.schedulePreferences.preferredWakeTime);
      bedTimes.push(prefs.schedulePreferences.preferredBedTime);
      flexibilityLevels.push(prefs.schedulePreferences.flexibilityLevel);
    }

    return {
      preferredWakeTime: this.aggregateTime(wakeTimes, 'earliest'),
      preferredBedTime: this.aggregateTime(bedTimes, 'latest'),
      workingHours: this.aggregateWorkingHours(memberPreferences),
      breakPreferences: this.aggregateBreakPreferences(memberPreferences),
      flexibilityLevel: this.aggregateFlexibility(flexibilityLevels)
    };
  }

  /**
   * Identify conflicts in activity preferences
   * Requirements: 1.2, 4.3
   */
  private identifyActivityConflicts(
    memberPreferences: UserPreferences[],
    familyMembers: string[]
  ): PreferenceConflict[] {
    const conflicts: PreferenceConflict[] = [];

    // Check for category conflicts
    const categoryPreferences = memberPreferences.map(p => p.activityPreferences.preferredCategories);
    const categoryConflicts = this.findCategoryConflicts(categoryPreferences, familyMembers);
    conflicts.push(...categoryConflicts);

    // Check for difficulty conflicts
    const difficultyPreferences = memberPreferences.map(p => p.activityPreferences.preferredDifficulty);
    const difficultyConflicts = this.findDifficultyConflicts(difficultyPreferences, familyMembers);
    conflicts.push(...difficultyConflicts);

    return conflicts;
  }

  /**
   * Identify conflicts in schedule preferences
   * Requirements: 1.2, 4.3
   */
  private identifyScheduleConflicts(
    memberPreferences: UserPreferences[],
    familyMembers: string[]
  ): PreferenceConflict[] {
    const conflicts: PreferenceConflict[] = [];

    // Check for time conflicts
    const wakeTimes = memberPreferences.map(p => p.schedulePreferences.preferredWakeTime);
    const bedTimes = memberPreferences.map(p => p.schedulePreferences.preferredBedTime);

    if (this.hasSignificantTimeConflict(wakeTimes) || this.hasSignificantTimeConflict(bedTimes)) {
      conflicts.push({
        users: familyMembers,
        conflictType: 'time',
        severity: 'medium',
        resolutionStrategy: 'compromise'
      });
    }

    return conflicts;
  }

  /**
   * Identify conflicts in interests
   * Requirements: 1.2, 4.3
   */
  private identifyInterestConflicts(
    memberPreferences: UserPreferences[],
    familyMembers: string[]
  ): PreferenceConflict[] {
    const conflicts: PreferenceConflict[] = [];

    // Find interests that are strongly preferred by some but avoided by others
    const allInterests = new Set<string>();
    memberPreferences.forEach(p => 
      p.interests.forEach(i => allInterests.add(`${i.category}-${i.subcategory}`))
    );

    for (const interestKey of allInterests) {
      const [category, subcategory] = interestKey.split('-');
      const strengths: number[] = [];
      const involvedMembers: string[] = [];

      for (let i = 0; i < memberPreferences.length; i++) {
        const interest = memberPreferences[i].interests.find(
          int => int.category === category && int.subcategory === subcategory
        );
        
        if (interest) {
          strengths.push(interest.strength);
          involvedMembers.push(familyMembers[i]);
        }
      }

      // Check for significant variance in interest strength
      if (strengths.length > 1) {
        const variance = this.calculateVariance(strengths);
        if (variance > 0.3) { // High variance indicates conflict
          conflicts.push({
            users: involvedMembers,
            conflictType: 'activity',
            severity: variance > 0.5 ? 'high' : 'medium',
            resolutionStrategy: 'rotation'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts based on family dynamics
   * Requirements: 4.3
   */
  private async resolveConflicts(
    conflicts: PreferenceConflict[],
    dynamics: GroupDynamics
  ): Promise<PreferenceConflict[]> {
    return conflicts.map(conflict => {
      let resolutionStrategy: string;

      switch (dynamics.conflictResolution) {
        case 'discussion':
          resolutionStrategy = 'facilitate_discussion';
          break;
        case 'compromise':
          resolutionStrategy = 'find_middle_ground';
          break;
        case 'rotation':
          resolutionStrategy = 'take_turns';
          break;
        default:
          resolutionStrategy = 'compromise';
      }

      return {
        ...conflict,
        resolutionStrategy
      };
    });
  }

  // Helper methods

  private async getMemberWeight(memberId: string): Promise<number> {
    // In a real implementation, this would check if the member is an adult or child
    // For now, return default adult weight
    return this.adultWeight;
  }

  private calculateFamilyActivityMatch(
    activity: ActivityRecommendation,
    familyPreferences: UserPreferences
  ): number {
    let score = 0;

    // Check category match
    if (familyPreferences.activityPreferences.preferredCategories.includes(activity.category)) {
      score += 0.3;
    }

    // Check difficulty match
    if (activity.difficulty === familyPreferences.activityPreferences.preferredDifficulty) {
      score += 0.2;
    }

    // Check social activity match
    if (activity.socialActivity && familyPreferences.activityPreferences.socialPreference !== 'solo') {
      score += 0.2;
    }

    // Check age appropriateness
    if (activity.ageAppropriate) {
      score += 0.3;
    }

    // Always return the raw score, don't divide by factors
    return score;
  }

  private async assignActivityRoles(
    activity: ActivityRecommendation,
    familyMembers: string[]
  ): Promise<RoleAssignment[]> {
    // Simple role assignment - in practice this would be more sophisticated
    return familyMembers.map(memberId => ({
      userId: memberId,
      role: 'participant',
      responsibilities: ['participate', 'enjoy'],
      timeCommitment: 60 // Default 60 minutes
    }));
  }

  private requiresCoordination(activity: ActivityRecommendation): boolean {
    return activity.socialActivity || activity.requiredResources.length > 0;
  }

  private async getConflictResolutionStrategy(
    familyId: string,
    activity: ActivityRecommendation
  ): Promise<ConflictResolution> {
    const dynamics = await this.familyStorage.getFamilyDynamics(familyId);
    
    return {
      strategy: dynamics.conflictResolution === 'discussion' ? 'compromise' : 'compromise',
      fallbackOptions: ['rotation', 'voting'],
      timeoutMinutes: 10
    };
  }

  private calculateFamilyBenefit(activity: FamilyActivityRecommendation): number {
    let benefit = activity.confidence;
    
    // Bonus for family bonding activities
    if (activity.socialActivity) {
      benefit += 0.2;
    }
    
    // Bonus for educational activities
    if (activity.educationalValue > 0.5) {
      benefit += 0.1;
    }
    
    return Math.min(1.0, benefit);
  }

  // Additional helper methods for aggregation
  private aggregatePhysicalLevel(levels: string[]): 'low' | 'medium' | 'high' {
    const counts = { low: 0, medium: 0, high: 0 };
    levels.forEach(level => counts[level as keyof typeof counts]++);
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as 'low' | 'medium' | 'high';
  }

  private aggregateDuration(memberPreferences: UserPreferences[]) {
    // Simple average of preferred durations
    const durations = memberPreferences.map(p => p.activityPreferences.preferredDuration);
    const avgStart = new Date(durations.reduce((sum, d) => sum + d.start.getTime(), 0) / durations.length);
    const avgEnd = new Date(durations.reduce((sum, d) => sum + d.end.getTime(), 0) / durations.length);
    
    return { start: avgStart, end: avgEnd };
  }

  private aggregateTime(times: string[], strategy: 'earliest' | 'latest'): string {
    const sortedTimes = times.sort();
    return strategy === 'earliest' ? sortedTimes[0] : sortedTimes[sortedTimes.length - 1];
  }

  private aggregateWorkingHours(memberPreferences: UserPreferences[]) {
    // Combine all working hours
    const allHours = memberPreferences.flatMap(p => p.schedulePreferences.workingHours);
    return allHours;
  }

  private aggregateBreakPreferences(memberPreferences: UserPreferences[]) {
    // Combine all break preferences
    const allBreaks = memberPreferences.flatMap(p => p.schedulePreferences.breakPreferences);
    return allBreaks;
  }

  private aggregateFlexibility(levels: string[]): 'rigid' | 'moderate' | 'flexible' {
    const counts = { rigid: 0, moderate: 0, flexible: 0 };
    levels.forEach(level => counts[level as keyof typeof counts]++);
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as 'rigid' | 'moderate' | 'flexible';
  }

  private aggregateLearningPreferences(memberPreferences: UserPreferences[]): LearningPreferences {
    // For family learning preferences, take the most common values
    const styles = memberPreferences.map(p => p.learningPreferences.learningStyle);
    const subjects = memberPreferences.flatMap(p => p.learningPreferences.preferredSubjects);
    const difficulties = memberPreferences.map(p => p.learningPreferences.difficultyPreference);
    const durations = memberPreferences.map(p => p.learningPreferences.sessionDuration);
    const gamifications = memberPreferences.map(p => p.learningPreferences.gamificationLevel);

    return {
      learningStyle: this.getMostCommon(styles) as any,
      preferredSubjects: [...new Set(subjects)].slice(0, 5), // Top 5 unique subjects
      difficultyPreference: this.getMostCommon(difficulties) as any,
      sessionDuration: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      gamificationLevel: this.getMostCommon(gamifications) as any
    };
  }

  private aggregatePrivacyPreferences(memberPreferences: UserPreferences[]) {
    // For privacy, use the most restrictive settings
    const dataSharing = memberPreferences.map(p => p.privacyPreferences.dataSharing);
    const locationTracking = memberPreferences.some(p => p.privacyPreferences.locationTracking);
    const behaviorAnalysis = memberPreferences.every(p => p.privacyPreferences.behaviorAnalysis);
    const familyDataSharing = memberPreferences.every(p => p.privacyPreferences.familyDataSharing);
    const externalIntegrations = memberPreferences.some(p => p.privacyPreferences.externalIntegrations);
    const retentionDays = Math.min(...memberPreferences.map(p => p.privacyPreferences.dataRetentionDays));

    return {
      dataSharing: this.getMostRestrictivePrivacyLevel(dataSharing),
      locationTracking,
      behaviorAnalysis,
      familyDataSharing,
      externalIntegrations,
      dataRetentionDays: retentionDays
    };
  }

  private aggregateNotificationPreferences(memberPreferences: UserPreferences[]) {
    // Aggregate notification preferences
    const enabled = memberPreferences.some(p => p.notificationPreferences.enabled);
    const quietHours = memberPreferences.flatMap(p => p.notificationPreferences.quietHours);
    const urgencyThresholds = memberPreferences.map(p => p.notificationPreferences.urgencyThreshold);
    const channels = [...new Set(memberPreferences.flatMap(p => p.notificationPreferences.channels))];

    return {
      enabled,
      quietHours,
      urgencyThreshold: this.getMostCommon(urgencyThresholds) as any,
      channels: channels as any[]
    };
  }

  private getMostCommon<T>(items: T[]): T {
    const counts = new Map<T, number>();
    items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  private getMostRestrictivePrivacyLevel(levels: PrivacyLevel[]): PrivacyLevel {
    const order = [PrivacyLevel.PUBLIC, PrivacyLevel.FAMILY, PrivacyLevel.PRIVATE, PrivacyLevel.ANONYMOUS];
    return levels.reduce((most, current) => 
      order.indexOf(current) > order.indexOf(most) ? current : most
    );
  }

  private findCategoryConflicts(
    categoryPreferences: ActivityCategory[][],
    familyMembers: string[]
  ): PreferenceConflict[] {
    const conflicts: PreferenceConflict[] = [];
    
    // Check if there are significant differences in preferred categories
    const allCategories = new Set<ActivityCategory>();
    categoryPreferences.forEach(prefs => prefs.forEach(cat => allCategories.add(cat)));
    
    for (const category of allCategories) {
      const supporters = familyMembers.filter((_, i) => 
        categoryPreferences[i]?.includes(category)
      );
      const opposers = familyMembers.filter((_, i) => 
        !categoryPreferences[i]?.includes(category)
      );
      
      // If there's significant disagreement (more than 50% don't support)
      if (opposers.length > supporters.length && opposers.length > 1) {
        conflicts.push({
          users: [...supporters, ...opposers],
          conflictType: 'activity',
          severity: 'medium',
          resolutionStrategy: 'compromise'
        });
      }
    }
    
    return conflicts;
  }

  private findDifficultyConflicts(
    difficultyPreferences: DifficultyLevel[],
    familyMembers: string[]
  ): PreferenceConflict[] {
    const conflicts: PreferenceConflict[] = [];
    
    // Check for significant difficulty level differences
    const difficultyOrder = [
      DifficultyLevel.BEGINNER,
      DifficultyLevel.EASY,
      DifficultyLevel.INTERMEDIATE,
      DifficultyLevel.ADVANCED,
      DifficultyLevel.EXPERT
    ];
    
    const indices = difficultyPreferences.map(diff => difficultyOrder.indexOf(diff));
    const minIndex = Math.min(...indices);
    const maxIndex = Math.max(...indices);
    
    // If there's more than 2 levels difference, it's a conflict
    if (maxIndex - minIndex > 2) {
      conflicts.push({
        users: familyMembers,
        conflictType: 'difficulty',
        severity: 'high',
        resolutionStrategy: 'compromise'
      });
    }
    
    return conflicts;
  }

  private hasSignificantTimeConflict(times: string[]): boolean {
    // Check if there's more than 2 hours difference between earliest and latest
    const timeMinutes = times.map(t => {
      const [hours, minutes] = t.split(':').map(Number);
      return hours * 60 + minutes;
    });
    
    const min = Math.min(...timeMinutes);
    const max = Math.max(...timeMinutes);
    
    return (max - min) > 120; // 2 hours in minutes
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / numbers.length;
  }

  private analyzeLeadershipPatterns(interactions: any[]): any {
    // Analyze who typically makes decisions
    return {};
  }

  private analyzeDecisionPatterns(interactions: any[]): any {
    // Analyze how decisions are typically made
    return {};
  }

  private analyzeConflictPatterns(interactions: any[]): any {
    // Analyze how conflicts are typically resolved
    return {};
  }

  private determineLeadershipStyle(patterns: any): 'democratic' | 'authoritative' | 'collaborative' {
    return 'collaborative'; // Default
  }

  private determineDecisionMaking(patterns: any): 'consensus' | 'majority' | 'leader-decides' {
    return 'consensus'; // Default
  }

  private determineConflictResolution(patterns: any): 'discussion' | 'compromise' | 'rotation' {
    return 'compromise'; // Default
  }
}