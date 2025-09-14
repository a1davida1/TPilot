/* eslint-env node, jest */
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

interface TestUser {
  id: number;
  email: string;
  username: string;
  password: string; // hashed
  verified: boolean;
}

const SECRET = 'test-secret';
let app: express.Express;
let server: unknown;
let users: TestUser[] = [];
let sentEmails: string[] = [];

function reset() {
  users = [];
  sentEmails = [];
}

// Simple verification mailer mock
function sendVerificationEmail(email: string) {
  sentEmails.push(email);
}

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test',
        resave: false,
        saveUninitialized: false,
      })
    );

    // Signup route
    app.post('/api/auth/signup', async (req, res) => {
      const { email, password, username } = req.body;
      const emailRegex = /.+@.+\..+/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email' });
      }
      if (
        typeof password !== 'string' ||
        password.length < 8 ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        return res.status(400).json({ message: 'Weak password' });
      }
      if (users.find((u) => u.email === email || u.username === username)) {
        return res.status(400).json({ message: 'User already exists' });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user: TestUser = {
        id: users.length + 1,
        email,
        username,
        password: hashed,
        verified: false,
      };
      users.push(user);
      sendVerificationEmail(email);
      const { password: _, ...safe } = user;
      res.status(201).json(safe);
    });

    // Login route
    app.post('/api/auth/login', async (req, res) => {
      const { email, username, password } = req.body;
      const login = email || username;
      const user = users.find(
        (u) => u.email === login || u.username === login
      );
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });
      if (!user.verified)
        return res.status(403).json({ message: 'Email not verified' });
      const match = await bcrypt.compare(password, user.password);
      if (!match)
        return res.status(401).json({ message: 'Invalid credentials' });
      const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '1h' });
      (req.session as { userId?: number }).userId = user.id;
      const { password: _, ...safe } = user;
      res.json({ token, user: safe });
    });

    // Protected user route
    app.get('/api/auth/user', (req: express.Request & { session: { userId?: number } }, res) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(auth.substring(7), SECRET) as { id: number };
          const user = users.find((u) => u.id === decoded.id);
          if (user) {
            const { password: _, ...safe } = user;
            return res.json(safe);
          }
        } catch (_e) {
          return res.status(401).json({ message: 'Invalid token' });
        }
      }
      if (req.session.userId) {
        const user = users.find((u) => u.id === req.session.userId);
        if (user) {
          const { password: _, ...safe } = user;
          return res.json(safe);
        }
      }
      return res.status(401).json({ message: 'Unauthorized' });
    });

    // Logout
    app.post('/api/auth/logout', (req: express.Request & { session: { destroy: (callback: () => void) => void } }, res) => {
      req.session.destroy(() => res.json({ message: 'logged out' }));
    });

    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => (server as { close: (callback: () => void) => void }).close(() => resolve()));
  });

  beforeEach(async () => {
    reset();
  });

  afterEach(async () => {
    // no-op for now
  });

  describe('User Registration Flow', () => {
    test('should register new user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'Password1', username: 'test' });
      expect(res.status).toBe(201);
      expect(users.length).toBe(1);
      expect(sentEmails).toContain('test@example.com');
      expect(res.body).not.toHaveProperty('password');
    });

    test('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'bademail', password: 'Password1', username: 'test' });
      expect([200, 400]).toContain(res.status);
      expect(res.body.message).toMatch(/invalid email/i);
      expect(users.length).toBe(0);
    });

    test('should reject registration with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'user@example.com', password: 'weak', username: 'user' });
      expect([200, 400]).toContain(res.status);
      expect(res.body.message).toMatch(/weak password/i);
      expect(users.length).toBe(0);
    });

    test('should reject duplicate username/email registration', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@example.com', password: 'Password1', username: 'dup' });
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@example.com', password: 'Password1', username: 'dup' });
      expect([200, 400]).toContain(res.status);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe('User Login Flow', () => {
      test('should login user with valid credentials', async () => {
        const hashed = await bcrypt.hash('Password1', 10);
        users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: true });
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'login@test.com', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        const protectedRes = await request(app)
          .get('/api/auth/user')
          .set('Authorization', `Bearer ${res.body.token}`);
        expect(protectedRes.status).toBe(200);
        expect(protectedRes.body.email).toBe('login@test.com');
      });

      test('should reject login with invalid credentials', async () => {
        const hashed = await bcrypt.hash('Password1', 10);
        users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: true });
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'login@test.com', password: 'WrongPass1' });
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
      });

      test('should reject login for unverified email', async () => {
        const hashed = await bcrypt.hash('Password1', 10);
        users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: false });
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'login@test.com', password: 'Password1' });
        expect(res.status).toBe(403);
      });

      test('should support login with both email and username', async () => {
        const hashed = await bcrypt.hash('Password1', 10);
        users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: true });
        const resEmail = await request(app)
          .post('/api/auth/login')
          .send({ email: 'login@test.com', password: 'Password1' });
        const resUser = await request(app)
          .post('/api/auth/login')
          .send({ username: 'login', password: 'Password1' });
        expect(resEmail.status).toBe(200);
        expect(resUser.status).toBe(200);
        expect(resEmail.body.token).toBeTruthy();
        expect(resUser.body.token).toBeTruthy();
      });
  });

  describe('Protected Route Access', () => {
    test('should deny access without authentication', async () => {
      const res = await request(app).get('/api/auth/user');
      expect(res.status).toBe(401);
    });

    test('should grant access with valid token', async () => {
      const hashed = await bcrypt.hash('Password1', 10);
      users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: true });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'Password1' });
      const res = await request(app)
        .get('/api/auth/user')
        .set('Authorization', `Bearer ${loginRes.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('login@test.com');
    });

    test('should handle token expiration gracefully', async () => {
      const token = jwt.sign({ id: 1 }, SECRET, { expiresIn: -1 });
      const res = await request(app)
        .get('/api/auth/user')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid token/i);
    });
  });

  describe('Session Management', () => {
    test('should maintain session across requests', async () => {
      const hashed = await bcrypt.hash('Password1', 10);
      users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: true });
      const agent = request.agent(app);
      
      const loginRes = await agent
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'Password1' });
      
      expect(loginRes.status).toBe(200);
      
      // Make subsequent request with same agent (maintains cookies)
      const userRes = await agent.get('/api/auth/user');
      expect(userRes.status).toBe(200);
      expect(userRes.body.email).toBe('login@test.com');
    });

    test('should clear session on logout', async () => {
      const hashed = await bcrypt.hash('Password1', 10);
      users.push({ id: 1, email: 'login@test.com', username: 'login', password: hashed, verified: true });
      const agent = request.agent(app);
      
      await agent
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'Password1' });
      
      const logoutRes = await agent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);
      
      // Session should be cleared
      const userRes = await agent.get('/api/auth/user');
      expect(userRes.status).toBe(401);
    });
  });
});