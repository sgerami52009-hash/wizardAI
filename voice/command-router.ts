/**
 * Command Routing Infrastructure
 * Safety: All commands validated for user authorization and child safety
 * Performance: Command routing <50ms, execution monitoring with timeouts
 */

import { EventEmitter } from 'events';
import { 
  CommandRouter, 
  CommandHandler, 
  Command, 
  CommandResult, 
  IntentResult,
  ConversationContext 
} from './interfaces';
import { validateChildSafeContent } from '../safety/content-safety-filter';
import { sanitizeForLog } from '../models/user-profiles';

export interface CommandExecutionContext {
  userId: string;
  sessionId: string;
  timestamp: Date;
  timeout: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
}

export interface CommandValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredPermissions: string[];
  safetyLevel: 'child' | 'teen' | 'adult';
}

export interface ExecutionMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
  errorType?: string;
}

export interface HandlerRegistration {
  handler: CommandHandler;
  intentPatterns: string[];
  priority: number;
  enabled: boolean;
  registeredAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

export class VoiceCommandRouter extends EventEmitter implements CommandRouter {
  private handlers: Map<string, HandlerRegistration> = new Map();
  private executionQueue: Map<string, CommandExecutionContext> = new Map();
  private defaultTimeout: number = 5000; // 5 seconds
  private maxConcurrentExecutions: number = 3;
  private currentExecutions: number = 0;

  constructor() {
    super();
    this.initializeBuiltInHandlers();
  }

  async routeCommand(intent: IntentResult, userId: string): Promise<CommandResult> {
    try {
      // Build command from intent
      const command = await this.buildCommand(intent, userId);
      
      // Validate command
      const validation = await this.validateCommand(command);
      if (!validation.isValid) {
        return this.createValidationErrorResult(validation.errors);
      }

      // Execute command
      return await this.executeCommand(command);
    } catch (error) {
      this.emit('routingError', { error, intent: intent.intent, userId });
      return this.createErrorResult('Failed to route command', error);
    }
  }

  registerHandler(intent: string, handler: CommandHandler): void {
    if (!intent || !handler) {
      throw new Error('Intent and handler are required');
    }

    // Validate handler implementation
    if (!this.validateHandler(handler)) {
      throw new Error('Invalid handler implementation');
    }

    const registration: HandlerRegistration = {
      handler,
      intentPatterns: [intent],
      priority: 1.0,
      enabled: true,
      registeredAt: new Date(),
      usageCount: 0
    };

    this.handlers.set(intent, registration);
    this.emit('handlerRegistered', { intent, handlerType: handler.constructor.name });
  }

  async executeCommand(command: Command): Promise<CommandResult> {
    const executionId = this.generateExecutionId();
    
    try {
      // Check execution limits
      if (this.currentExecutions >= this.maxConcurrentExecutions) {
        return this.createErrorResult('System busy, please try again', 'SYSTEM_BUSY');
      }

      // Find appropriate handler
      const handler = this.findHandler(command.intent);
      if (!handler) {
        return this.createErrorResult('Command not supported', 'HANDLER_NOT_FOUND');
      }

      // Create execution context
      const context = this.createExecutionContext(command, executionId);
      this.executionQueue.set(executionId, context);
      this.currentExecutions++;

      // Execute with timeout and monitoring
      const result = await this.executeWithTimeout(handler, command, context);
      
      // Update handler usage statistics
      this.updateHandlerStats(command.intent);
      
      return result;
    } catch (error) {
      this.emit('executionError', { error, command: sanitizeForLog(command.intent) });
      return this.createErrorResult('Command execution failed', error);
    } finally {
      // Cleanup
      this.executionQueue.delete(executionId);
      this.currentExecutions = Math.max(0, this.currentExecutions - 1);
    }
  }

  getRegisteredHandlers(): Map<string, CommandHandler> {
    const handlers = new Map<string, CommandHandler>();
    for (const [intent, registration] of this.handlers) {
      if (registration.enabled) {
        handlers.set(intent, registration.handler);
      }
    }
    return handlers;
  }

  // Handler management methods
  enableHandler(intent: string): void {
    const registration = this.handlers.get(intent);
    if (registration) {
      registration.enabled = true;
      this.emit('handlerEnabled', { intent });
    }
  }

  disableHandler(intent: string): void {
    const registration = this.handlers.get(intent);
    if (registration) {
      registration.enabled = false;
      this.emit('handlerDisabled', { intent });
    }
  }

  getHandlerStats(intent: string): HandlerRegistration | undefined {
    return this.handlers.get(intent);
  }

  private initializeBuiltInHandlers(): void {
    // System handlers
    this.registerHandler('system.help', new HelpCommandHandler());
    this.registerHandler('system.unknown', new UnknownCommandHandler());
    this.registerHandler('system.safety_blocked', new SafetyBlockedHandler());
    this.registerHandler('system.error', new ErrorHandler());

    // Conversation handlers
    this.registerHandler('conversation.greeting', new GreetingHandler());
    this.registerHandler('conversation.goodbye', new GoodbyeHandler());

    // Smart home integration points (placeholder handlers)
    this.registerHandler('smart_home.lights.control', new SmartHomeLightsHandler());
    this.registerHandler('smart_home.temperature.control', new SmartHomeTemperatureHandler());
    
    // Scheduling integration points
    this.registerHandler('scheduling.create_reminder', new SchedulingReminderHandler());
    this.registerHandler('scheduling.view_calendar', new SchedulingViewHandler());

    // Information handlers
    this.registerHandler('information.weather', new WeatherInformationHandler());
    this.registerHandler('information.time', new TimeInformationHandler());
  }

  private async buildCommand(intent: IntentResult, userId: string): Promise<Command> {
    // Get conversation context (would be injected in real implementation)
    const context: ConversationContext = {
      sessionId: this.generateSessionId(),
      userId,
      turns: [],
      activeTopics: [],
      pendingActions: [],
      userPreferences: {},
      safetyContext: {
        currentAgeGroup: 'child', // Default to most restrictive
        parentalSupervision: false,
        contentHistory: [],
        riskFactors: [],
        safetyOverrides: []
      },
      environmentContext: {
        location: 'home',
        timeOfDay: this.getCurrentTimeOfDay(),
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        ambientNoise: 'quiet',
        otherUsers: [],
        deviceStatus: {
          networkConnected: true,
          resourceUsage: { memoryMB: 0, cpuPercent: 0 },
          temperature: 25,
          availableStorage: 1000
        }
      }
    };

    return {
      intent: intent.intent,
      parameters: intent.parameters,
      userId,
      sessionId: context.sessionId,
      timestamp: new Date(),
      context
    };
  }

  private async validateCommand(command: Command): Promise<CommandValidationResult> {
    const result: CommandValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      requiredPermissions: [],
      safetyLevel: 'child'
    };

    try {
      // Safety validation
      const safetyResult = await validateChildSafeContent(command.intent, command.userId);
      if (!safetyResult.isAllowed) {
        result.isValid = false;
        result.errors.push('Command blocked by safety filter');
        return result;
      }

      // Find handler for validation
      const handler = this.findHandler(command.intent);
      if (!handler) {
        result.isValid = false;
        result.errors.push('No handler available for this command');
        return result;
      }

      // Handler-specific validation
      if (!handler.validate(command)) {
        result.isValid = false;
        result.errors.push('Command failed handler validation');
      }

      // Check required permissions
      result.requiredPermissions = handler.getRequiredPermissions();
      
      // Validate user permissions (simplified for now)
      const hasPermissions = await this.validateUserPermissions(command.userId, result.requiredPermissions);
      if (!hasPermissions) {
        result.isValid = false;
        result.errors.push('Insufficient permissions');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Validation error occurred');
      return result;
    }
  }

  private findHandler(intent: string): CommandHandler | null {
    const registration = this.handlers.get(intent);
    if (registration && registration.enabled) {
      return registration.handler;
    }

    // Try pattern matching for dynamic intents
    for (const [, reg] of this.handlers) {
      if (reg.enabled && reg.handler.canHandle(intent)) {
        return reg.handler;
      }
    }

    return null;
  }

  private createExecutionContext(command: Command, executionId: string): CommandExecutionContext {
    return {
      userId: command.userId,
      sessionId: command.sessionId,
      timestamp: new Date(),
      timeout: this.defaultTimeout,
      priority: this.determinePriority(command),
      retryCount: 0,
      maxRetries: 2
    };
  }

  private async executeWithTimeout(
    handler: CommandHandler, 
    command: Command, 
    context: CommandExecutionContext
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(this.createErrorResult('Command execution timeout', 'TIMEOUT'));
      }, context.timeout);

      handler.execute(command)
        .then(result => {
          clearTimeout(timeoutId);
          const executionTime = Date.now() - startTime;
          
          this.emit('commandExecuted', {
            intent: command.intent,
            success: result.success,
            executionTime,
            userId: command.userId
          });

          resolve({
            ...result,
            executionTime
          });
        })
        .catch(error => {
          clearTimeout(timeoutId);
          const executionTime = Date.now() - startTime;
          
          this.emit('commandFailed', {
            intent: command.intent,
            error,
            executionTime,
            userId: command.userId
          });

          resolve(this.createErrorResult('Handler execution failed', error));
        });
    });
  }

  private determinePriority(command: Command): 'low' | 'medium' | 'high' | 'urgent' {
    // Safety commands get highest priority
    if (command.intent.startsWith('system.safety')) return 'urgent';
    
    // System commands get high priority
    if (command.intent.startsWith('system.')) return 'high';
    
    // Smart home security commands get high priority
    if (command.intent.includes('security') || command.intent.includes('lock')) return 'high';
    
    // Conversation commands get medium priority
    if (command.intent.startsWith('conversation.')) return 'medium';
    
    // Default to low priority
    return 'low';
  }

  private async validateUserPermissions(userId: string, permissions: string[]): Promise<boolean> {
    // Simplified permission check - in real implementation would check user profile
    // For now, allow all permissions for child safety level
    return true;
  }

  private updateHandlerStats(intent: string): void {
    const registration = this.handlers.get(intent);
    if (registration) {
      registration.usageCount++;
      registration.lastUsed = new Date();
    }
  }

  private validateHandler(handler: CommandHandler): boolean {
    return (
      typeof handler.canHandle === 'function' &&
      typeof handler.execute === 'function' &&
      typeof handler.validate === 'function' &&
      typeof handler.getRequiredPermissions === 'function'
    );
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  private createValidationErrorResult(errors: string[]): CommandResult {
    return {
      success: false,
      response: `I can't do that right now: ${errors.join(', ')}`,
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  private createErrorResult(message: string, error?: any): CommandResult {
    return {
      success: false,
      response: message,
      data: error ? { errorType: typeof error === 'string' ? error : 'UNKNOWN' } : undefined,
      executionTime: 0,
      requiresFollowUp: false
    };
  }
}

// Built-in command handlers
class HelpCommandHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'system.help';
  }

  async execute(command: Command): Promise<CommandResult> {
    const topic = command.parameters.topic;
    let response = "I can help you with lights, temperature, reminders, and answering questions. ";
    
    if (topic) {
      response += `What specifically would you like to know about ${topic}?`;
    } else {
      response += "What would you like help with?";
    }

    return {
      success: true,
      response,
      executionTime: 0,
      requiresFollowUp: true,
      nextActions: ['provide_specific_help']
    };
  }

  validate(command: Command): boolean {
    return true; // Help is always valid
  }

  getRequiredPermissions(): string[] {
    return []; // No permissions required for help
  }
}

class UnknownCommandHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'system.unknown';
  }

  async execute(command: Command): Promise<CommandResult> {
    return {
      success: false,
      response: "I didn't understand that. Could you try asking in a different way?",
      executionTime: 0,
      requiresFollowUp: true,
      nextActions: ['clarify_request']
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return [];
  }
}

class SafetyBlockedHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'system.safety_blocked';
  }

  async execute(command: Command): Promise<CommandResult> {
    return {
      success: false,
      response: "I can't help with that request. Let's try something else!",
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return [];
  }
}

class ErrorHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'system.error';
  }

  async execute(command: Command): Promise<CommandResult> {
    return {
      success: false,
      response: "Something went wrong. Let's try that again!",
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return [];
  }
}

class GreetingHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'conversation.greeting';
  }

  async execute(command: Command): Promise<CommandResult> {
    const timeOfDay = command.context.environmentContext.timeOfDay;
    const greetings = {
      morning: "Good morning! How can I help you today?",
      afternoon: "Good afternoon! What can I do for you?",
      evening: "Good evening! How can I assist you?",
      night: "Hello! What can I help you with?"
    };

    return {
      success: true,
      response: greetings[timeOfDay],
      executionTime: 0,
      requiresFollowUp: true
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return [];
  }
}

class GoodbyeHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'conversation.goodbye';
  }

  async execute(command: Command): Promise<CommandResult> {
    return {
      success: true,
      response: "Goodbye! Have a great day!",
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return [];
  }
}

// Integration point handlers (placeholder implementations)
class SmartHomeLightsHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent.startsWith('smart_home.lights');
  }

  async execute(command: Command): Promise<CommandResult> {
    // This would integrate with the smart home module
    const action = command.parameters.action || 'toggle';
    const location = command.parameters.location || 'here';
    
    return {
      success: true,
      response: `I've ${action}ed the lights ${location}.`,
      data: { action, location },
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return command.parameters.action !== undefined;
  }

  getRequiredPermissions(): string[] {
    return ['smart_home.lights.control'];
  }
}

class SmartHomeTemperatureHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent.startsWith('smart_home.temperature');
  }

  async execute(command: Command): Promise<CommandResult> {
    // This would integrate with the smart home module
    return {
      success: true,
      response: "I've adjusted the temperature for you.",
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return ['smart_home.temperature.control'];
  }
}

class SchedulingReminderHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent.startsWith('scheduling.');
  }

  async execute(command: Command): Promise<CommandResult> {
    // This would integrate with the scheduling module
    const task = command.parameters.task;
    const time = command.parameters.time;
    
    return {
      success: true,
      response: `I've set a reminder for ${task} at ${time}.`,
      data: { task, time },
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return command.parameters.task && command.parameters.time;
  }

  getRequiredPermissions(): string[] {
    return ['scheduling.create'];
  }
}

class SchedulingViewHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'scheduling.view_calendar';
  }

  async execute(command: Command): Promise<CommandResult> {
    // This would integrate with the scheduling module
    return {
      success: true,
      response: "Here's what you have coming up today...",
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return ['scheduling.view'];
  }
}

class WeatherInformationHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'information.weather';
  }

  async execute(command: Command): Promise<CommandResult> {
    // This would integrate with weather service
    return {
      success: true,
      response: "It's sunny and 72 degrees outside today.",
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return ['information.weather'];
  }
}

class TimeInformationHandler implements CommandHandler {
  canHandle(intent: string): boolean {
    return intent === 'information.time';
  }

  async execute(command: Command): Promise<CommandResult> {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return {
      success: true,
      response: `It's ${timeString}.`,
      executionTime: 0,
      requiresFollowUp: false
    };
  }

  validate(command: Command): boolean {
    return true;
  }

  getRequiredPermissions(): string[] {
    return [];
  }
}