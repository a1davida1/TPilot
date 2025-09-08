/**
 * Session Storage Integration Tests
 * Verifies that session storage works correctly with PostgreSQL
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

const PgStore = connectPgSimple(session);

// Extend session interface for custom properties
declare module 'express-session' {
  interface SessionData {
    testData?: string;
    userId?: number;
  }
}

describe('Session Storage Integration', () => {
  let app: express.Application;
  let sessionStore: unknown;

  beforeEach(() => {
    app = express();
    
    // Create session store
    if (process.env.DATABASE_URL) {
      sessionStore = new PgStore({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        tableName: 'session'
      });
    }

    // Configure session middleware
    app.use(session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Test route to set session data
    app.post('/test/session/set', (req, res) => {
      req.session.testData = 'session-test-value';
      req.session.userId = 12345;
      res.json({ success: true, sessionId: req.sessionID });
    });

    // Test route to get session data
    app.get('/test/session/get', (req, res) => {
      res.json({ 
        testData: req.session.testData,
        userId: req.session.userId,
        sessionId: req.sessionID
      });
    });

    // Test route to destroy session
    app.post('/test/session/destroy', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ success: true });
        }
      });
    });
  });

  it('should create and retrieve session data', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping session test - no DATABASE_URL');
      return;
    }

    const agent = request.agent(app);

    // Set session data
    const setResponse = await agent
      .post('/test/session/set')
      .expect(200);
    
    expect(setResponse.body.success).toBe(true);
    expect(setResponse.body.sessionId).toBeTruthy();

    // Retrieve session data
    const getResponse = await agent
      .get('/test/session/get')
      .expect(200);
    
    expect(getResponse.body.testData).toBe('session-test-value');
    expect(getResponse.body.userId).toBe(12345);
    expect(getResponse.body.sessionId).toBe(setResponse.body.sessionId);
  });

  it('should persist session across requests', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping session test - no DATABASE_URL');
      return;
    }

    const agent = request.agent(app);

    // Set session data
    await agent.post('/test/session/set').expect(200);

    // Make multiple requests to verify persistence
    for (let i = 0; i < 3; i++) {
      const response = await agent.get('/test/session/get').expect(200);
      expect(response.body.testData).toBe('session-test-value');
      expect(response.body.userId).toBe(12345);
    }
  });

  it('should destroy session correctly', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping session test - no DATABASE_URL');
      return;
    }

    const agent = request.agent(app);

    // Set session data
    await agent.post('/test/session/set').expect(200);

    // Verify session exists
    const beforeDestroy = await agent.get('/test/session/get').expect(200);
    expect(beforeDestroy.body.testData).toBe('session-test-value');

    // Destroy session
    await agent.post('/test/session/destroy').expect(200);

    // Verify session is destroyed (new session should be created)
    const afterDestroy = await agent.get('/test/session/get').expect(200);
    expect(afterDestroy.body.testData).toBeUndefined();
    expect(afterDestroy.body.userId).toBeUndefined();
  });

  it('should handle concurrent sessions correctly', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping session test - no DATABASE_URL');
      return;
    }

    const agent1 = request.agent(app);
    const agent2 = request.agent(app);

    // Set different data for each session
    await agent1.post('/test/session/set').send();
    await agent2.post('/test/session/set').send();

    // Verify each agent maintains its own session
    const response1 = await agent1.get('/test/session/get');
    const response2 = await agent2.get('/test/session/get');

    expect(response1.body.sessionId).toBeTruthy();
    expect(response2.body.sessionId).toBeTruthy();
    expect(response1.body.sessionId).not.toBe(response2.body.sessionId);

    // Both should have the same data since we're using the same test data
    expect(response1.body.testData).toBe('session-test-value');
    expect(response2.body.testData).toBe('session-test-value');
  });

  it('should handle session store errors gracefully', async () => {
    // Create app with invalid session store to test error handling
    const errorApp = express();
    
    // Mock session store that fails
    const failingStore = {
      get: (sid: string, callback: (err: unknown, session?: unknown) => void) => {
        callback(new Error('Store connection failed'));
      },
      set: (sid: string, session: unknown, callback: (err?: unknown) => void) => {
        callback(new Error('Store write failed'));
      },
      destroy: (sid: string, callback: (err?: unknown) => void) => {
        callback(new Error('Store destroy failed'));
      },
      on: () => {}
    };

    errorApp.use(session({
      store: failingStore as { get: () => void; set: () => void; destroy: () => void },
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));

    errorApp.get('/test/error', (req, res) => {
      res.json({ sessionId: req.sessionID });
    });

    // This should still work despite store errors due to express-session fallback
    const response = await request(errorApp)
      .get('/test/error')
      .expect(200);
    
    expect(response.body.sessionId).toBeTruthy();
  });
});