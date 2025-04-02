/**
 * API route definitions
 */
import { Router } from 'express';
import * as apiController from '../controllers/api';
import * as permissionController from '../controllers/permissions';
import * as timelineController from '../controllers/timeline';
import { validateBody, validateQuery } from '../middleware/validation';
import {
  startSessionSchema,
  querySchema,
  abortSchema,
  historySchema,
  statusSchema,
  permissionRequestQuerySchema,
  permissionResolutionSchema,
  fastEditModeToggleSchema,
  fastEditModeQuerySchema,
  timelineQuerySchema,
} from '../schemas/api';
import { apiDocumentation } from '../docs/api';

const router = Router();

/**
 * @route   POST /api/start
 * @desc    Start a new agent session
 */
router.post('/start', validateBody(startSessionSchema), apiController.startSession);

/**
 * @route   POST /api/query
 * @desc    Submit a query to the agent
 */
router.post('/query', validateBody(querySchema), apiController.submitQuery);

/**
 * @route   POST /api/abort
 * @desc    Abort current operation
 */
router.post('/abort', validateBody(abortSchema), apiController.abortOperation);

/**
 * @route   GET /api/history
 * @desc    Get conversation history
 */
router.get('/history', validateQuery(historySchema), apiController.getHistory);

/**
 * @route   GET /api/status
 * @desc    Get current agent status
 */
router.get('/status', validateQuery(statusSchema), apiController.getStatus);

/**
 * @route   GET /api/permissions
 * @desc    Get pending permission requests for a session
 */
router.get('/permissions', validateQuery(permissionRequestQuerySchema), permissionController.getPermissionRequests);

/**
 * @route   POST /api/permissions/resolve
 * @desc    Resolve a permission request
 */
router.post('/permissions/resolve', validateBody(permissionResolutionSchema), permissionController.resolvePermission);

/**
 * @route   POST /api/permissions/fast-edit-mode
 * @desc    Toggle fast edit mode for a session
 */
router.post('/permissions/fast-edit-mode', validateBody(fastEditModeToggleSchema), permissionController.toggleFastEditMode);

/**
 * @route   GET /api/permissions/fast-edit-mode
 * @desc    Get fast edit mode status for a session
 */
router.get('/permissions/fast-edit-mode', validateQuery(fastEditModeQuerySchema), permissionController.getFastEditMode);

/**
 * @route   POST /api/sessions/:sessionId/state/save
 * @desc    Save session state
 */
router.post('/sessions/:sessionId/state/save', apiController.saveSessionState);

/**
 * @route   GET /api/sessions/persisted
 * @desc    List persisted sessions
 */
router.get('/sessions/persisted', apiController.listPersistedSessions);

/**
 * @route   DELETE /api/sessions/persisted/:sessionId
 * @desc    Delete a persisted session
 */
router.delete('/sessions/persisted/:sessionId', apiController.deletePersistedSession);

/**
 * @route   GET /api/sessions/:sessionId/timeline
 * @desc    Get timeline for a session
 */
router.get('/sessions/:sessionId/timeline', validateQuery(timelineQuerySchema), timelineController.getSessionTimeline);

/**
 * @route   GET /api/docs
 * @desc    Get API documentation
 */
router.get('/docs', (req, res) => {
  res.json(apiDocumentation);
});

export default router;