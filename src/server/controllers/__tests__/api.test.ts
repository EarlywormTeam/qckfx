/**
 * API controller tests
 */
import { Request, Response, NextFunction } from 'express';
import * as apiController from '../api';
import { sessionManager } from '../../services/SessionManager';
import { getAgentService } from '../../services/AgentService';
import { SessionState } from '../../../types/model';

// Mock dependencies
jest.mock('../../logger', () => ({
  serverLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock session manager
jest.mock('../../services/SessionManager', () => ({
  sessionManager: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
  },
}));

// Create a mock agent service
const mockAgentService = {
  startSession: jest.fn(),
  processQuery: jest.fn(),
  abortOperation: jest.fn(),
  isProcessing: jest.fn(),
  getHistory: jest.fn(),
  getPermissionRequests: jest.fn(),
  on: jest.fn(),
  resolvePermission: jest.fn(),
};

// Mock agent service
jest.mock('../../services/AgentService', () => ({
  getAgentService: jest.fn(() => mockAgentService),
}));

describe('API Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock request, response, and next
    mockRequest = {
      body: {},
      query: {},
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    nextFunction = jest.fn();

    // Mock session manager methods
    (sessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'mock-session-id',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      state: { conversationHistory: [] },
      isProcessing: false,
    });

    // Mock agent service methods
    mockAgentService.startSession.mockReturnValue({
      id: 'mock-session-id',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      state: { conversationHistory: [] },
      isProcessing: false,
    });

    mockAgentService.processQuery.mockResolvedValue({
      response: 'Mock response',
      toolResults: [],
    });

    mockAgentService.abortOperation.mockReturnValue(true);

    mockAgentService.isProcessing.mockReturnValue(false);

    mockAgentService.getHistory.mockReturnValue([]);

    mockAgentService.getPermissionRequests.mockReturnValue([]);
  });

  describe('startSession', () => {
    it('should create a new session with the agent service', async () => {
      // Call the controller
      await apiController.startSession(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify agent service was called
      expect(mockAgentService.startSession).toHaveBeenCalled();
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'mock-session-id',
      }));
    });

    it('should pass configuration to the agent service', async () => {
      // Set up request
      mockRequest.body = {
        config: {
          model: 'test-model',
        },
      };

      // Call the controller
      await apiController.startSession(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify agent service was called with config
      expect(mockAgentService.startSession).toHaveBeenCalledWith({
        model: 'test-model',
      });
    });
  });

  describe('submitQuery', () => {
    it('should submit a query to the agent service', async () => {
      // Set up request
      mockRequest.body = {
        sessionId: 'mock-session-id',
        query: 'Test query',
      };

      // Call the controller
      await apiController.submitQuery(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify agent service was called
      expect(mockAgentService.processQuery).toHaveBeenCalledWith('mock-session-id', 'Test query');
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        accepted: true,
        sessionId: 'mock-session-id',
      }));
    });

    it('should handle immediate errors', async () => {
      // Set up request
      mockRequest.body = {
        sessionId: 'mock-session-id',
        query: 'Test query',
      };

      // Mock agent service to throw an error
      mockAgentService.processQuery.mockImplementationOnce(() => {
        throw new Error('Agent busy');
      });

      // Call the controller
      await apiController.submitQuery(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify error handling
      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('abortOperation', () => {
    it('should abort an operation with the agent service', async () => {
      // Set up request
      mockRequest.body = {
        sessionId: 'mock-session-id',
      };

      // Call the controller
      await apiController.abortOperation(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify agent service was called
      expect(mockAgentService.abortOperation).toHaveBeenCalledWith('mock-session-id');
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId: 'mock-session-id',
      }));
    });

    it('should handle when there is nothing to abort', async () => {
      // Set up request
      mockRequest.body = {
        sessionId: 'mock-session-id',
      };

      // Mock agent service to return false (nothing to abort)
      mockAgentService.abortOperation.mockReturnValueOnce(false);

      // Call the controller
      await apiController.abortOperation(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        sessionId: 'mock-session-id',
        message: 'No operation to abort',
      }));
    });
  });

  describe('getHistory', () => {
    it('should get history from the agent service', async () => {
      // Set up request
      mockRequest.query = {
        sessionId: 'mock-session-id',
      };

      // Mock history
      mockAgentService.getHistory.mockReturnValueOnce([
        { role: 'user', content: [{ type: 'text', text: 'Hello', citations: null }] },
      ]);

      // Call the controller
      await apiController.getHistory(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify agent service was called
      expect(mockAgentService.getHistory).toHaveBeenCalledWith('mock-session-id');
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        sessionId: 'mock-session-id',
        history: [
          { role: 'user', content: [{ type: 'text', text: 'Hello', citations: null }] },
        ],
      });
    });
  });

  describe('getStatus', () => {
    it('should get status from agent service', async () => {
      // Set up request
      mockRequest.query = {
        sessionId: 'mock-session-id',
      };

      // Call the controller
      await apiController.getStatus(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify agent service was called
      expect(mockAgentService.isProcessing).toHaveBeenCalledWith('mock-session-id');
      expect(mockAgentService.getPermissionRequests).toHaveBeenCalledWith('mock-session-id');
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'mock-session-id',
        isProcessing: false,
      }));
    });

    it('should include pending permission requests if any', async () => {
      // Set up request
      mockRequest.query = {
        sessionId: 'mock-session-id',
      };

      // Mock permission requests
      mockAgentService.getPermissionRequests.mockReturnValueOnce([
        {
          permissionId: 'test-permission-id',
          toolId: 'TestTool',
          args: { arg1: 'value1' },
          timestamp: new Date().toISOString(),
        },
      ]);

      // Call the controller
      await apiController.getStatus(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Verify response includes permission requests
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        pendingPermissionRequests: expect.any(Array),
      }));
    });
  });
});