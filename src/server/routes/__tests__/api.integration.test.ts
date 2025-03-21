/**
 * API routes integration tests
 */
import request from 'supertest';
import express from 'express';
import { json } from 'body-parser';
import apiRoutes from '../api';
import { errorHandler } from '../../middleware/errorHandler';
import { getAgentService } from '../../services/AgentService';
import { sessionManager } from '../../services/SessionManager';
import { WebSocketService } from '../../services/WebSocketService';

// Mock the agent service and session manager
jest.mock('../../services/AgentService', () => ({
  getAgentService: jest.fn(),
  AgentServiceEvent: {
    PROCESSING_STARTED: 'processing:started',
    PROCESSING_COMPLETED: 'processing:completed',
    PROCESSING_ERROR: 'processing:error',
    PROCESSING_ABORTED: 'processing:aborted',
    TOOL_EXECUTION: 'tool:execution',
    PERMISSION_REQUESTED: 'permission:requested',
    PERMISSION_RESOLVED: 'permission:resolved',
  },
}));

jest.mock('../../services/SessionManager', () => ({
  sessionManager: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
  },
}));

jest.mock('../../services/WebSocketService', () => ({
  WebSocketService: {
    getInstance: jest.fn().mockReturnValue({
      getPendingPermissions: jest.fn().mockReturnValue([]),
    }),
  },
  WebSocketEvent: {
    PROCESSING_STARTED: 'processing:started',
    PROCESSING_COMPLETED: 'processing:completed',
    PROCESSING_ERROR: 'processing:error',
    PROCESSING_ABORTED: 'processing:aborted',
    TOOL_EXECUTION: 'tool:execution',
    SESSION_UPDATED: 'session:updated',
    PERMISSION_REQUESTED: 'permission:requested',
    PERMISSION_RESOLVED: 'permission:resolved',
  },
}));

describe('API Routes Integration', () => {
  let app: express.Express;
  let mockAgentService: any;
  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock agent service
    mockAgentService = {
      startSession: jest.fn().mockReturnValue({
        id: testSessionId,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        isProcessing: false,
      }),
      processQuery: jest.fn().mockResolvedValue({
        response: 'Mock response',
        toolResults: [],
      }),
      abortOperation: jest.fn().mockReturnValue(true),
      isProcessing: jest.fn().mockReturnValue(false),
      getHistory: jest.fn().mockReturnValue([
        {
          role: 'user',
          content: [{ type: 'text', text: 'Test query', citations: null }],
        },
      ]),
      getPermissionRequests: jest.fn().mockReturnValue([]),
      resolvePermission: jest.fn().mockReturnValue(true),
    };

    (getAgentService as jest.Mock).mockReturnValue(mockAgentService);

    // Mock session manager methods
    (sessionManager.getSession as jest.Mock).mockImplementation((id) => {
      if (id === testSessionId) {
        return {
          id: testSessionId,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          state: { conversationHistory: [] },
          isProcessing: false,
        };
      }
      throw new Error(`Session ${id} not found`);
    });

    // Set up the Express app
    app = express();
    app.use(json());
    app.use('/api', apiRoutes);
    app.use(errorHandler);
  });

  describe('POST /api/start', () => {
    it('should create a new session', async () => {
      const response = await request(app)
        .post('/api/start')
        .send({
          config: {
            model: 'test-model',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        sessionId: testSessionId,
        isProcessing: false,
      });
      expect(mockAgentService.startSession).toHaveBeenCalledWith({
        model: 'test-model',
      });
    });

    it('should handle request with no config', async () => {
      const response = await request(app).post('/api/start').send({});

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        sessionId: testSessionId,
        isProcessing: false,
      });
      expect(mockAgentService.startSession).toHaveBeenCalledWith(undefined);
    });
  });

  describe('POST /api/query', () => {
    it('should accept a valid query', async () => {
      const response = await request(app).post('/api/query').send({
        sessionId: testSessionId,
        query: 'Test query',
      });

      expect(response.status).toBe(202);
      expect(response.body).toMatchObject({
        accepted: true,
        sessionId: testSessionId,
        message: expect.any(String),
      });
    });

    it('should reject query with missing sessionId', async () => {
      const response = await request(app).post('/api/query').send({
        query: 'Test query',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject query with missing query text', async () => {
      const response = await request(app).post('/api/query').send({
        sessionId: testSessionId,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/abort', () => {
    it('should abort an operation', async () => {
      const response = await request(app).post('/api/abort').send({
        sessionId: testSessionId,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        sessionId: testSessionId,
        message: expect.any(String),
      });
      expect(mockAgentService.abortOperation).toHaveBeenCalledWith(testSessionId);
    });

    it('should reject abort with missing sessionId', async () => {
      const response = await request(app).post('/api/abort').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/history', () => {
    it('should return conversation history', async () => {
      const response = await request(app).get(`/api/history?sessionId=${testSessionId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        sessionId: testSessionId,
        history: expect.any(Array),
      });
      expect(mockAgentService.getHistory).toHaveBeenCalledWith(testSessionId);
    });

    it('should reject history request with missing sessionId', async () => {
      const response = await request(app).get('/api/history');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/status', () => {
    it('should return session status', async () => {
      const response = await request(app).get(`/api/status?sessionId=${testSessionId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        sessionId: testSessionId,
        isProcessing: false,
        lastActiveAt: expect.any(String),
      });
      expect(mockAgentService.isProcessing).toHaveBeenCalledWith(testSessionId);
    });

    it('should reject status request with missing sessionId', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/permissions', () => {
    it('should return permission requests', async () => {
      const response = await request(app).get(`/api/permissions?sessionId=${testSessionId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        sessionId: testSessionId,
        permissionRequests: expect.any(Array),
      });
    });

    it('should reject permissions request with missing sessionId', async () => {
      const response = await request(app).get('/api/permissions');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/permissions/resolve', () => {
    it('should resolve a permission request', async () => {
      const permissionId = 'test-permission-id';
      const response = await request(app).post('/api/permissions/resolve').send({
        sessionId: testSessionId,
        permissionId,
        granted: true,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        permissionId,
        granted: true,
        resolved: true,
      });
    });

    it('should reject resolve with missing parameters', async () => {
      const response = await request(app).post('/api/permissions/resolve').send({
        sessionId: testSessionId,
        // Missing permissionId and granted
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/docs', () => {
    it('should return API documentation', async () => {
      const response = await request(app).get('/api/docs');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('paths');
      expect(response.body.paths).toHaveProperty('/api/start');
      expect(response.body.paths).toHaveProperty('/api/query');
      expect(response.body.paths).toHaveProperty('/api/abort');
      expect(response.body.paths).toHaveProperty('/api/history');
      expect(response.body.paths).toHaveProperty('/api/status');
      expect(response.body.paths).toHaveProperty('/api/permissions');
      expect(response.body.paths).toHaveProperty('/api/permissions/resolve');
    });
  });
});