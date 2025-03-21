/**
 * Session management service
 */
import { v4 as uuidv4 } from 'uuid';
import { SessionState } from '../../types/model';
import { ServerError, SessionNotFoundError } from '../utils/errors';
import { serverLogger } from '../logger';

/**
 * Session information
 */
export interface Session {
  /** Unique session ID */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
  /** Session state for the agent */
  state: SessionState;
  /** Whether the session is currently processing a query */
  isProcessing: boolean;
}

/**
 * Configuration for the session manager
 */
export interface SessionManagerConfig {
  /** Maximum number of sessions to keep */
  maxSessions?: number;
  /** Session timeout in milliseconds */
  sessionTimeout?: number;
  /** Whether to run cleanup periodically */
  cleanupEnabled?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<SessionManagerConfig> = {
  maxSessions: 10,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  cleanupEnabled: true,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
};

/**
 * Service for managing agent sessions
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: Required<SessionManagerConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: SessionManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.cleanupEnabled) {
      this.startCleanup();
    }
  }

  /**
   * Create a new session
   */
  public createSession(): Session {
    // Check if we've reached the maximum number of sessions
    if (this.sessions.size >= this.config.maxSessions) {
      // Find the oldest session
      let oldestSession: Session | null = null;
      
      for (const session of this.sessions.values()) {
        if (!oldestSession || session.lastActiveAt < oldestSession.lastActiveAt) {
          oldestSession = session;
        }
      }
      
      // Remove the oldest session
      if (oldestSession) {
        serverLogger.info(`Maximum sessions reached. Removing oldest session ${oldestSession.id}`);
        this.sessions.delete(oldestSession.id);
      }
    }
    
    // Create a new session
    const session: Session = {
      id: uuidv4(),
      createdAt: new Date(),
      lastActiveAt: new Date(),
      state: { conversationHistory: [] },
      isProcessing: false,
    };
    
    this.sessions.set(session.id, session);
    serverLogger.info(`Created new session ${session.id}`);
    
    return session;
  }

  /**
   * Get a session by ID
   */
  public getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    
    return session;
  }

  /**
   * Update a session
   */
  public updateSession(sessionId: string, updates: Partial<Omit<Session, 'id'>>): Session {
    const session = this.getSession(sessionId);
    
    // Update the session
    Object.assign(session, updates);
    
    // Always update lastActiveAt
    session.lastActiveAt = new Date();
    
    // Save the updated session
    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * Delete a session
   */
  public deleteSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new SessionNotFoundError(sessionId);
    }
    
    this.sessions.delete(sessionId);
    serverLogger.info(`Deleted session ${sessionId}`);
  }

  /**
   * Get all sessions
   */
  public getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Start the cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];
    
    this.sessions.forEach((session, id) => {
      const timeSinceLastActive = now.getTime() - session.lastActiveAt.getTime();
      
      if (timeSinceLastActive > this.config.sessionTimeout) {
        expiredSessions.push(id);
      }
    });
    
    if (expiredSessions.length > 0) {
      serverLogger.info(`Cleaning up ${expiredSessions.length} expired sessions`);
      
      expiredSessions.forEach(id => {
        this.sessions.delete(id);
      });
    }
  }

  /**
   * Stop the session manager and clean up resources
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Singleton instance of the session manager
 */
export const sessionManager = new SessionManager();