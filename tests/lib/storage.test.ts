import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../../server/storage.ts';

// Mock database
const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  execute: vi.fn(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
}));

vi.mock('../../server/db.js', () => ({ db: mockDb }));

vi.mock('@shared/schema.js', () => ({
  users: { id: 'id', username: 'username', email: 'email' },
  contentGenerations: { id: 'id', userId: 'userId' },
}));

describe('Storage Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Operations', () => {
    it('should create a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      };

      mockDb.execute.mockResolvedValueOnce([{ id: 1, ...userData }]);

      const result = await storage.createUser(userData);
      
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(userData);
      expect(result).toHaveProperty('id', 1);
    });

    it('should get user by email', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser' };
      mockDb.execute.mockResolvedValueOnce([mockUser]);

      const result = await storage.getUserByEmail('test@example.com');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should get user by username', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser' };
      mockDb.execute.mockResolvedValueOnce([mockUser]);

      const result = await storage.getUserByUsername('testuser');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('Content Generation Operations', () => {
    it('should create content generation record', async () => {
      const generationData = {
        userId: 1,
        platform: 'reddit',
        style: 'casual',
        theme: 'selfie',
        titles: ['Test title'],
        content: 'Test content',
        photoInstructions: {
          lighting: 'soft',
          cameraAngle: 'front',
          composition: 'center',
          styling: 'casual',
          mood: 'happy',
          technicalSettings: 'auto'
        },
        type: 'image_to_content',
        prompt: 'Test prompt',
        result: { caption: 'Test caption' }
      };

      mockDb.execute.mockResolvedValueOnce([{ id: 1, ...generationData }]);

      const result = await storage.createContentGeneration(generationData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 1);
    });

    it('should get user content generations', async () => {
      const mockGenerations = [
        { id: 1, userId: 1, type: 'image_to_content' },
        { id: 2, userId: 1, type: 'text_to_content' }
      ];
      mockDb.execute.mockResolvedValueOnce(mockGenerations);

      const result = await storage.getUserContentGenerations(1);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('Admin Operations', () => {
    it('should get all users for admin', async () => {
      const mockUsers = [
        { id: 1, username: 'user1', tier: 'free' },
        { id: 2, username: 'user2', tier: 'pro' }
      ];
      mockDb.execute.mockResolvedValueOnce(mockUsers);

      const result = await storage.getAllUsers();

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should validate storage operations', async () => {
      // Test basic storage functionality
      const mockUser = { id: 1, username: 'testuser' };
      mockDb.execute.mockResolvedValueOnce([mockUser]);

      const result = await storage.getUserById(1);
      expect(result).toEqual(mockUser);
    });
  });
});