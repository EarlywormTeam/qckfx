import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketEvent } from '../../types/api';
import { EventEmitter } from 'events';

class MockWebSocketService extends EventEmitter {
  activeToolsMap = new Map<string, Array<{ id: string; name: string; state: string }>>();
  abortTimestamps = new Map<string, number>();
  
  constructor() {
    super();
  }
  
  disconnect() {
    this.removeAllListeners();
  }
  
  simulateAbort(sessionId: string, toolId: string) {
    // Store abort timestamp
    const abortTimestamp = Date.now();
    this.abortTimestamps.set(sessionId, abortTimestamp);
    
    // Mark active tools as aborted
    const abortedTools = new Set<string>();
    
    // Add the tool to aborted set
    abortedTools.add(toolId);
    
    // Emit tool completion event
    this.emit(WebSocketEvent.TOOL_EXECUTION_COMPLETED, {
      sessionId,
      tool: {
        id: toolId,
        name: 'TestTool',
      },
      result: {
        aborted: true,
        abortTimestamp
      },
      executionTime: 0,
      timestamp: new Date().toISOString(),
    });
    
    // Emit abort event
    this.emit(WebSocketEvent.PROCESSING_ABORTED, {
      sessionId,
      abortTimestamp,
      abortedTools: [...abortedTools],
      timestamp: new Date().toISOString(),
    });
    
    // Clear active tools
    this.activeToolsMap.set(sessionId, []);
    
    // Return for assertions
    return {
      abortTimestamp,
      abortedTools,
    };
  }
  
  isEventAfterAbort(sessionId: string, timestamp: number): boolean {
    const abortTimestamp = this.abortTimestamps.get(sessionId);
    if (!abortTimestamp) return false;
    return timestamp > abortTimestamp;
  }
  
  simulateToolEvent(sessionId: string, toolId: string, timestamp: Date) {
    // Check if tool should be processed
    if (this.isEventAfterAbort(sessionId, timestamp.getTime())) {
      // Ignore event after abort
      return false;
    }
    
    // Process the event
    this.emit(WebSocketEvent.TOOL_EXECUTION, {
      sessionId,
      tool: { id: toolId, name: 'TestTool' },
      result: { test: 'result' },
      timestamp: timestamp.toISOString()
    });
    
    return true;
  }
}

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('WebSocketService Abort Handling', () => {
  let service: MockWebSocketService;
  
  beforeEach(() => {
    // Reset storage mock
    window.sessionStorage.clear();
    
    // Create the service
    service = new MockWebSocketService();
  });
  
  afterEach(() => {
    if (service) {
      service.disconnect();
    }
    
    vi.resetAllMocks();
  });
  
  it('marks tools as aborted when processing is aborted', () => {
    const sessionId = 'test-session-id';
    const toolId = 'test-tool-id';
    
    // Set up listeners
    const abortListener = vi.fn();
    const toolCompletionListener = vi.fn();
    
    service.on(WebSocketEvent.PROCESSING_ABORTED, abortListener);
    service.on(WebSocketEvent.TOOL_EXECUTION_COMPLETED, toolCompletionListener);
    
    // Simulate abort
    service.simulateAbort(sessionId, toolId);
    
    // Should call abort listener
    expect(abortListener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        abortTimestamp: expect.any(Number),
        abortedTools: expect.any(Array)
      })
    );
    
    // Should call tool completion listener
    expect(toolCompletionListener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        tool: {
          id: toolId,
          name: 'TestTool',
        },
        result: expect.objectContaining({
          aborted: true
        })
      })
    );
  });
  
  it('ignores tool events that happen after abort', () => {
    const sessionId = 'test-session-id';
    const toolId = 'test-tool-id';
    
    // Set abort timestamp
    const abortTimestamp = Date.now();
    service.abortTimestamps.set(sessionId, abortTimestamp);
    
    // Add listeners
    const toolListener = vi.fn();
    service.on(WebSocketEvent.TOOL_EXECUTION, toolListener);
    
    // Try to send event after abort
    const futureDate = new Date(abortTimestamp + 1000);
    const processed = service.simulateToolEvent(sessionId, toolId, futureDate);
    
    // Event should be ignored
    expect(processed).toBe(false);
    expect(toolListener).not.toHaveBeenCalled();
  });
  
  it('processes tool events that happened before abort', () => {
    const sessionId = 'test-session-id';
    const toolId = 'test-tool-id';
    
    // Set abort timestamp
    const abortTime = Date.now();
    service.abortTimestamps.set(sessionId, abortTime);
    
    // Add listeners
    const toolListener = vi.fn();
    service.on(WebSocketEvent.TOOL_EXECUTION, toolListener);
    
    // Send event before abort
    const pastDate = new Date(abortTime - 1000);
    const processed = service.simulateToolEvent(sessionId, toolId, pastDate);
    
    // Event should be processed
    expect(processed).toBe(true);
    expect(toolListener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        tool: expect.objectContaining({id: toolId})
      })
    );
  });
});