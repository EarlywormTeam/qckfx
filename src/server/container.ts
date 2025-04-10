/**
 * Dependency Injection Container
 */
import { Container } from 'inversify';
import { WebSocketService } from './services/WebSocketService';
import { SessionManager } from './services/SessionManager';
import { TimelineService } from './services/TimelineService';
import { TimelineStatePersistence, createTimelineStatePersistence } from './services/TimelineStatePersistence';
import { serverLogger } from './logger';

// Create the container
const container = new Container({ defaultScope: 'Singleton' });

// Create a getter for singletons registered later
const singletons: Record<string, any> = {};

// Register existing services
function registerServices() {
  try {
    // Register WebSocketService
    if (!container.isBound(WebSocketService)) {
      if (!singletons.webSocketService) {
        throw new Error('WebSocketService instance not provided to container');
      }
      container.bind(WebSocketService).toConstantValue(singletons.webSocketService);
      serverLogger.debug('WebSocketService registered in container');
    }
    
    // Register SessionManager
    if (!container.isBound(SessionManager)) {
      if (!singletons.sessionManager) {
        throw new Error('SessionManager instance not provided to container');
      }
      container.bind(SessionManager).toConstantValue(singletons.sessionManager);
      serverLogger.debug('SessionManager registered in container');
    }
    
    // Register TimelineStatePersistence first
    if (!container.isBound(TimelineStatePersistence)) {
      const timelineStatePersistence = createTimelineStatePersistence();
      container.bind(TimelineStatePersistence).toConstantValue(timelineStatePersistence);
      serverLogger.debug('TimelineStatePersistence registered in container');
    }
    
    // Register TimelineService as a singleton
    if (!container.isBound(TimelineService)) {
      // Verify dependencies are available
      if (!container.isBound(SessionManager) || !container.isBound(WebSocketService) || !container.isBound(TimelineStatePersistence)) {
        throw new Error('TimelineService dependencies not registered in container');
      }
      
      // Get the dependencies
      const sessionManager = container.get(SessionManager);
      const webSocketService = container.get(WebSocketService);
      const timelineStatePersistence = container.get(TimelineStatePersistence);
      
      if (!sessionManager || !webSocketService || !timelineStatePersistence) {
        throw new Error('Failed to resolve TimelineService dependencies from container');
      }
      
      const timelineService = new TimelineService(sessionManager, webSocketService, timelineStatePersistence);
      container.bind(TimelineService).toConstantValue(timelineService);
      serverLogger.debug('TimelineService registered in container');
    }
  } catch (error) {
    serverLogger.error('Error during service registration:', error);
    throw error; // Re-throw to allow error handling in initializeContainer
  }
}

// Initialize the container with existing instances
export function initializeContainer(services: {
  webSocketService: WebSocketService;
  sessionManager: SessionManager;
}) {
  try {
    serverLogger.debug('Initializing container with provided services');
    
    // Store the services in the singletons object
    singletons.webSocketService = services.webSocketService;
    singletons.sessionManager = services.sessionManager;
    
    // Register all services
    registerServices();
    
    // Verify that TimelineService can be resolved
    const timelineService = container.get(TimelineService);
    if (!timelineService) {
      throw new Error('Failed to verify TimelineService binding');
    }
    
    return container;
  } catch (error) {
    serverLogger.error('Container initialization failed:', error);
    throw error;
  }
}

// Export for direct import
export { container, TimelineService, TimelineStatePersistence };