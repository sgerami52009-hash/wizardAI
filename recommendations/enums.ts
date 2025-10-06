/**
 * Enumerations for the personalized recommendations engine
 */

export enum RecommendationType {
  ACTIVITY = 'activity',
  SCHEDULE = 'schedule',
  EDUCATIONAL = 'educational',
  HOUSEHOLD = 'household',
  MIXED = 'mixed'
}

export enum InteractionType {
  VIEW = 'view',
  ACCEPT = 'accept',
  REJECT = 'reject',
  MODIFY = 'modify',
  COMPLETE = 'complete',
  ABANDON = 'abandon',
  SHARE = 'share',
  SAVE = 'save'
}

export enum InterestCategory {
  SPORTS = 'sports',
  ARTS = 'arts',
  MUSIC = 'music',
  READING = 'reading',
  COOKING = 'cooking',
  GARDENING = 'gardening',
  TECHNOLOGY = 'technology',
  SCIENCE = 'science',
  HISTORY = 'history',
  TRAVEL = 'travel',
  GAMES = 'games',
  FITNESS = 'fitness',
  CRAFTS = 'crafts',
  NATURE = 'nature',
  SOCIAL = 'social',
  LEARNING = 'learning',
  ENTERTAINMENT = 'entertainment'
}

export enum ActivityCategory {
  PHYSICAL = 'physical',
  CREATIVE = 'creative',
  EDUCATIONAL = 'educational',
  SOCIAL = 'social',
  RELAXATION = 'relaxation',
  HOUSEHOLD = 'household',
  ENTERTAINMENT = 'entertainment',
  OUTDOOR = 'outdoor',
  INDOOR = 'indoor',
  FAMILY = 'family',
  SOLO = 'solo',
  SKILL_BUILDING = 'skill_building',
  HEALTH = 'health',
  CULTURAL = 'cultural',
  VOLUNTEER = 'volunteer',
  EXERCISE = 'exercise',
  WORK = 'work'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  EASY = 'easy',
  MEDIUM = 'medium',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  HARD = 'hard',
  EXPERT = 'expert'
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  FAMILY = 'family',
  PRIVATE = 'private',
  ANONYMOUS = 'anonymous'
}

export enum OptimizationType {
  TIME_SAVING = 'time_saving',
  STRESS_REDUCTION = 'stress_reduction',
  EFFICIENCY = 'efficiency',
  COST_REDUCTION = 'cost_reduction',
  HEALTH_IMPROVEMENT = 'health_improvement',
  FAMILY_BONDING = 'family_bonding',
  LEARNING = 'learning',
  AUTOMATION = 'automation',
  TIME_BLOCKING = 'time_blocking',
  TASK_BATCHING = 'task_batching',
  ROUTINE_OPTIMIZATION = 'routine_optimization'
}

export enum Subject {
  MATHEMATICS = 'mathematics',
  SCIENCE = 'science',
  LANGUAGE_ARTS = 'language_arts',
  SOCIAL_STUDIES = 'social_studies',
  ART = 'art',
  MUSIC = 'music',
  PHYSICAL_EDUCATION = 'physical_education',
  TECHNOLOGY = 'technology',
  FOREIGN_LANGUAGE = 'foreign_language',
  LIFE_SKILLS = 'life_skills',
  CRITICAL_THINKING = 'critical_thinking',
  CREATIVITY = 'creativity'
}

export enum SkillLevel {
  BELOW_GRADE = 'below_grade',
  AT_GRADE = 'at_grade',
  ABOVE_GRADE = 'above_grade',
  GIFTED = 'gifted',
  NEEDS_SUPPORT = 'needs_support'
}

export enum InteractivityLevel {
  PASSIVE = 'passive',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  IMMERSIVE = 'immersive'
}

export enum ModelType {
  COLLABORATIVE_FILTERING = 'collaborative_filtering',
  CONTENT_BASED = 'content_based',
  HYBRID = 'hybrid',
  CONTEXTUAL_BANDIT = 'contextual_bandit',
  REINFORCEMENT_LEARNING = 'reinforcement_learning',
  DEEP_LEARNING = 'deep_learning'
}

export enum DataOperation {
  READ = 'read',
  WRITE = 'write',
  UPDATE = 'update',
  DELETE = 'delete',
  ANALYZE = 'analyze',
  SHARE = 'share',
  EXPORT = 'export'
}

export enum SafetyLevel {
  SAFE = 'safe',
  CAUTION = 'caution',
  RESTRICTED = 'restricted',
  BLOCKED = 'blocked'
}

export enum EngagementLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum RecommendationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum ContextSource {
  SENSOR = 'sensor',
  USER_INPUT = 'user_input',
  CALENDAR = 'calendar',
  LOCATION = 'location',
  WEATHER = 'weather',
  DEVICE = 'device',
  INFERRED = 'inferred',
  HISTORICAL = 'historical'
}

export enum LearningMode {
  SUPERVISED = 'supervised',
  UNSUPERVISED = 'unsupervised',
  REINFORCEMENT = 'reinforcement',
  SEMI_SUPERVISED = 'semi_supervised',
  FEDERATED = 'federated'
}

export enum IntegrationSystem {
  VOICE = 'voice',
  AVATAR = 'avatar',
  SCHEDULING = 'scheduling',
  SMART_HOME = 'smart_home',
  CALENDAR = 'calendar',
  WEATHER = 'weather',
  LOCATION = 'location'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryAction {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  DEGRADE = 'degrade',
  SKIP = 'skip',
  ALERT = 'alert',
  SHUTDOWN = 'shutdown'
}