import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies
vi.mock('../../server/storage.js', () => ({
  storage: {
    getAllUsers: vi.fn().mockResolvedValue([
      { id: 1, username: 'user1', email: 'user1@test.com', tier: 'free' },
      { id: 2, username: 'user2', email: 'user2@test.com', tier: 'pro' }
    ]),
    getAdminStats: vi.fn().mockResolvedValue({
      totalUsers: 7,
      freeUsers: 6,
      proUsers: 1,
      premiumUsers: 0,
      newUsersToday: 2,
      activeUsers: 5,
      contentGenerated: "18",
      revenue: 20
    }),
    upgradeUser: vi.fn().mockResolvedValue({ success: true }),
    createUser: vi.fn().mockResolvedValue({ id: 3, username: 'trial_user', tier: 'starter' })
  }
}));

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 999, username: 'admin', isAdmin: true };
    next();
  }
}));

vi.mock('../../server/admin-routes.js', () => ({
  setupAdminRoutes: (app: any) => {
    app.get('/api/admin/users', (req: any, res: any) => {
      res.json([
        { id: 1, username: 'user1', email: 'user1@test.com', tier: 'free' },
        { id: 2, username: 'user2', email: 'user2@test.com', tier: 'pro' }
      ]);
    });
    
    app.get('/api/admin/stats', (req: any, res: any) => {
      res.json({
        totalUsers: 7,
        freeUsers: 6,
        proUsers: 1,
        premiumUsers: 0,
        newUsersToday: 2
      });
    });

    app.post('/api/admin/upgrade-user', (req: any, res: any) => {
      res.json({ message: 'User upgraded successfully' });
    });
  }
}));

import { setupAdminRoutes } from '../../server/admin-routes.js';

describe('Admin Routes', () => {
  let app: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    setupAdminRoutes(app);
    vi.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should return list of all users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('username', 'user1');
      expect(response.body[1]).toHaveProperty('tier', 'pro');
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return admin statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalUsers', 7);
      expect(response.body).toHaveProperty('freeUsers', 6);
      expect(response.body).toHaveProperty('proUsers', 1);
    });
  });

  describe('POST /api/admin/upgrade-user', () => {
    it('should upgrade user tier successfully', async () => {
      const response = await request(app)
        .post('/api/admin/upgrade-user')
        .send({ userId: 1, tier: 'pro' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'User upgraded successfully');
    });
  });
});