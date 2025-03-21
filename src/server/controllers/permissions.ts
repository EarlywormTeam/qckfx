/**
 * Permission handling controller
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAgentService } from '../services/AgentService';
import { ValidationError, NotFoundError } from '../utils/errors';
import { 
  permissionRequestQuerySchema, 
  permissionResolutionSchema 
} from '../schemas/api';

/**
 * Get pending permission requests for a session
 * @route GET /api/permissions
 */
export async function getPermissionRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = permissionRequestQuerySchema.parse(req.query);
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Get the permission requests
    const requests = agentService.getPermissionRequests(sessionId);
    
    res.status(200).json({
      sessionId,
      permissionRequests: requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resolve a permission request
 * @route POST /api/permissions/resolve
 */
export async function resolvePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { permissionId, granted } = permissionResolutionSchema.parse(req.body);
    
    // Get the agent service
    const agentService = getAgentService();
    
    // Resolve the permission
    const resolved = agentService.resolvePermission(permissionId, granted);
    
    if (!resolved) {
      throw new NotFoundError(`Permission request ${permissionId} not found or already resolved`);
    }
    
    res.status(200).json({
      permissionId,
      granted,
      resolved: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid request data', error.format()));
    } else {
      next(error);
    }
  }
}