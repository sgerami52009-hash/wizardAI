/**
 * Activity Recommender Engine
 * 
 * Generates personalized activity suggestions based on user interests,
 * available time, and contextual factors while ensuring child safety.
 */

import { IActivityRecommender, ActivityRecommendation, FamilyActivityRecommendation } from '../interfaces';
import {
  ActivityContext,
  FamilyContext,
  Interest,
  ActivityPreferences,
  ActivityFeedback,
  Resource,
  WeatherRequirement,
  UserContext,
  TimeRange,
  LocationContext,
  WeatherCondition,
  AgeRange
} from '../types';
import { ActivityCategory, DifficultyLevel, InterestCategory } from '../enums';

interface ActivityTemplate {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  subcategories: string[];
  difficulty: DifficultyLevel;
  minDuration: number; // minutes
  maxDuration: number; // minutes
  requiredResources: Resource[];
  weatherDependency: WeatherRequirement;
  ageRange: AgeRange;
  educationalValue: number; // 0-1 scale
  physicalActivity: boolean;
  socialActivity: boolean;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
  interestCategories: InterestCategory[];
  tags: string[];
  seasonality?: ('spring' | 'summer' | 'fall' | 'winter')[];
  timeOfDay?: ('morning' | 'afternoon' | 'evening' | 'night')[];
}

interface UserSafetyProfile {
  userId: string;
  age: number;
  ageGroup: 'toddler' | 'child' | 'teen' | 'adult';
  parentalControlsEnabled: boolean;
  supervisionLevel: 'strict' | 'moderate' | 'relaxed';
  allowedActivityCategories: ActivityCategory[];
  blockedContent: string[];
  maxActivityDuration: number; // minutes
  requiresSupervision: boolean;
}

interface ActivitySafetyViolation {
  type: 'age_inappropriate' | 'inappropriate_content' | 'dangerous_resource' | 
        'supervision_required' | 'duration_exceeded' | 'category_restricted' | 
        'difficulty_inappropriate' | 'safety_equipment_required' | 'inappropriate_tool';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

interface ActivitySafetyResult {
  isApproved: boolean;
  requiresParentalApproval: boolean;
  violations: ActivitySafetyViolation[];
  warnings: string[];
  safetyScore: number; // 0-1 scale
  recommendations: string[];
}

export class ActivityRecommender implements IActivityRecommender {
  private activityDatabase: ActivityTemplate[] = [];
  private userPreferences: Map<string, ActivityPreferences> = new Map();
  private userFeedback: Map<string, ActivityFeedback[]> = new Map();

  constructor() {
    this.initializeActivityDatabase();
  }

  /**
   * Initialize the activity database with categorized activities
   */
  private initializeActivityDatabase(): void {
    this.activityDatabase = [
      // Physical Activities
      {
        id: 'walk-nature',
        title: 'Nature Walk',
        description: 'Take a peaceful walk in a natural setting to enjoy fresh air and observe wildlife',
        category: ActivityCategory.PHYSICAL,
        subcategories: ['walking', 'nature', 'exploration'],
        difficulty: DifficultyLevel.EASY,
        minDuration: 15,
        maxDuration: 120,
        requiredResources: [
          { type: 'material', name: 'comfortable shoes', required: true, alternatives: [] }
        ],
        weatherDependency: {
          indoor: false,
          outdoor: true,
          weatherDependent: true,
          preferredConditions: ['sunny', 'cloudy'],
          avoidedConditions: ['stormy', 'rainy']
        },
        ageRange: { min: 3, max: 99 },
        educationalValue: 0.6,
        physicalActivity: true,
        socialActivity: false,
        indoorOutdoor: 'outdoor',
        interestCategories: [InterestCategory.NATURE, InterestCategory.FITNESS],
        tags: ['outdoor', 'exercise', 'nature', 'peaceful'],
        seasonality: ['spring', 'summer', 'fall'],
        timeOfDay: ['morning', 'afternoon']
      },
      {
        id: 'indoor-yoga',
        title: 'Family Yoga Session',
        description: 'Practice gentle yoga poses together to improve flexibility and reduce stress',
        category: ActivityCategory.PHYSICAL,
        subcategories: ['yoga', 'stretching', 'mindfulness'],
        difficulty: DifficultyLevel.BEGINNER,
        minDuration: 20,
        maxDuration: 60,
        requiredResources: [
          { type: 'material', name: 'yoga mat', required: false, alternatives: ['towel', 'carpet'] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: false,
          weatherDependent: false
        },
        ageRange: { min: 5, max: 99 },
        educationalValue: 0.4,
        physicalActivity: true,
        socialActivity: true,
        indoorOutdoor: 'indoor',
        interestCategories: [InterestCategory.FITNESS, InterestCategory.SOCIAL],
        tags: ['indoor', 'exercise', 'family', 'relaxation'],
        timeOfDay: ['morning', 'evening']
      },

      // Creative Activities
      {
        id: 'art-painting',
        title: 'Watercolor Painting',
        description: 'Create beautiful artwork using watercolor paints and explore color mixing',
        category: ActivityCategory.CREATIVE,
        subcategories: ['painting', 'art', 'color-theory'],
        difficulty: DifficultyLevel.BEGINNER,
        minDuration: 30,
        maxDuration: 120,
        requiredResources: [
          { type: 'material', name: 'watercolor paints', required: true, alternatives: [] },
          { type: 'material', name: 'watercolor paper', required: true, alternatives: ['thick paper'] },
          { type: 'material', name: 'brushes', required: true, alternatives: [] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: true,
          weatherDependent: false
        },
        ageRange: { min: 4, max: 99 },
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: false,
        indoorOutdoor: 'both',
        interestCategories: [InterestCategory.ARTS, InterestCategory.LEARNING],
        tags: ['creative', 'art', 'painting', 'educational'],
        timeOfDay: ['morning', 'afternoon']
      },

      // Educational Activities
      {
        id: 'science-experiment',
        title: 'Kitchen Science Experiments',
        description: 'Conduct safe science experiments using common household items',
        category: ActivityCategory.EDUCATIONAL,
        subcategories: ['science', 'experiments', 'chemistry'],
        difficulty: DifficultyLevel.INTERMEDIATE,
        minDuration: 30,
        maxDuration: 90,
        requiredResources: [
          { type: 'material', name: 'household items', required: true, alternatives: [] },
          { type: 'material', name: 'safety equipment', required: true, alternatives: [] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: false,
          weatherDependent: false
        },
        ageRange: { min: 6, max: 16 },
        educationalValue: 0.9,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'indoor',
        interestCategories: [InterestCategory.SCIENCE, InterestCategory.LEARNING],
        tags: ['educational', 'science', 'experiments', 'family'],
        timeOfDay: ['afternoon']
      },

      // Social Activities
      {
        id: 'board-games',
        title: 'Family Board Game Night',
        description: 'Play strategy and cooperative board games together',
        category: ActivityCategory.SOCIAL,
        subcategories: ['games', 'strategy', 'cooperation'],
        difficulty: DifficultyLevel.EASY,
        minDuration: 30,
        maxDuration: 180,
        requiredResources: [
          { type: 'material', name: 'board games', required: true, alternatives: ['card games'] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: false,
          weatherDependent: false
        },
        ageRange: { min: 4, max: 99 },
        educationalValue: 0.7,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'indoor',
        interestCategories: [InterestCategory.GAMES, InterestCategory.SOCIAL],
        tags: ['family', 'games', 'strategy', 'fun'],
        timeOfDay: ['evening']
      },

      // Cooking Activities
      {
        id: 'baking-cookies',
        title: 'Bake Homemade Cookies',
        description: 'Learn baking skills while creating delicious treats together',
        category: ActivityCategory.CREATIVE,
        subcategories: ['cooking', 'baking', 'life-skills'],
        difficulty: DifficultyLevel.INTERMEDIATE,
        minDuration: 30,
        maxDuration: 120,
        requiredResources: [
          { type: 'material', name: 'baking ingredients', required: true, alternatives: [] },
          { type: 'material', name: 'baking tools', required: true, alternatives: [] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: false,
          weatherDependent: false
        },
        ageRange: { min: 5, max: 99 },
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'indoor',
        interestCategories: [InterestCategory.COOKING, InterestCategory.LEARNING],
        tags: ['cooking', 'baking', 'family', 'life-skills'],
        timeOfDay: ['afternoon']
      },

      // Reading Activities
      {
        id: 'story-time',
        title: 'Interactive Story Time',
        description: 'Read books together with voices, discussions, and creative activities',
        category: ActivityCategory.EDUCATIONAL,
        subcategories: ['reading', 'storytelling', 'literacy'],
        difficulty: DifficultyLevel.EASY,
        minDuration: 20,
        maxDuration: 60,
        requiredResources: [
          { type: 'material', name: 'books', required: true, alternatives: ['e-books', 'audiobooks'] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: true,
          weatherDependent: false
        },
        ageRange: { min: 2, max: 12 },
        educationalValue: 0.9,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'both',
        interestCategories: [InterestCategory.READING, InterestCategory.LEARNING],
        tags: ['reading', 'educational', 'family', 'literacy'],
        timeOfDay: ['evening']
      },

      // Outdoor Activities
      {
        id: 'garden-exploration',
        title: 'Garden Exploration and Care',
        description: 'Explore plants, insects, and learn about gardening while caring for plants',
        category: ActivityCategory.OUTDOOR,
        subcategories: ['gardening', 'nature', 'biology'],
        difficulty: DifficultyLevel.EASY,
        minDuration: 30,
        maxDuration: 90,
        requiredResources: [
          { type: 'material', name: 'gardening tools', required: false, alternatives: ['hands'] },
          { type: 'location', name: 'garden or outdoor space', required: true, alternatives: [] }
        ],
        weatherDependency: {
          indoor: false,
          outdoor: true,
          weatherDependent: true,
          preferredConditions: ['sunny', 'cloudy'],
          avoidedConditions: ['stormy', 'rainy']
        },
        ageRange: { min: 3, max: 99 },
        educationalValue: 0.8,
        physicalActivity: true,
        socialActivity: false,
        indoorOutdoor: 'outdoor',
        interestCategories: [InterestCategory.GARDENING, InterestCategory.NATURE, InterestCategory.SCIENCE],
        tags: ['outdoor', 'nature', 'gardening', 'educational'],
        seasonality: ['spring', 'summer', 'fall'],
        timeOfDay: ['morning', 'afternoon']
      },

      // Additional Family-Focused Activities
      {
        id: 'family-fitness',
        title: 'Family Fitness Challenge',
        description: 'Fun physical activities and exercises the whole family can do together',
        category: ActivityCategory.PHYSICAL,
        subcategories: ['fitness', 'teamwork', 'health'],
        difficulty: DifficultyLevel.EASY,
        minDuration: 20,
        maxDuration: 60,
        requiredResources: [
          { type: 'location', name: 'open space', required: true, alternatives: ['living room', 'backyard'] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: true,
          weatherDependent: false
        },
        ageRange: { min: 4, max: 99 },
        educationalValue: 0.5,
        physicalActivity: true,
        socialActivity: true,
        indoorOutdoor: 'both',
        interestCategories: [InterestCategory.FITNESS, InterestCategory.SOCIAL],
        tags: ['family', 'fitness', 'health', 'teamwork'],
        timeOfDay: ['morning', 'afternoon']
      },

      {
        id: 'family-cooking',
        title: 'Cook a Meal Together',
        description: 'Plan, prepare, and cook a healthy meal as a family team',
        category: ActivityCategory.CREATIVE,
        subcategories: ['cooking', 'teamwork', 'life-skills', 'nutrition'],
        difficulty: DifficultyLevel.INTERMEDIATE,
        minDuration: 30,
        maxDuration: 90,
        requiredResources: [
          { type: 'material', name: 'cooking ingredients', required: true, alternatives: [] },
          { type: 'material', name: 'cooking utensils', required: true, alternatives: [] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: false,
          weatherDependent: false
        },
        ageRange: { min: 5, max: 99 },
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'indoor',
        interestCategories: [InterestCategory.COOKING, InterestCategory.LEARNING, InterestCategory.SOCIAL],
        tags: ['family', 'cooking', 'life-skills', 'teamwork', 'nutrition'],
        timeOfDay: ['afternoon', 'evening']
      },

      {
        id: 'nature-scavenger-hunt',
        title: 'Family Nature Scavenger Hunt',
        description: 'Explore nature together while searching for specific items and learning about the environment',
        category: ActivityCategory.OUTDOOR,
        subcategories: ['nature', 'exploration', 'teamwork', 'education'],
        difficulty: DifficultyLevel.EASY,
        minDuration: 30,
        maxDuration: 90,
        requiredResources: [
          { type: 'material', name: 'scavenger hunt list', required: true, alternatives: ['smartphone app'] },
          { type: 'location', name: 'outdoor area', required: true, alternatives: ['park', 'backyard', 'trail'] }
        ],
        weatherDependency: {
          indoor: false,
          outdoor: true,
          weatherDependent: true,
          preferredConditions: ['sunny', 'cloudy'],
          avoidedConditions: ['stormy', 'rainy']
        },
        ageRange: { min: 4, max: 99 },
        educationalValue: 0.8,
        physicalActivity: true,
        socialActivity: true,
        indoorOutdoor: 'outdoor',
        interestCategories: [InterestCategory.NATURE, InterestCategory.LEARNING, InterestCategory.SOCIAL],
        tags: ['family', 'nature', 'exploration', 'education', 'teamwork'],
        seasonality: ['spring', 'summer', 'fall'],
        timeOfDay: ['morning', 'afternoon']
      },

      {
        id: 'family-meditation',
        title: 'Family Mindfulness and Meditation',
        description: 'Practice mindfulness and relaxation techniques together to reduce stress and improve well-being',
        category: ActivityCategory.RELAXATION,
        subcategories: ['mindfulness', 'meditation', 'wellness', 'stress-relief'],
        difficulty: DifficultyLevel.BEGINNER,
        minDuration: 15,
        maxDuration: 45,
        requiredResources: [
          { type: 'location', name: 'quiet space', required: true, alternatives: ['living room', 'bedroom'] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: true,
          weatherDependent: false
        },
        ageRange: { min: 6, max: 99 },
        educationalValue: 0.6,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'both',
        interestCategories: [InterestCategory.SOCIAL],
        tags: ['family', 'wellness', 'mindfulness', 'stress-relief', 'bonding'],
        timeOfDay: ['morning', 'evening']
      },

      {
        id: 'diy-craft-project',
        title: 'DIY Family Craft Project',
        description: 'Create something useful or decorative together using recycled materials and creativity',
        category: ActivityCategory.CREATIVE,
        subcategories: ['crafts', 'diy', 'recycling', 'creativity'],
        difficulty: DifficultyLevel.INTERMEDIATE,
        minDuration: 30,
        maxDuration: 120,
        requiredResources: [
          { type: 'material', name: 'craft supplies', required: true, alternatives: ['recycled materials'] },
          { type: 'material', name: 'tools', required: true, alternatives: ['scissors', 'glue', 'tape'] }
        ],
        weatherDependency: {
          indoor: true,
          outdoor: true,
          weatherDependent: false
        },
        ageRange: { min: 5, max: 99 },
        educationalValue: 0.7,
        physicalActivity: false,
        socialActivity: true,
        indoorOutdoor: 'both',
        interestCategories: [InterestCategory.CRAFTS, InterestCategory.LEARNING],
        tags: ['family', 'crafts', 'creativity', 'recycling', 'teamwork'],
        timeOfDay: ['afternoon']
      }
    ];
  }

  /**
   * Recommend activities based on user context and preferences
   */
  async recommendActivities(userId: string, context: ActivityContext): Promise<ActivityRecommendation[]> {
    try {
      const userPrefs = this.userPreferences.get(userId);
      const userFeedbackHistory = this.userFeedback.get(userId) || [];
      
      // Get available time from context
      const availableTime = this.extractAvailableTime(context);
      if (!availableTime) {
        return [];
      }

      // Filter activities based on context and preferences
      let candidateActivities = this.activityDatabase.filter(activity => 
        this.matchesTimeConstraints(activity, availableTime) &&
        this.matchesWeatherConstraints(activity, context) &&
        this.matchesLocationConstraints(activity, context)
      );

      // Apply user preferences if available
      if (userPrefs) {
        candidateActivities = this.applyUserPreferences(candidateActivities, userPrefs);
      }

      // Score activities based on interest matching and context
      const scoredActivities = candidateActivities.map(activity => ({
        activity,
        score: this.calculateActivityScore(activity, context, userPrefs, userFeedbackHistory)
      }));

      // Sort by score and take top recommendations
      scoredActivities.sort((a, b) => b.score - a.score);
      const topActivities = scoredActivities.slice(0, 5);

      // Convert to ActivityRecommendation format
      return topActivities.map(({ activity, score }) => 
        this.convertToRecommendation(activity, score, context, availableTime)
      );

    } catch (error) {
      console.error('Error generating activity recommendations:', error);
      return [];
    }
  }

  /**
   * Discover new activities based on user interests
   */
  async discoverNewActivities(userId: string, interests: Interest[]): Promise<ActivityRecommendation[]> {
    try {
      const userFeedbackHistory = this.userFeedback.get(userId) || [];
      const completedActivityIds = new Set(
        userFeedbackHistory.filter(f => f.completed).map(f => f.activityId)
      );

      // Find activities that match interests but haven't been completed
      const newActivities = this.activityDatabase.filter(activity => {
        if (completedActivityIds.has(activity.id)) {
          return false;
        }

        return activity.interestCategories.some(category =>
          interests.some(interest => 
            interest.category === category && interest.strength > 0.3
          )
        );
      });

      // Score based on interest strength and novelty
      const scoredActivities = newActivities.map(activity => ({
        activity,
        score: this.calculateInterestScore(activity, interests)
      }));

      scoredActivities.sort((a, b) => b.score - a.score);
      const topActivities = scoredActivities.slice(0, 3);

      // Create default time range for discovery recommendations
      const defaultTimeRange: TimeRange = {
        start: new Date(),
        end: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };

      return topActivities.map(({ activity, score }) => 
        this.convertToRecommendation(activity, score, {}, defaultTimeRange)
      );

    } catch (error) {
      console.error('Error discovering new activities:', error);
      return [];
    }
  }

  /**
   * Extract available time from activity context
   */
  private extractAvailableTime(context: ActivityContext): TimeRange | null {
    // If there's an estimated end time for current activity, use time after that
    if (context.estimatedEndTime) {
      return {
        start: context.estimatedEndTime,
        end: new Date(context.estimatedEndTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours after
      };
    }

    // Default to current time + 1 hour
    const now = new Date();
    return {
      start: now,
      end: new Date(now.getTime() + 60 * 60 * 1000)
    };
  }

  /**
   * Check if activity matches time constraints
   */
  private matchesTimeConstraints(activity: ActivityTemplate, availableTime: TimeRange): boolean {
    const availableMinutes = (availableTime.end.getTime() - availableTime.start.getTime()) / (1000 * 60);
    return activity.minDuration <= availableMinutes;
  }

  /**
   * Check if activity matches weather constraints
   */
  private matchesWeatherConstraints(activity: ActivityTemplate, context: ActivityContext): boolean {
    // For now, assume indoor activities are always suitable
    if (activity.indoorOutdoor === 'indoor' || activity.indoorOutdoor === 'both') {
      return true;
    }

    // TODO: Integrate with actual weather data from context
    // For now, assume outdoor activities are suitable unless it's stormy
    return true;
  }

  /**
   * Check if activity matches location constraints
   */
  private matchesLocationConstraints(activity: ActivityTemplate, context: ActivityContext): boolean {
    // For now, assume all activities are location-suitable
    // TODO: Implement location-based filtering
    return true;
  }

  /**
   * Apply user preferences to filter activities
   */
  private applyUserPreferences(activities: ActivityTemplate[], preferences: ActivityPreferences): ActivityTemplate[] {
    return activities.filter(activity => {
      // Check category preferences
      if (preferences.preferredCategories.length > 0 && 
          !preferences.preferredCategories.includes(activity.category)) {
        return false;
      }

      // Check difficulty preference
      if (preferences.preferredDifficulty && 
          activity.difficulty !== preferences.preferredDifficulty) {
        return false;
      }

      // Check indoor/outdoor preference
      if (preferences.indoorOutdoorPreference !== 'both' &&
          activity.indoorOutdoor !== 'both' &&
          activity.indoorOutdoor !== preferences.indoorOutdoorPreference) {
        return false;
      }

      // Check social preference
      if (preferences.socialPreference === 'solo' && activity.socialActivity) {
        return false;
      }
      if (preferences.socialPreference === 'group' && !activity.socialActivity) {
        return false;
      }

      return true;
    });
  }

  /**
   * Calculate activity score based on various factors
   */
  private calculateActivityScore(
    activity: ActivityTemplate, 
    context: ActivityContext, 
    preferences?: ActivityPreferences,
    feedbackHistory: ActivityFeedback[] = []
  ): number {
    let score = 0.5; // Base score

    // Interest matching score (if we had user interests)
    score += 0.2;

    // Educational value bonus
    score += activity.educationalValue * 0.2;

    // Time of day matching
    const currentHour = new Date().getHours();
    if (activity.timeOfDay) {
      const timeOfDay = this.getTimeOfDay(currentHour);
      if (activity.timeOfDay.includes(timeOfDay)) {
        score += 0.1;
      }
    }

    // Seasonal matching
    if (activity.seasonality) {
      const currentSeason = this.getCurrentSeason();
      if (activity.seasonality.includes(currentSeason)) {
        score += 0.1;
      }
    }

    // Preference matching bonus
    if (preferences) {
      if (preferences.preferredCategories.includes(activity.category)) {
        score += 0.2;
      }
      if (preferences.preferredDifficulty === activity.difficulty) {
        score += 0.1;
      }
    }

    // Feedback history penalty for recently completed activities
    const recentFeedback = feedbackHistory.filter(f => 
      f.activityId === activity.id && 
      Date.now() - f.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // 7 days
    );
    if (recentFeedback.length > 0) {
      score -= 0.3; // Reduce score for recently done activities
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate interest-based score for activity discovery
   */
  private calculateInterestScore(activity: ActivityTemplate, interests: Interest[]): number {
    let score = 0;
    
    for (const interestCategory of activity.interestCategories) {
      const matchingInterest = interests.find(i => i.category === interestCategory);
      if (matchingInterest) {
        score += matchingInterest.strength;
      }
    }

    // Normalize by number of interest categories
    return activity.interestCategories.length > 0 ? 
      score / activity.interestCategories.length : 0;
  }

  /**
   * Convert activity template to recommendation
   */
  private convertToRecommendation(
    activity: ActivityTemplate, 
    score: number, 
    context: ActivityContext | any,
    timeRange: TimeRange
  ): ActivityRecommendation {
    // Calculate appropriate duration based on available time
    const availableMinutes = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60);
    const activityDuration = Math.min(activity.minDuration, availableMinutes);
    
    return {
      id: `rec_${activity.id}_${Date.now()}`,
      type: 'activity' as any,
      title: activity.title,
      description: activity.description,
      confidence: score,
      reasoning: this.generateReasoning(activity, context),
      actionable: true,
      integrationActions: [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        generatedAt: new Date(),
        userId: '',
        contextId: '',
        engineVersion: '1.0.0',
        safetyValidated: true,
        privacyCompliant: true
      },
      category: activity.category,
      duration: {
        start: timeRange.start,
        end: new Date(timeRange.start.getTime() + activityDuration * 60 * 1000)
      },
      difficulty: activity.difficulty,
      requiredResources: activity.requiredResources,
      weatherDependency: activity.weatherDependency,
      ageAppropriate: true,
      educationalValue: activity.educationalValue,
      physicalActivity: activity.physicalActivity,
      socialActivity: activity.socialActivity
    };
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(activity: ActivityTemplate, context: any): string[] {
    const reasons: string[] = [];
    
    if (activity.educationalValue > 0.7) {
      reasons.push('High educational value for learning and development');
    }
    
    if (activity.physicalActivity) {
      reasons.push('Promotes physical activity and health');
    }
    
    if (activity.socialActivity) {
      reasons.push('Great for family bonding and social interaction');
    }
    
    const timeOfDay = this.getTimeOfDay(new Date().getHours());
    if (activity.timeOfDay?.includes(timeOfDay)) {
      reasons.push(`Perfect timing for ${timeOfDay} activities`);
    }

    if (reasons.length === 0) {
      reasons.push('Matches your interests and available time');
    }

    return reasons;
  }

  /**
   * Get current time of day category
   */
  private getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Get current season
   */
  private getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Check if activity is suitable for family participation
   */
  private isSuitableForFamily(activity: ActivityTemplate, context: FamilyContext): boolean {
    // Check age range compatibility for all family members
    // For now, assume family activities should be suitable for ages 5-99
    const familyAgeRange = { min: 5, max: 99 };
    
    if (activity.ageRange.min > familyAgeRange.max || activity.ageRange.max < familyAgeRange.min) {
      return false;
    }

    // Must be social activity
    if (!activity.socialActivity) {
      return false;
    }

    // Check if activity supports multiple participants
    const requiredSpace = activity.requiredResources.some(r => 
      r.name.includes('space') || r.name.includes('room')
    );

    return true;
  }

  /**
   * Check if activity meets health and wellness criteria
   */
  private meetsHealthCriteria(activity: ActivityTemplate): boolean {
    // Prioritize activities that promote health
    const healthBenefits = [
      activity.physicalActivity, // Physical health
      activity.educationalValue > 0.5, // Mental health through learning
      activity.category === ActivityCategory.OUTDOOR, // Fresh air and nature
      activity.interestCategories.includes(InterestCategory.FITNESS),
      activity.interestCategories.includes(InterestCategory.NATURE)
    ];

    // Activity should have at least one health benefit
    return healthBenefits.some(benefit => benefit);
  }

  /**
   * Prioritize activities that promote family bonding
   */
  private prioritizeFamilyBonding(activities: ActivityTemplate[]): ActivityTemplate[] {
    return activities.sort((a, b) => {
      const aScore = this.getFamilyBondingScore(a);
      const bScore = this.getFamilyBondingScore(b);
      return bScore - aScore;
    });
  }

  /**
   * Calculate family bonding score for an activity
   */
  private getFamilyBondingScore(activity: ActivityTemplate): number {
    let score = 0;

    // Cooperative activities score higher
    if (activity.subcategories.includes('cooperation')) score += 0.3;
    if (activity.subcategories.includes('teamwork')) score += 0.3;

    // Creative activities promote bonding
    if (activity.category === ActivityCategory.CREATIVE) score += 0.2;

    // Educational activities with family learning
    if (activity.category === ActivityCategory.EDUCATIONAL && activity.socialActivity) score += 0.2;

    // Cooking and life skills activities
    if (activity.subcategories.includes('cooking') || activity.subcategories.includes('life-skills')) score += 0.3;

    // Outdoor activities for shared experiences
    if (activity.category === ActivityCategory.OUTDOOR) score += 0.2;

    // Games and entertainment
    if (activity.interestCategories.includes(InterestCategory.GAMES)) score += 0.2;

    return Math.min(1, score);
  }

  /**
   * Calculate activity score for family context
   */
  private calculateFamilyActivityScore(activity: ActivityTemplate, context: FamilyContext): number {
    let score = 0.5; // Base score

    // Family bonding score
    score += this.getFamilyBondingScore(activity) * 0.3;

    // Health benefits score
    if (activity.physicalActivity) score += 0.2;
    if (activity.educationalValue > 0.6) score += 0.2;
    if (activity.category === ActivityCategory.OUTDOOR) score += 0.1;

    // Educational value for family learning
    score += activity.educationalValue * 0.2;

    // Time appropriateness
    const currentHour = new Date().getHours();
    if (activity.timeOfDay) {
      const timeOfDay = this.getTimeOfDay(currentHour);
      if (activity.timeOfDay.includes(timeOfDay)) {
        score += 0.1;
      }
    }

    // Seasonal appropriateness
    if (activity.seasonality) {
      const currentSeason = this.getCurrentSeason();
      if (activity.seasonality.includes(currentSeason)) {
        score += 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Convert activity template to family recommendation
   */
  private convertToFamilyRecommendation(
    activity: ActivityTemplate, 
    score: number, 
    context: FamilyContext
  ): FamilyActivityRecommendation {
    const defaultTimeRange: TimeRange = {
      start: new Date(),
      end: new Date(Date.now() + activity.minDuration * 60 * 1000)
    };

    return {
      id: `family_rec_${activity.id}_${Date.now()}`,
      type: 'activity' as any,
      title: activity.title,
      description: activity.description,
      confidence: score,
      reasoning: this.generateFamilyReasoning(activity, context),
      actionable: true,
      integrationActions: [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        generatedAt: new Date(),
        userId: context.familyId,
        contextId: 'family-context',
        engineVersion: '1.0.0',
        safetyValidated: true,
        privacyCompliant: true
      },
      category: activity.category,
      duration: defaultTimeRange,
      difficulty: activity.difficulty,
      requiredResources: activity.requiredResources,
      weatherDependency: activity.weatherDependency,
      ageAppropriate: true,
      educationalValue: activity.educationalValue,
      physicalActivity: activity.physicalActivity,
      socialActivity: activity.socialActivity,
      familyMembers: context.membersPresent,
      roleAssignments: this.generateRoleAssignments(activity, context.membersPresent),
      coordinationRequired: this.requiresCoordination(activity),
      conflictResolution: this.getConflictResolutionStrategy(context)
    };
  }

  /**
   * Generate reasoning for family recommendations
   */
  private generateFamilyReasoning(activity: ActivityTemplate, context: FamilyContext): string[] {
    const reasons: string[] = [];
    
    if (this.getFamilyBondingScore(activity) > 0.5) {
      reasons.push('Excellent for family bonding and creating shared memories');
    }
    
    if (activity.physicalActivity) {
      reasons.push('Promotes physical health and active lifestyle for the whole family');
    }
    
    if (activity.educationalValue > 0.6) {
      reasons.push('Educational value helps family members learn together');
    }
    
    if (activity.category === ActivityCategory.CREATIVE) {
      reasons.push('Creative activities foster imagination and self-expression');
    }

    if (activity.subcategories.includes('cooking') || activity.subcategories.includes('life-skills')) {
      reasons.push('Teaches valuable life skills while spending quality time together');
    }

    if (activity.category === ActivityCategory.OUTDOOR) {
      reasons.push('Outdoor activities provide fresh air and connection with nature');
    }

    if (reasons.length === 0) {
      reasons.push('Great activity for family participation and enjoyment');
    }

    return reasons;
  }

  /**
   * Generate role assignments for family members
   */
  private generateRoleAssignments(activity: ActivityTemplate, familyMembers: string[]): any[] {
    const roles: any[] = [];

    // Simple role assignment based on activity type
    if (activity.subcategories.includes('cooking')) {
      roles.push({
        userId: familyMembers[0],
        role: 'Head Chef',
        responsibilities: ['Lead cooking process', 'Ensure safety'],
        timeCommitment: activity.minDuration
      });
      
      if (familyMembers.length > 1) {
        roles.push({
          userId: familyMembers[1],
          role: 'Sous Chef',
          responsibilities: ['Assist with preparation', 'Clean up'],
          timeCommitment: activity.minDuration
        });
      }
    } else if (activity.category === ActivityCategory.CREATIVE) {
      familyMembers.forEach((member, index) => {
        roles.push({
          userId: member,
          role: 'Creative Partner',
          responsibilities: ['Contribute ideas', 'Participate actively'],
          timeCommitment: activity.minDuration
        });
      });
    } else {
      // Default roles for other activities
      familyMembers.forEach((member, index) => {
        roles.push({
          userId: member,
          role: index === 0 ? 'Activity Leader' : 'Participant',
          responsibilities: index === 0 ? ['Guide activity', 'Ensure everyone participates'] : ['Participate actively', 'Support others'],
          timeCommitment: activity.minDuration
        });
      });
    }

    return roles;
  }

  /**
   * Check if activity requires coordination
   */
  private requiresCoordination(activity: ActivityTemplate): boolean {
    return activity.subcategories.includes('cooperation') || 
           activity.subcategories.includes('teamwork') ||
           activity.subcategories.includes('cooking') ||
           activity.category === ActivityCategory.EDUCATIONAL;
  }

  /**
   * Get conflict resolution strategy based on family context
   */
  private getConflictResolutionStrategy(context: FamilyContext): any {
    // Use family dynamics if available, otherwise default to democratic
    const strategy = context.groupDynamics?.conflictResolution || 'discussion';
    
    return {
      strategy: strategy,
      fallbackOptions: ['compromise', 'rotation', 'voting'],
      timeoutMinutes: 5
    };
  }

  /**
   * Recommend family activities that promote bonding and health
   */
  async recommendFamilyActivities(familyId: string, context: FamilyContext): Promise<FamilyActivityRecommendation[]> {
    try {
      // Get family members and their preferences
      const familyMembers = context.membersPresent;
      if (familyMembers.length < 2) {
        return []; // Need at least 2 members for family activities
      }

      // Filter activities suitable for family participation
      let familyActivities = this.activityDatabase.filter(activity => 
        activity.socialActivity && // Must be social
        this.isSuitableForFamily(activity, context) &&
        this.meetsHealthCriteria(activity)
      );

      // Prioritize family bonding activities
      familyActivities = this.prioritizeFamilyBonding(familyActivities);

      // Score activities based on family context
      const scoredActivities = familyActivities.map(activity => ({
        activity,
        score: this.calculateFamilyActivityScore(activity, context)
      }));

      // Sort by score and take top recommendations
      scoredActivities.sort((a, b) => b.score - a.score);
      const topActivities = scoredActivities.slice(0, 4);

      // Convert to FamilyActivityRecommendation format
      return topActivities.map(({ activity, score }) => 
        this.convertToFamilyRecommendation(activity, score, context)
      );

    } catch (error) {
      console.error('Error generating family activity recommendations:', error);
      return [];
    }
  }

  async updateActivityPreferences(userId: string, preferences: ActivityPreferences): Promise<void> {
    this.userPreferences.set(userId, preferences);
  }

  async trackActivityCompletion(userId: string, activityId: string, feedback: ActivityFeedback): Promise<void> {
    const userFeedback = this.userFeedback.get(userId) || [];
    userFeedback.push(feedback);
    this.userFeedback.set(userId, userFeedback);
  }

  /**
   * Validate activity safety for child users
   */
  async validateActivitySafety(activity: ActivityRecommendation, userId: string): Promise<boolean> {
    try {
      // Get user profile to determine age and safety requirements
      const userProfile = await this.getUserProfile(userId);
      
      // Perform comprehensive safety validation
      const safetyResult = await this.performActivitySafetyValidation(activity, userProfile);
      
      // Log safety decision for audit trail
      await this.logActivitySafetyDecision(activity, userId, safetyResult);
      
      return safetyResult.isApproved;
    } catch (error) {
      console.error('Error validating activity safety:', error);
      // Fail safe - reject activity if validation fails
      return false;
    }
  }

  /**
   * Get user profile for safety validation
   */
  private async getUserProfile(userId: string): Promise<UserSafetyProfile> {
    // In a real implementation, this would fetch from user store
    // For now, return a mock profile with child safety defaults
    return {
      userId,
      age: 8, // Default to child age for safety
      ageGroup: 'child',
      parentalControlsEnabled: true,
      supervisionLevel: 'moderate',
      allowedActivityCategories: [
        ActivityCategory.EDUCATIONAL,
        ActivityCategory.CREATIVE,
        ActivityCategory.PHYSICAL,
        ActivityCategory.SOCIAL
      ],
      blockedContent: ['violence', 'inappropriate', 'dangerous'],
      maxActivityDuration: 120, // 2 hours max
      requiresSupervision: true
    };
  }

  /**
   * Perform comprehensive activity safety validation
   */
  private async performActivitySafetyValidation(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): Promise<ActivitySafetyResult> {
    const violations: ActivitySafetyViolation[] = [];
    const warnings: string[] = [];

    // 1. Age appropriateness validation
    const ageViolations = this.validateAgeAppropriateness(activity, userProfile);
    violations.push(...ageViolations);

    // 2. Content safety validation
    const contentViolations = await this.validateActivityContent(activity, userProfile);
    violations.push(...contentViolations);

    // 3. Resource safety validation
    const resourceViolations = this.validateResourceSafety(activity, userProfile);
    violations.push(...resourceViolations);

    // 4. Duration and supervision validation
    const supervisionViolations = this.validateSupervisionRequirements(activity, userProfile);
    violations.push(...supervisionViolations);

    // 5. Educational value validation for children
    const educationalWarnings = this.validateEducationalValue(activity, userProfile);
    warnings.push(...educationalWarnings);

    // Determine if parental approval is required
    const requiresParentalApproval = this.determineParentalApprovalRequirement(
      activity, 
      userProfile, 
      violations
    );

    const isApproved = violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0;

    return {
      isApproved,
      requiresParentalApproval,
      violations,
      warnings,
      safetyScore: this.calculateActivitySafetyScore(activity, violations),
      recommendations: this.generateSafetyRecommendations(violations, userProfile)
    };
  }

  /**
   * Validate age appropriateness of activity
   */
  private validateAgeAppropriateness(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): ActivitySafetyViolation[] {
    const violations: ActivitySafetyViolation[] = [];

    // Check if activity is marked as age appropriate
    if (!activity.ageAppropriate) {
      violations.push({
        type: 'age_inappropriate',
        severity: 'high',
        description: `Activity is not marked as age-appropriate for user age ${userProfile.age}`,
        recommendation: 'Find age-appropriate alternative activities'
      });
    }

    // Check difficulty level appropriateness for young children
    if (userProfile.age < 10 && activity.difficulty === DifficultyLevel.ADVANCED) {
      violations.push({
        type: 'difficulty_inappropriate',
        severity: 'medium',
        description: 'Advanced difficulty level may be too challenging for young children',
        recommendation: 'Consider easier difficulty alternatives'
      });
    }

    // Check difficulty level appropriateness for very young children
    if (userProfile.age < 6 && activity.difficulty === DifficultyLevel.INTERMEDIATE) {
      violations.push({
        type: 'difficulty_inappropriate',
        severity: 'medium',
        description: 'Intermediate difficulty level may be challenging for very young children',
        recommendation: 'Consider beginner level activities'
      });
    }

    return violations;
  }

  /**
   * Validate activity content for child safety
   */
  private async validateActivityContent(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): Promise<ActivitySafetyViolation[]> {
    const violations: ActivitySafetyViolation[] = [];

    // Check for blocked content in title and description
    const contentToCheck = `${activity.title} ${activity.description}`.toLowerCase();
    
    for (const blockedTerm of userProfile.blockedContent) {
      if (contentToCheck.includes(blockedTerm.toLowerCase())) {
        violations.push({
          type: 'inappropriate_content',
          severity: 'critical',
          description: `Activity contains blocked content: ${blockedTerm}`,
          recommendation: 'Block activity and suggest safer alternatives'
        });
      }
    }

    // Check activity category against allowed categories
    if (!userProfile.allowedActivityCategories.includes(activity.category)) {
      violations.push({
        type: 'category_restricted',
        severity: 'high',
        description: `Activity category ${activity.category} not allowed for this user`,
        recommendation: 'Suggest activities from allowed categories'
      });
    }

    // Validate educational content if present
    if (activity.category === ActivityCategory.EDUCATIONAL) {
      const educationalSafety = await this.validateEducationalContent(activity, userProfile);
      violations.push(...educationalSafety);
    }

    return violations;
  }

  /**
   * Validate educational content safety
   */
  private async validateEducationalContent(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): Promise<ActivitySafetyViolation[]> {
    const violations: ActivitySafetyViolation[] = [];

    // Check for age-appropriate educational content
    if (userProfile.age < 8 && activity.description.toLowerCase().includes('experiment')) {
      // Young children need supervision for experiments
      violations.push({
        type: 'supervision_required',
        severity: 'medium',
        description: 'Educational experiments require adult supervision for young children',
        recommendation: 'Ensure adult supervision is available'
      });
    }

    // Validate science content safety
    if (activity.title.toLowerCase().includes('science') || 
        activity.description.toLowerCase().includes('chemical')) {
      violations.push({
        type: 'safety_equipment_required',
        severity: 'medium',
        description: 'Science activities may require safety equipment and supervision',
        recommendation: 'Ensure safety equipment and adult supervision'
      });
    }

    return violations;
  }

  /**
   * Validate resource safety
   */
  private validateResourceSafety(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): ActivitySafetyViolation[] {
    const violations: ActivitySafetyViolation[] = [];

    for (const resource of activity.requiredResources) {
      // Check for potentially dangerous resources
      const dangerousResources = ['knife', 'sharp', 'hot', 'chemical', 'fire', 'stove', 'oven'];
      const resourceName = resource.name.toLowerCase();

      for (const dangerous of dangerousResources) {
        if (resourceName.includes(dangerous)) {
          violations.push({
            type: 'dangerous_resource',
            severity: userProfile.age < 12 ? 'critical' : 'high',
            description: `Activity requires potentially dangerous resource: ${resource.name}`,
            recommendation: 'Require adult supervision or find safer alternatives'
          });
        }
      }

      // Check for age-inappropriate tools
      if (userProfile.age < 8 && resourceName.includes('tool')) {
        violations.push({
          type: 'inappropriate_tool',
          severity: 'medium',
          description: `Tools may not be appropriate for children under 8: ${resource.name}`,
          recommendation: 'Use child-safe alternatives or ensure supervision'
        });
      }
    }

    return violations;
  }

  /**
   * Validate supervision requirements
   */
  private validateSupervisionRequirements(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): ActivitySafetyViolation[] {
    const violations: ActivitySafetyViolation[] = [];

    // Check activity duration against user limits
    const activityDuration = (activity.duration.end.getTime() - activity.duration.start.getTime()) / (1000 * 60);
    
    if (activityDuration > userProfile.maxActivityDuration) {
      violations.push({
        type: 'duration_exceeded',
        severity: 'medium',
        description: `Activity duration (${activityDuration} min) exceeds limit (${userProfile.maxActivityDuration} min)`,
        recommendation: 'Reduce activity duration or break into smaller sessions'
      });
    }

    // Check if supervision is required for young children
    if (userProfile.age < 10 && userProfile.requiresSupervision) {
      if (activity.category === ActivityCategory.PHYSICAL || 
          activity.category === ActivityCategory.OUTDOOR ||
          activity.requiredResources.some(r => r.name.includes('tool'))) {
        violations.push({
          type: 'supervision_required',
          severity: 'medium',
          description: 'Activity requires adult supervision for young children',
          recommendation: 'Ensure adult supervision is available'
        });
      }
    }

    return violations;
  }

  /**
   * Validate educational value for children
   */
  private validateEducationalValue(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile
  ): string[] {
    const warnings: string[] = [];

    // Encourage educational activities for children
    if (userProfile.age < 16 && activity.educationalValue < 0.3) {
      warnings.push('Consider activities with higher educational value for child development');
    }

    // Encourage physical activities for health
    if (!activity.physicalActivity && userProfile.age < 16) {
      warnings.push('Consider including physical activities for healthy development');
    }

    return warnings;
  }

  /**
   * Determine if parental approval is required
   */
  private determineParentalApprovalRequirement(
    activity: ActivityRecommendation, 
    userProfile: UserSafetyProfile, 
    violations: ActivitySafetyViolation[]
  ): boolean {
    // Always require approval for children under 13
    if (userProfile.age < 13) {
      return true;
    }

    // Require approval if there are any safety violations
    if (violations.length > 0) {
      return true;
    }

    // Require approval for activities with dangerous resources
    const hasDangerousResources = activity.requiredResources.some(r => 
      ['knife', 'sharp', 'hot', 'chemical', 'fire'].some(dangerous => 
        r.name.toLowerCase().includes(dangerous)
      )
    );

    if (hasDangerousResources) {
      return true;
    }

    // Require approval for outdoor activities for young children
    if (userProfile.age < 10 && activity.category === ActivityCategory.OUTDOOR) {
      return true;
    }

    return false;
  }

  /**
   * Calculate activity safety score
   */
  private calculateActivitySafetyScore(
    activity: ActivityRecommendation, 
    violations: ActivitySafetyViolation[]
  ): number {
    let score = 1.0;

    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical':
          score -= 0.5;
          break;
        case 'high':
          score -= 0.3;
          break;
        case 'medium':
          score -= 0.2;
          break;
        case 'low':
          score -= 0.1;
          break;
      }
    }

    // Bonus for educational activities
    if (activity.educationalValue > 0.7) {
      score += 0.1;
    }

    // Bonus for age-appropriate activities
    if (activity.ageAppropriate) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate safety recommendations
   */
  private generateSafetyRecommendations(
    violations: ActivitySafetyViolation[], 
    userProfile: UserSafetyProfile
  ): string[] {
    const recommendations: string[] = [];

    if (violations.length === 0) {
      recommendations.push('Activity meets all safety requirements');
      return recommendations;
    }

    // Group recommendations by type
    const supervisionNeeded = violations.some(v => v.type === 'supervision_required');
    const dangerousResources = violations.some(v => v.type === 'dangerous_resource');
    const ageInappropriate = violations.some(v => v.type === 'age_inappropriate');

    if (supervisionNeeded) {
      recommendations.push('Ensure adult supervision during this activity');
    }

    if (dangerousResources) {
      recommendations.push('Use child-safe alternatives for potentially dangerous resources');
    }

    if (ageInappropriate) {
      recommendations.push('Consider age-appropriate alternatives');
    }

    // Add general safety recommendation
    recommendations.push('Review activity details with parent/guardian before proceeding');

    return recommendations;
  }

  /**
   * Log activity safety decision for audit trail
   */
  private async logActivitySafetyDecision(
    activity: ActivityRecommendation, 
    userId: string, 
    safetyResult: ActivitySafetyResult
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date(),
      userId,
      activityId: activity.id,
      activityTitle: activity.title,
      safetyResult,
      approved: safetyResult.isApproved,
      requiresParentalApproval: safetyResult.requiresParentalApproval,
      safetyScore: safetyResult.safetyScore
    };

    // In a real implementation, this would be stored in an encrypted audit log
    console.log('Activity safety decision logged:', logEntry);

    // Alert for critical safety violations
    const criticalViolations = safetyResult.violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      console.warn('CRITICAL ACTIVITY SAFETY VIOLATION:', {
        userId,
        activityId: activity.id,
        violations: criticalViolations
      });
    }
  }
}