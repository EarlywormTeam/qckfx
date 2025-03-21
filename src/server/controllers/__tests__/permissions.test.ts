/**
 * Permission controller tests
 */
import { Request, Response, NextFunction } from 'express';
import * as permissionController from '../permissions';
import { getAgentService } from '../../services/AgentService';
import { NotFoundError } from '../../utils/errors';

// Mock the agent service
jest.mock('../../services/AgentService', () => ({
  getAgentService: jest.fn(),
}));

describe('Permission Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;
  let mockAgentService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock request, response, and next
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();

    // Create mock agent service
    mockAgentService = {
      getPermissionRequests: jest.fn(),
      resolvePermission: jest.fn(),
    };

    (getAgentService as jest.Mock).mockReturnValue(mockAgentService);
  });

  describe('getPermissionRequests', () => {
    it('should return permission requests for a session', async () => {
      // Mock query params
      mockRequest.query = { sessionId: '123e4567-e89b-12d3-a456-426614174000' };

      // Mock permission requests
      mockAgentService.getPermissionRequests.mockReturnValue([
        {
          permissionId: 'test-permission-id',
          toolId: 'TestTool',
          args: { arg1: 'value1' },
          timestamp: new Date().toISOString(),
        },
      ]);

      // Call the controller
      await permissionController.getPermissionRequests(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify the response
      expect(mockAgentService.getPermissionRequests).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        permissionRequests: expect.any(Array),
      });
    });

    it('should handle validation errors', async () => {
      // Invalid query params
      mockRequest.query = { sessionId: 'invalid-uuid' };

      // Call the controller
      await permissionController.getPermissionRequests(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error handling
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resolvePermission', () => {
    it('should resolve a permission request', async () => {
      // Mock request body
      mockRequest.body = {
        permissionId: 'test-permission-id',
        granted: true,
      };

      // Mock permission resolution
      mockAgentService.resolvePermission.mockReturnValue(true);

      // Call the controller
      await permissionController.resolvePermission(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify the response
      expect(mockAgentService.resolvePermission).toHaveBeenCalledWith('test-permission-id', true);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        permissionId: 'test-permission-id',
        granted: true,
        resolved: true,
      });
    });

    it('should handle not found errors', async () => {
      // Mock request body
      mockRequest.body = {
        permissionId: 'non-existent-id',
        granted: true,
      };

      // Mock permission resolution failure
      mockAgentService.resolvePermission.mockReturnValue(false);

      // Call the controller
      await permissionController.resolvePermission(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error handling
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });
});