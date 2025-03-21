/**
 * API controller functions
 */
import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../services/SessionManager';
import { getAgentService } from '../services/AgentService';
import { serverLogger } from '../logger';
import {
  StartSessionRequest,
  QueryRequest,
  AbortRequest,
  HistoryRequest,
  StatusRequest,
} from '../schemas/api';
import { ValidationError, ServerError } from '../utils/errors';

/**
 * Start a new agent session
 * @route POST /api/start
 */
export async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as StartSessionRequest;
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Create a new session
    const session = agentService.startSession(body.config);
    
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
    
    // Start processing the query - this is asynchronous
    // We'll respond immediately and let the client poll for updates
    try {
      // Start processing in the background
      agentService.processQuery(sessionId, query)
        .catch(error => {
          serverLogger.error('Error processing query:', error);
        });
        
      // Return accepted response
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