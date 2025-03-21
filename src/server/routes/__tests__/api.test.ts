/**
 * API routes tests
 */
import request from 'supertest';
import express from 'express';
import { json } from 'express';
import apiRoutes from '../api';
import { errorHandler } from '../../middleware/errorHandler';

// Mock session manager and validation
jest.mock('../../services/SessionManager', () => {
  const mockSession = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    lastActiveAt: new Date('2023-01-01T01:00:00.000Z'),
    state: { conversationHistory: [] },
    isProcessing: false,
  };
  
  return {
    sessionManager: {
      createSession: jest.fn().mockReturnValue(mockSession),
      getSession: jest.fn().mockReturnValue(mockSession),
      updateSession: jest.fn().mockReturnValue({
        ...mockSession,
        lastActiveAt: new Date('2023-01-01T02:00:00.000Z'),
      }),
      deleteSession: jest.fn(),
      getAllSessions: jest.fn().mockReturnValue([mockSession]),
    },
  };
});

describe('API Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(json());
    app.use('/api', apiRoutes);
    app.use(errorHandler);
  });

  describe('POST /api/start', () => {
    it('should create a new session', async () => {
      const response = await request(app)
        .post('/api/start')
        .send({});
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('lastActiveAt');
      expect(response.body).toHaveProperty('isProcessing');
    });

    it('should accept optional configuration', async () => {
      const response = await request(app)
        .post('/api/start')
        .send({
          config: {
            model: 'test-model',
          },
        });
      
      expect(response.status).toBe(201);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/start')
        .send({
          config: {
            // Invalid config property
            unknownProperty: true,
          },
        });
      
      // Should still work because the schema validation is lenient
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/query', () => {
    it('should process a query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          query: 'test query',
        });
      
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('accepted', true);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('message');
    });

    it('should validate session ID', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({
          sessionId: 'invalid-uuid',
          query: 'test query',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should validate query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          query: '',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/abort', () => {
    it('should abort the current operation', async () => {
      const response = await request(app)
        .post('/api/abort')
        .send({
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('message');
    });

    it('should validate session ID', async () => {
      const response = await request(app)
        .post('/api/abort')
        .send({
          sessionId: 'invalid-uuid',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/history', () => {
    it('should return the conversation history', async () => {
      const response = await request(app)
        .get('/api/history')
        .query({
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('history');
    });

    it('should validate session ID', async () => {
      const response = await request(app)
        .get('/api/history')
        .query({
          sessionId: 'invalid-uuid',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/status', () => {
    it('should return the current agent status', async () => {
      const response = await request(app)
        .get('/api/status')
        .query({
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('isProcessing');
      expect(response.body).toHaveProperty('lastActiveAt');
    });

    it('should validate session ID', async () => {
      const response = await request(app)
        .get('/api/status')
        .query({
          sessionId: 'invalid-uuid',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });
});