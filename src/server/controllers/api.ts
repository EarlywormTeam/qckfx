/**
 * API controller functions
 */
import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../services/SessionManager';
import { getAgentService } from '../services/AgentService';
import { serverLogger } from '../logger';
import { LogCategory } from '../../utils/logger';
import crypto from 'crypto';
import {
  StartSessionRequest,
  QueryRequest,
  AbortRequest,
  HistoryRequest,
  StatusRequest,
  SessionValidationRequest,
} from '../schemas/api';
import { getSessionStatePersistence } from '../services/SessionStatePersistence';
import { TimelineService } from '../container';
// No errors imported as they're handled by middleware

/**
 * Start a new agent session
 * @route POST /api/start
 */
export async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as StartSessionRequest;
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Create a new session - now awaiting to ensure container is initialized
    const session = await agentService.startSession(body.config);
    
    // Return the session info
    res.status(201).json({
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
      isProcessing: session.isProcessing,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit a query to the agent
 * @route POST /api/query
 */
export async function submitQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId, query } = req.body as QueryRequest;
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Get the timeline service from the app container
    const app = req.app;
    const container = app.locals.container;
    
    // Use the imported TimelineService as the token for container.get
    let timelineService;
    try {
      if (container) {
        timelineService = container.get(TimelineService);
      }
    } catch (err) {
      serverLogger.error('Error getting TimelineService from container:', err);
    }
    
    if (!timelineService) {
      serverLogger.warn('Timeline service not available in container for recording user message');
    }
    
    // Start processing the query - this is asynchronous
    // We'll respond immediately and let the client poll for updates
    try {
      // Generate a message ID that will be used for the timeline message
      const userMessageId = crypto.randomUUID();
      
      // Create a user message object for the timeline only (won't affect agent processing)
      const userMessage = {
        id: userMessageId,
        role: 'user',
        timestamp: new Date().toISOString(),
        content: [{ type: 'text', text: query }],
        confirmationStatus: 'confirmed' // Mark as confirmed since it's server-generated
      };
      
      // Get the session to ensure we're working with the latest state
      const session = sessionManager.getSession(sessionId);
      
      // IMPORTANT: The AgentRunner now handles the conversationHistory updates
      // so we need to ensure we don't create a race condition with the timeline
      
      // Start agent processing in the background 
      // AgentRunner will add the user message to conversation history itself
      serverLogger.info(`Starting agent processing for session ${sessionId}`);
      agentService.processQuery(sessionId, query)
        .catch(error => {
          serverLogger.error('Error processing query:', error, LogCategory.AGENT);
        });
      
      // Add the user message to the timeline AFTER starting agent processing
      // But do it in a separate "thread" to avoid blocking the response
      if (timelineService) {
        // Use setTimeout to ensure this runs after the response and doesn't block
        setTimeout(async () => {
          try {
            await timelineService.addMessageToTimeline(sessionId, userMessage);
            serverLogger.info(`User message directly saved to timeline for session ${sessionId}`);
          } catch (err) {
            serverLogger.error('Error recording user message in timeline:', err);
          }
        }, 100); // Small delay to ensure agent processing starts first
      }
      
      // Return accepted response immediately
      res.status(202).json({
        accepted: true,
        sessionId,
        message: 'Query accepted for processing',
      });
    } catch (error) {
      // If there's an immediate error (like the agent is busy),
      // we'll catch it here and return an error response
      next(error);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Abort current operation
 * @route POST /api/abort
 */
export async function abortOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.body as AbortRequest;
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Abort the operation
    const aborted = agentService.abortOperation(sessionId);
    
    res.status(200).json({
      success: aborted,
      sessionId,
      message: aborted ? 'Operation aborted' : 'No operation to abort',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get conversation history
 * @route GET /api/history
 */
export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.query as unknown as HistoryRequest;
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Get the conversation history
    const history = agentService.getHistory(sessionId);
    
    res.status(200).json({
      sessionId,
      history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current agent status
 * @route GET /api/status
 */
export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.query as unknown as StatusRequest;
    
    // Get the session
    const session = sessionManager.getSession(sessionId);
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Check if the session is processing
    const isProcessing = agentService.isProcessing(sessionId);
    
    // Get any pending permission requests
    const permissionRequests = agentService.getPermissionRequests(sessionId);
    
    res.status(200).json({
      sessionId,
      isProcessing,
      lastActiveAt: session.lastActiveAt.toISOString(),
      pendingPermissionRequests: permissionRequests.length > 0 ? permissionRequests : undefined,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save session state
 * @route POST /api/sessions/:sessionId/state/save
 */
export async function saveSessionState(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    const agentService = getAgentService();
    
    // Verify the session exists
    try {
      sessionManager.getSession(sessionId);
    } catch {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }
    
    await agentService.saveSessionState(sessionId);
    res.status(200).json({ success: true, message: 'Session state saved successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * List persisted sessions
 * @route GET /api/sessions/persisted
 */
export async function listPersistedSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agentService = getAgentService();
    
    const sessions = await agentService.listPersistedSessions();
    res.status(200).json({ sessions });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a persisted session
 * @route DELETE /api/sessions/persisted/:sessionId
 */

/**
 * Validate multiple session IDs efficiently
 * @route POST /api/sessions/validate
 */
export async function validateSessionIds(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionIds } = req.body as SessionValidationRequest;
    const validSessionIds: string[] = [];
    
    // Get session state persistence
    const sessionStatePersistence = getSessionStatePersistence();
    
    // Log session validation with the SESSION category to make it easy to filter
    serverLogger.debug(`Validating ${sessionIds.length} session IDs`, LogCategory.SESSION);
    
    // First check in-memory sessions (these are always valid)
    for (const sessionId of sessionIds) {
      // Try to get the session from memory first (fast)
      try {
        sessionManager.getSession(sessionId);
        // If we get here, the session exists in memory
        validSessionIds.push(sessionId);
        serverLogger.debug(`Session ${sessionId} found in memory, marking as valid`, LogCategory.SESSION);
        continue; // Skip persistence check for this session
      } catch (error) {
        // Session not in memory, will check persistence below
        serverLogger.debug(`Session ${sessionId} not found in memory, checking persistence`, LogCategory.SESSION);
      }
      
      // If not in memory, check persistence
      const metadataExists = await sessionStatePersistence.sessionMetadataExists(sessionId);
      if (metadataExists) {
        validSessionIds.push(sessionId);
        serverLogger.debug(`Session ${sessionId} found in persistence, marking as valid`, LogCategory.SESSION);
      }
    }
    
    serverLogger.debug(`Found ${validSessionIds.length} valid session IDs`, LogCategory.SESSION);
    res.status(200).json({ validSessionIds });
  } catch (error) {
    next(error);
  }
}

export async function deletePersistedSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    const agentService = getAgentService();
    
    const success = await agentService.deletePersistedSession(sessionId);
    
    if (success) {
      res.status(200).json({ success: true, message: 'Session deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete session' });
    }
  } catch (error) {
    next(error);
  }
}

