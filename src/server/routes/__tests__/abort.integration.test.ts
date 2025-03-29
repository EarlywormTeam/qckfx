/**
 * Abort API Integration Tests
 */
import request from 'supertest';
import express from 'express';
import { json } from 'express';
import apiRoutes from '../../routes/api';
import { errorHandler } from '../../middleware/errorHandler';

// Mock E2B to avoid dependency issues
jest.mock('../../../utils/E2BExecutionAdapter');
jest.mock('../../../utils/LocalExecutionAdapter');

// Mock session manager
jest.mock('../../services/SessionManager', () => {
  const mockSession = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    lastActiveAt: new Date('2023-01-01T01:00:00.000Z'),
    state: { __aborted: false },
    isProcessing: false,
  };

  return {
    sessionManager: {
      createSession: jest.fn().mockReturnValue({
        ...mockSession,
        id: '123e4567-e89b-12d3-a456-426614174001',
      }),
      getSession: jest.fn().mockImplementation((id) => {
        if (id === '123e4567-e89b-12d3-a456-426614174000' || id === '123e4567-e89b-12d3-a456-426614174002') {
          return { 
            ...mockSession, 
            id, 
            isProcessing: id === '123e4567-e89b-12d3-a456-426614174000' 
          };
        }
        throw new Error('Session not found');
      }),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
    },
  };
});

// Mock agent service
jest.mock('../../services/AgentService', () => {
  const eventEmitter = new (require('events')).EventEmitter();
  
  return {
    getAgentService: jest.fn(() => ({
      abortOperation: jest.fn().mockImplementation((sessionId) => {
        if (sessionId === '123e4567-e89b-12d3-a456-426614174000') {
          // Emit abort event for this session
          eventEmitter.emit('processing:aborted', { sessionId });
          return true;
        }
        return false;
      }),
      on: eventEmitter.on.bind(eventEmitter),
      emit: eventEmitter.emit.bind(eventEmitter),
      startSession: jest.fn(),
    })),
    AgentServiceEvent: {
      PROCESSING_ABORTED: 'processing:aborted',
    },
  };
});

describe('Abort API Integration Tests', () => {
  let app: express.Application;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    app = express();
    app.use(json());
    app.use('/api', apiRoutes);
    app.use(errorHandler);
  });

  it('returns 200 with success true when aborting a processing session', async () => {
    const response = await request(app)
      .post('/api/abort')
      .send({ sessionId: '123e4567-e89b-12d3-a456-426614174000' })
      .expect(200);
    
    // Check response structure
    expect(response.body).toMatchObject({
      success: true,
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      message: expect.stringContaining('aborted')
    });
  });

  it('returns 200 with success false when aborting a non-processing session', async () => {
    const response = await request(app)
      .post('/api/abort')
      .send({ sessionId: '123e4567-e89b-12d3-a456-426614174002' })
      .expect(200);
    
    // Check response structure
    expect(response.body).toMatchObject({
      success: false,
      sessionId: '123e4567-e89b-12d3-a456-426614174002',
      message: expect.stringContaining('No operation to abort')
    });
  });

  it('returns 400 when session ID is not a valid UUID', async () => {
    const response = await request(app)
      .post('/api/abort')
      .send({ sessionId: 'not-a-uuid' })
      .expect(400);
    
    // Check error response
    expect(response.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('Invalid request body')
      }
    });
  });
});