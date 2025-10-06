// Reminder-specific events for the event bus

export interface ReminderEvents {
  // Reminder lifecycle events
  'reminder:created': ReminderCreatedData
  'reminder:updated': ReminderUpdatedData
  'reminder:deleted': ReminderDeletedData
  
  // Reminder processing events
  'reminder:triggered': ReminderTriggeredData
  'reminder:delivered': ReminderDeliveredData
  'reminder:failed': ReminderFailedData
  'reminder:completed': ReminderCompletedData
  'reminder:snoozed': ReminderSnoozedData
  
  // Context events
  'reminder:context:analyzed': ContextAnalyzedData
  'reminder:context:changed': ContextChangedData
  'reminder:delivery:deferred': DeliveryDeferredData
}

export interface ReminderCreatedData {
  reminderId: string
  userId: string
  reminderType: string
  triggerTime: Date
  timestamp: Date
}

export interface ReminderUpdatedData {
  reminderId: string
  userId: string
  changes: string[]
  timestamp: Date
}

export interface ReminderDeletedData {
  reminderId: string
  userId: string
  reason?: string
  timestamp: Date
}

export interface ReminderTriggeredData {
  reminderId: string
  userId: string
  triggerTime: Date
  actualTriggerTime: Date
  context: UserContextSummary
  timestamp: Date
}

export interface ReminderDeliveredData {
  reminderId: string
  userId: string
  deliveryMethod: string
  deliveryTime: Date
  success: boolean
  responseTime?: number
  userResponse?: string
  timestamp: Date
}

export interface ReminderFailedData {
  reminderId: string
  userId: string
  failureReason: string
  errorCode: string
  retryCount: number
  nextRetryTime?: Date
  timestamp: Date
}

export interface ReminderCompletedData {
  reminderId: string
  userId: string
  completionTime: Date
  completionMethod: string
  feedback?: ReminderFeedbackSummary
  timestamp: Date
}

export interface ReminderSnoozedData {
  reminderId: string
  userId: string
  snoozeTime: Date
  snoozeDuration: number
  newTriggerTime: Date
  reason?: string
  timestamp: Date
}

export interface ContextAnalyzedData {
  userId: string
  context: UserContextSummary
  confidence: number
  analysisTime: number
  timestamp: Date
}

export interface ContextChangedData {
  userId: string
  previousContext: UserContextSummary
  newContext: UserContextSummary
  changeType: string
  timestamp: Date
}

export interface DeliveryDeferredData {
  reminderId: string
  userId: string
  originalTriggerTime: Date
  deferredUntil: Date
  deferralReason: string
  timestamp: Date
}

export interface UserContextSummary {
  activity: string
  location: string
  availability: string
  interruptibility: string
  deviceProximity: boolean
}

export interface ReminderFeedbackSummary {
  rating: number
  wasHelpful: boolean
  feedbackType: string
  comment?: string
}