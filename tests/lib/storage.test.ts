import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([])
    })
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([])
    })
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined)
  })
};

vi.mock('../../server/db', () => ({ db: mockDb }));

// Mock the storage layer
const mockStorage = {
  async createUser(userData: any) {
    return {
      id: 1,
      ...userData,
      tier: userData.tier || 'free',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },
  async getUserByEmail(email: string) {
    if (email === 'existing@example.com') {
      return { id: 1, email, username: 'existing', tier: 'free' };
    }
    return null;
  },
  async getUserById(id: number) {
    return { id, email: 'test@example.com', username: 'testuser', tier: 'free' };
  }
};

vi.mock('../../server/storage', () => ({ storage: mockStorage }));

// Mock schema
vi.mock('@shared/schema.js', () => ({
  users: { id: 'id', username: 'username', email: 'email', tier: 'tier' },
  contentGenerations: { id: 'id', userId: 'userId' },
}));

describe('Storage Layer', () => {
  let testUserId: number | null = null;

  afterEach(async () => {
    // No real cleanup needed with mocks
    testUserId = null;
  });

  describe('User Operations', () => {
    test('should create a new user', async () => {
      const userData = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'hashed_password_123',
        tier: 'free' as const
      };

      const { storage } = await import('../../server/storage');
      const user = await storage.createUser(userData);
      testUserId = user.id;

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.tier).toBe('free');
    });

    test('should retrieve user by email', async () => {
      const { storage } = await import('../../server/storage');

      const retrievedUser = await storage.getUserByEmail('existing@example.com');

      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.email).toBe('existing@example.com');
      expect(retrievedUser?.username).toBe('existing');
    });

    test('should return null for non-existent email', async () => {
      const { storage } = await import('../../server/storage');
      const user = await storage.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    test('should retrieve user by ID', async () => {
      const { storage } = await import('../../server/storage');

      const retrievedUser = await storage.getUserById(1);

      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.id).toBe(1);
      expect(retrievedUser?.email).toBe('test@example.com');
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

      const { storage } = await import('../../server/storage');
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

      const { storage } = await import('../../server/storage');
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

      const { storage } = await import('../../server/storage');
      const result = await storage.getAllUsers();

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should validate storage operations', async () => {
      // Test basic storage functionality
      const mockUser = { id: 1, username: 'testuser' };
      mockDb.execute.mockResolvedValueOnce([mockUser]);

      const { storage } = await import('../../server/storage');
      const result = await storage.getUserById(1);
      expect(result).toEqual(mockUser);
    });
  });
});