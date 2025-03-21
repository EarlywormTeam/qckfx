/**
 * Session manager tests
 */
import { SessionManager, Session } from '../SessionManager';
import { SessionNotFoundError } from '../../utils/errors';

// Mock serverLogger
jest.mock('../../logger', () => ({
  serverLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    jest.useFakeTimers();
    // Create a new session manager with cleanup disabled for testing
    sessionManager = new SessionManager({
      cleanupEnabled: false,
      maxSessions: 3,
    });
  });

  afterEach(() => {
    sessionManager.stop();
    jest.useRealTimers();
  });

  describe('createSession', () => {
    it('should create a new session with valid properties', () => {
      const session = sessionManager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActiveAt).toBeInstanceOf(Date);
      expect(session.state).toEqual({ conversationHistory: [] });
      expect(session.isProcessing).toBe(false);
    });

    it('should enforce the maximum number of sessions', () => {
      // Create the maximum number of sessions
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      const session3 = sessionManager.createSession();

      // Create one more session - should replace the oldest one
      const session4 = sessionManager.createSession();

      // Try to get the first session - should throw
      expect(() => {
        sessionManager.getSession(session1.id);
      }).toThrow(SessionNotFoundError);

      // The other sessions should still exist
      expect(sessionManager.getSession(session2.id)).toBeDefined();
      expect(sessionManager.getSession(session3.id)).toBeDefined();
      expect(sessionManager.getSession(session4.id)).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return the session if it exists', () => {
      const createdSession = sessionManager.createSession();
      const retrievedSession = sessionManager.getSession(createdSession.id);

      expect(retrievedSession).toEqual(createdSession);
    });

    it('should throw if the session does not exist', () => {
      expect(() => {
        sessionManager.getSession('non-existent-id');
      }).toThrow(SessionNotFoundError);
    });
  });

  describe('updateSession', () => {
    it('should update session properties', () => {
      const session = sessionManager.createSession();
      
      // Update the session
      const updatedSession = sessionManager.updateSession(session.id, {
        state: { conversationHistory: [{ role: 'user', content: [{ type: 'text', text: 'Hello', citations: null }] }] },
        isProcessing: true,
      });

      // Check that the update was applied
      expect(updatedSession.state.conversationHistory).toHaveLength(1);
      expect(updatedSession.isProcessing).toBe(true);
      
      // lastActiveAt should have been updated
      expect(updatedSession.lastActiveAt.getTime()).toBeGreaterThanOrEqual(session.lastActiveAt.getTime());
    });

    it('should throw if the session does not exist', () => {
      expect(() => {
        sessionManager.updateSession('non-existent-id', { isProcessing: true });
      }).toThrow(SessionNotFoundError);
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', () => {
      const session = sessionManager.createSession();
      
      // Delete the session
      sessionManager.deleteSession(session.id);
      
      // Check that the session no longer exists
      expect(() => {
        sessionManager.getSession(session.id);
      }).toThrow(SessionNotFoundError);
    });

    it('should throw if the session does not exist', () => {
      expect(() => {
        sessionManager.deleteSession('non-existent-id');
      }).toThrow(SessionNotFoundError);
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', () => {
      // Create a few sessions
      sessionManager.createSession();
      sessionManager.createSession();
      
      const sessions = sessionManager.getAllSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('id');
      expect(sessions[1]).toHaveProperty('id');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      // Create a session manager with a short timeout
      const mgr = new SessionManager({
        cleanupEnabled: false,
        sessionTimeout: 10, // 10ms timeout
      });
      
      // Create a session
      const session = mgr.createSession();
      
      // Mock date to be in the future
      const futureDate = new Date();
      futureDate.setSeconds(futureDate.getSeconds() + 30);
      const MockDate = jest.fn(() => futureDate) as unknown as DateConstructor;
      global.Date = MockDate;
      
      // Clean up expired sessions
      mgr.cleanupExpiredSessions();
      
      // Check that the session no longer exists
      expect(() => {
        mgr.getSession(session.id);
      }).toThrow(SessionNotFoundError);
      
      mgr.stop();
      
      // Restore the original Date implementation
      global.Date = Date;
    });
  });
});