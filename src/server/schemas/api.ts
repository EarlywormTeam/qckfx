/**
 * API request/response schemas
 */
import { z } from 'zod';

/**
 * Schema for session start request
 */
export const startSessionSchema = z.object({
  // Optional schema for any config params
  config: z
    .object({
      model: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for query request
 */
export const querySchema = z.object({
  sessionId: z.string().uuid(),
  query: z.string().min(1),
});

/**
 * Schema for abort request
 */
export const abortSchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Schema for history request
 */
export const historySchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Schema for status request
 */
export const statusSchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Schema for session response
 */
export const sessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  createdAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  isProcessing: z.boolean(),
});

/**
 * Schema for status response
 */
export const statusResponseSchema = z.object({
  sessionId: z.string().uuid(),
  isProcessing: z.boolean(),
  lastActiveAt: z.string().datetime(),
});

/**
 * Schema for history response
 */
export const historyResponseSchema = z.object({
  sessionId: z.string().uuid(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string(),
          citations: z.null(),
        })
      ),
    })
  ),
});

/**
 * Schema for permission request query
 */
export const permissionRequestQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Schema for permission resolution
 */
export const permissionResolutionSchema = z.object({
  permissionId: z.string(),
  granted: z.boolean(),
});

/**
 * Schema for permission request response
 */
export const permissionRequestsResponseSchema = z.object({
  sessionId: z.string().uuid(),
  permissionRequests: z.array(
    z.object({
      permissionId: z.string(),
      toolId: z.string(),
      args: z.record(z.any()),
      timestamp: z.string().datetime(),
    })
  ),
});

/**
 * Schema for permission resolution response
 */
export const permissionResolutionResponseSchema = z.object({
  permissionId: z.string(),
  granted: z.boolean(),
  resolved: z.boolean(),
});

// Types based on schemas
export type StartSessionRequest = z.infer<typeof startSessionSchema>;
export type QueryRequest = z.infer<typeof querySchema>;
export type AbortRequest = z.infer<typeof abortSchema>;
export type HistoryRequest = z.infer<typeof historySchema>;
export type StatusRequest = z.infer<typeof statusSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
export type PermissionRequestQuery = z.infer<typeof permissionRequestQuerySchema>;
export type PermissionResolution = z.infer<typeof permissionResolutionSchema>;
export type PermissionRequestsResponse = z.infer<typeof permissionRequestsResponseSchema>;
export type PermissionResolutionResponse = z.infer<typeof permissionResolutionResponseSchema>;