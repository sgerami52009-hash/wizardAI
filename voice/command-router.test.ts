/**
 * Command Router Tests
 * Safety: Validates command authorization and child-safe execution
 * Performance: Ensures routing speed meets <50ms requirement
 */

import { VoiceCommandRouter } from './command-router';
import { IntentResult, Command, CommandHandler, CommandResult } from './interfaces';

// Mock the safety filter
jest.mock('../safety/content-safety-filter', () => ({
  validateChildSafeContent: jest.fn().mockResolvedValue({
    isAllowed: true,
    riskLevel: 'low',
    blockedReasons: []
  })
}));

// Mock the user profiles sanitizer
jest.mock('../models/user-profiles', () => ({
  sanitizeForLog: jest.fn((text) => text)
}));

describe('VoiceCommandRouter', () => {
  let router: VoiceCommandRouter;
  let mockIntent: IntentResult;
  let mockCommand: Command;

  beforeEach(() => {
    router = new VoiceCommandRouter();
    
    mockIntent = {
      intent: 'test.command',
      confidence: 0.8,
      parameters: { action: 'test' },
      requiresConfirmation: false
    };

    mockCommand = {
      intent: 'test.command',
      parameters: { action: 'test' },
      userId: 'test-user',
      sessionId: 'test-session',
      timestamp: new Date(),
      context: {
        sessionId: 'test-session',
        userId: 'test-user',
        turns: [],
        activeTopics: [],
        pendingActions: [],
        userPreferences: {},
        safetyContext: {
          currentAgeGroup: 'child',
          parentalSupervision: false,
          contentHistory: [],
          riskFactors: [],
          safetyOverrides: []
        },
        environmentContext: {
          location: 'home',
          timeOfDay: 'afternoon',
          dayOfWeek: 'Monday',
          ambientNoise: 'quiet',
          otherUsers: [],
          deviceStatus: {
            networkConnected: true,
            resourceUsage: { memoryMB: 512, cpuPercent: 25 },
            temperature: 25,
            availableStorage: 1000
          }
        }
      }
    };
  });

  describe('Command Routing', () => {
    test('should route commands to appropriate handlers', async () => {
      const result = await router.routeCommand(mockIntent, 'test-user');
      
      expect(result.success).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeDefined();
    });

    test('should handle built-in system commands', async () => {
      const helpIntent = {
        intent: 'system.help',
        confidence: 0.9,
        parameters: {},
        requiresConfirmation: false
      };

      const result = await router.routeCommand(helpIntent, 'test-user');
      
      expect(result.success).toBe(true);
      expect(result.response).toContain('help');
      expect(result.requiresFollowUp).toBe(true);
    });

    test('should handle unknown commands gracefully', async () => {
      const unknownIntent = {
        intent: 'system.unknown',
        confidence: 0.1,
        parameters: {},
        requiresConfirmation: true
      };

      const result = await router.routeCommand(unknownIntent, 'test-user');
      
      expect(result.success).toBe(false);
      expect(result.response).toContain('didn\'t understand');
      expect(result.requiresFollowUp).toBe(true);
    });

    test('should handle safety blocked commands', async () => {
      const blockedIntent = {
        intent: 'system.safety_blocked',
        confidence: 1.0,
        parameters: {},
        requiresConfirmation: false
      };

      const result = await router.routeCommand(blockedIntent, 'test-user');
      
      expect(result.success).toBe(false);
      expect(result.response).toContain('can\'t help');
    });
  });

  describe('Handler Registration and Management', () => {
    class TestHandler implements CommandHandler {
      canHandle(intent: string): boolean {
        return intent === 'test.custom';
      }

      async execute(command: Command): Promise<CommandResult> {
        return {
          success: true,
          response: 'Test executed successfully',
          executionTime: 50
        };
      }

      validate(command: Command): boolean {
        return command.parameters.action !== undefined;
      }

      getRequiredPermissions(): string[] {
        return ['test.permission'];
      }
    }

    test('should register custom handlers', () => {
      const handler = new TestHandler();
      
      expect(() => router.registerHandler('test.custom', handler)).not.toThrow();
      
      const handlers = router.getRegisteredHandlers();
      expect(handlers.has('test.custom')).toBe(true);
    });

    test('should validate handler implementations', () => {
      const invalidHandler = {} as CommandHandler;
      
      expect(() => router.registerHandler('test.invalid', invalidHandler)).toThrow();
    });

    test('should execute custom handlers', async () => {
      const handler = new TestHandler();
      router.registerHandler('test.custom', handler);

      const customCommand = {
        ...mockCommand,
        intent: 'test.custom',
        parameters: { action: 'custom' }
      };

      const result = await router.executeCommand(customCommand);
      
      expect(result.success).toBe(true);
      expect(result.response).toBe('Test executed successfully');
    });

    test('should enable and disable handlers', () => {
      const handler = new TestHandler();
      router.registerHandler('test.toggle', handler);

      router.disableHandler('test.toggle');
      const disabledHandlers = router.getRegisteredHandlers();
      expect(disabledHandlers.has('test.toggle')).toBe(false);

      router.enableHandler('test.toggle');
      const enabledHandlers = router.getRegisteredHandlers();
      expect(enabledHandlers.has('test.toggle')).toBe(true);
    });
  });

  describe('Command Validation', () => {
    test('should validate commands before execution', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['unsafe content']
      });

      const result = await router.executeCommand(mockCommand);
      
      expect(result.success).toBe(false);
      expect(result.response).toContain('blocked by safety filter');
    });

    test('should check handler availability', async () => {
      const unavailableCommand = {
        ...mockCommand,
        intent: 'nonexistent.command'
      };

      const result = await router.executeCommand(unavailableCommand);
      
      expect(result.success).toBe(false);
      expect(result.response).toContain('not supported');
    });
  });

  describe('Execution Monitoring', () => {
    test('should enforce execution timeouts', async () => {
      class SlowHandler implements CommandHandler {
        canHandle(intent: string): boolean {
          return intent === 'test.slow';
        }

        async execute(command: Command): Promise<CommandResult> {
          // Simulate slow execution
          await new Promise(resolve => setTimeout(resolve, 6000));
          return {
            success: true,
            response: 'Slow execution completed',
            executionTime: 6000
          };
        }

        validate(command: Command): boolean {
          return true;
        }

        getRequiredPermissions(): string[] {
          return [];
        }
      }

      const slowHandler = new SlowHandler();
      router.registerHandler('test.slow', slowHandler);

      const slowCommand = {
        ...mockCommand,
        intent: 'test.slow'
      };

      const result = await router.executeCommand(slowCommand);
      
      expect(result.success).toBe(false);
      expect(result.response).toContain('timeout');
    });

    test('should limit concurrent executions', async () => {
      class ConcurrentHandler implements CommandHandler {
        canHandle(intent: string): boolean {
          return intent === 'test.concurrent';
        }

        async execute(command: Command): Promise<CommandResult> {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            success: true,
            response: 'Concurrent execution completed',
            executionTime: 100
          };
        }

        validate(command: Command): boolean {
          return true;
        }

        getRequiredPermissions(): string[] {
          return [];
        }
      }

      const handler = new ConcurrentHandler();
      router.registerHandler('test.concurrent', handler);

      const concurrentCommand = {
        ...mockCommand,
        intent: 'test.concurrent'
      };

      // Start multiple executions
      const promises = Array(5).fill(null).map(() => 
        router.executeCommand({ ...concurrentCommand })
      );

      const results = await Promise.all(promises);
      
      // Some should succeed, some should be rejected due to concurrency limits
      const successCount = results.filter(r => r.success).length;
      const busyCount = results.filter(r => r.response?.includes('busy')).length;
      
      expect(successCount + busyCount).toBe(5);
      expect(busyCount).toBeGreaterThan(0); // At least some should be rejected
    });

    test('should track execution metrics', async () => {
      const result = await router.routeCommand(mockIntent, 'test-user');
      
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    test('should route commands within 50ms', async () => {
      const startTime = Date.now();
      
      await router.routeCommand(mockIntent, 'test-user');
      
      const routingTime = Date.now() - startTime;
      expect(routingTime).toBeLessThan(50);
    });

    test('should handle multiple concurrent routing requests', async () => {
      const promises = Array(10).fill(null).map(() => 
        router.routeCommand(mockIntent, 'test-user')
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.executionTime).toBeDefined();
      });
    });
  });

  describe('Integration Points', () => {
    test('should handle smart home light commands', async () => {
      const lightIntent = {
        intent: 'smart_home.lights.control',
        confidence: 0.9,
        parameters: { action: 'turn on', location: 'living room' },
        requiresConfirmation: false
      };

      const result = await router.routeCommand(lightIntent, 'test-user');
      
      expect(result.success).toBe(true);
      expect(result.response).toContain('lights');
    });

    test('should handle scheduling commands', async () => {
      const scheduleIntent = {
        intent: 'scheduling.create_reminder',
        confidence: 0.8,
        parameters: { task: 'call mom', time: '3pm' },
        requiresConfirmation: false
      };

      const result = await router.routeCommand(scheduleIntent, 'test-user');
      
      expect(result.success).toBe(true);
      expect(result.response).toContain('reminder');
    });

    test('should handle information requests', async () => {
      const weatherIntent = {
        intent: 'information.weather',
        confidence: 0.9,
        parameters: {},
        requiresConfirmation: false
      };

      const result = await router.routeCommand(weatherIntent, 'test-user');
      
      expect(result.success).toBe(true);
      expect(result.response).toContain('degrees');
    });
  });

  describe('Error Handling', () => {
    test('should handle handler execution errors', async () => {
      class ErrorHandler implements CommandHandler {
        canHandle(intent: string): boolean {
          return intent === 'test.error';
        }

        async execute(command: Command): Promise<CommandResult> {
          throw new Error('Handler execution failed');
        }

        validate(command: Command): boolean {
          return true;
        }

        getRequiredPermissions(): string[] {
          return [];
        }
      }

      const errorHandler = new ErrorHandler();
      router.registerHandler('test.error', errorHandler);

      const errorCommand = {
        ...mockCommand,
        intent: 'test.error'
      };

      const result = await router.executeCommand(errorCommand);
      
      expect(result.success).toBe(false);
      expect(result.response).toContain('execution failed');
    });

    test('should emit error events', async () => {
      const errorSpy = jest.fn();
      router.on('executionError', errorSpy);

      const invalidCommand = {
        ...mockCommand,
        intent: 'nonexistent.command'
      };

      await router.executeCommand(invalidCommand);
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Handler Statistics', () => {
    test('should track handler usage statistics', async () => {
      const helpIntent = {
        intent: 'system.help',
        confidence: 0.9,
        parameters: {},
        requiresConfirmation: false
      };

      await router.routeCommand(helpIntent, 'test-user');
      
      const stats = router.getHandlerStats('system.help');
      expect(stats).toBeDefined();
      expect(stats!.usageCount).toBeGreaterThan(0);
      expect(stats!.lastUsed).toBeDefined();
    });
  });
});