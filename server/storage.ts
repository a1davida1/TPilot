import {
  type User,
  type InsertUser,
  type ContentGeneration,
  type InsertContentGeneration,
  type UserSample,
  type InsertUserSample,
  type UserPreference,
  type InsertUserPreference,
  type UserImage,
  type InsertUserImage,
  users,
  contentGenerations,
  userSamples,
  userPreferences,
  userImages
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTier(userId: number, tier: string): Promise<void>;
  updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(userId: number): Promise<void>;

  // Generation operations
  createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getGenerationsByUserId(userId: number): Promise<ContentGeneration[]>;
  createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getUserContentGenerations(userId: number): Promise<ContentGeneration[]>;
  getContentGenerationStats(userId: number): Promise<{ total: number; thisWeek: number; thisMonth: number; totalGenerations?: number }>;
  getLastGenerated(userId: number): Promise<ContentGeneration | undefined>;

  // Sample operations
  createUserSample(sample: InsertUserSample): Promise<UserSample>;
  getUserSamples(userId: number): Promise<UserSample[]>;
  deleteUserSample(id: number, userId: number): Promise<void>;

  // Preference operations
  getUserPreferences(userId: number): Promise<UserPreference | undefined>;
  upsertUserPreferences(prefs: InsertUserPreference): Promise<UserPreference>;

  // Image operations
  createUserImage(image: InsertUserImage): Promise<UserImage>;
  getUserImages(userId: number): Promise<UserImage[]>;
  getImageById(id: number): Promise<UserImage | undefined>;
  updateImageProtection(id: number, protectionData: Partial<UserImage>): Promise<UserImage | undefined>;
  deleteUserImage(id: number, userId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: User[] = [];
  private contentGenerations: ContentGeneration[] = [];
  private userSamples: UserSample[] = [];
  private userPreferences: UserPreference[] = [];
  private userImages: UserImage[] = [];
  private nextUserId = 1;
  private nextGenId = 1;
  private nextSampleId = 1;
  private nextPrefId = 1;
  private nextImageId = 1;

  constructor() {
    // Create a demo user
    this.users.push({
      id: 1,
      username: "demo",
      password: "demo",
      email: "demo@example.com",
      tier: "pro",
      provider: null,
      providerId: null,
      avatar: null,
      createdAt: new Date(),
    });
    this.nextUserId = 2;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    console.log('Storage: Looking for user with ID:', id);
    console.log('Storage: Available users:', this.users.map(u => ({ id: u.id, username: u.username })));
    return this.users.find(user => user.id === id);
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newId = Math.max(0, ...this.users.map(u => u.id)) + 1;
    const user: User = {
      ...userData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    this.users.push(user);
    console.log('Storage: Created user:', { id: user.id, username: user.username });
    console.log('Storage: Total users now:', this.users.length);
    return user;
  }

  async updateUserTier(userId: number, tier: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.tier = tier;
    }
  }

  async updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, updates);
      return user;
    }
    return undefined;
  }

  async deleteUser(userId: number): Promise<void> {
    const index = this.users.findIndex(u => u.id === userId);
    if (index >= 0) {
      this.users.splice(index, 1);
    }
  }

  // Generation operations
  async createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    const newGen: ContentGeneration = {
      ...gen,
      id: this.nextGenId++,
      userId: gen.userId ?? null,
      prompt: gen.prompt ?? null,
      subreddit: gen.subreddit ?? null,
      allowsPromotion: gen.allowsPromotion ?? null,
      createdAt: new Date(),
    };
    this.contentGenerations.push(newGen);
    return newGen;
  }

  async getGenerationsByUserId(userId: number): Promise<ContentGeneration[]> {
    return this.contentGenerations.filter(g => g.userId === userId);
  }

  async createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    return this.createGeneration(gen);
  }

  async getUserContentGenerations(userId: number): Promise<ContentGeneration[]> {
    return this.getGenerationsByUserId(userId);
  }

  async getContentGenerationStats(userId: number): Promise<{ total: number; thisWeek: number; thisMonth: number; totalGenerations?: number }> {
    const userGenerations = this.contentGenerations.filter(g => g.userId === userId);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: userGenerations.length,
      totalGenerations: userGenerations.length,
      thisWeek: userGenerations.filter(g => g.createdAt && g.createdAt > oneWeekAgo).length,
      thisMonth: userGenerations.filter(g => g.createdAt && g.createdAt > oneMonthAgo).length,
    };
  }

  async getLastGenerated(userId: number): Promise<ContentGeneration | undefined> {
    const userGenerations = this.contentGenerations
      .filter(g => g.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    return userGenerations[0];
  }

  // Sample operations
  async createUserSample(sample: InsertUserSample): Promise<UserSample> {
    const newSample: UserSample = {
      ...sample,
      id: this.nextSampleId++,
      style: sample.style ?? null,
      performanceScore: sample.performanceScore ?? null,
      tags: sample.tags ?? null,
      imageUrls: sample.imageUrls ?? null,
      metadata: sample.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userSamples.push(newSample);
    return newSample;
  }

  async getUserSamples(userId: number): Promise<UserSample[]> {
    return this.userSamples.filter(s => s.userId === userId);
  }

  async deleteUserSample(id: number, userId: number): Promise<void> {
    const index = this.userSamples.findIndex(s => s.id === id && s.userId === userId);
    if (index >= 0) {
      this.userSamples.splice(index, 1);
    }
  }

  // Preference operations
  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    return this.userPreferences.find(p => p.userId === userId);
  }

  async upsertUserPreferences(prefs: InsertUserPreference): Promise<UserPreference> {
    let existing = this.userPreferences.find(p => p.userId === prefs.userId);

    if (existing) {
      Object.assign(existing, prefs, { updatedAt: new Date() });
      return existing;
    } else {
      const newPrefs: UserPreference = {
        ...prefs,
        id: this.nextPrefId++,
        writingStyle: prefs.writingStyle ?? null,
        contentPreferences: prefs.contentPreferences ?? null,
        prohibitedWords: prefs.prohibitedWords ?? null,
        photoStyle: prefs.photoStyle ?? null,
        platformSettings: prefs.platformSettings ?? null,
        fineTuningEnabled: prefs.fineTuningEnabled ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.userPreferences.push(newPrefs);
      return newPrefs;
    }
  }

  // Image operations
  async createUserImage(image: InsertUserImage): Promise<UserImage> {
    const newImage: UserImage = {
      ...image,
      id: this.nextImageId++,
      isProtected: image.isProtected ?? false,
      protectionLevel: image.protectionLevel ?? "none",
      tags: image.tags ?? null,
      metadata: image.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userImages.push(newImage);
    return newImage;
  }

  async getUserImages(userId: number): Promise<UserImage[]> {
    return this.userImages.filter(img => img.userId === userId);
  }

  async getImageById(id: number): Promise<UserImage | undefined> {
    return this.userImages.find(img => img.id === id);
  }

  async updateImageProtection(id: number, protectionData: Partial<UserImage>): Promise<UserImage | undefined> {
    const image = this.userImages.find(img => img.id === id);
    if (image) {
      Object.assign(image, protectionData, { updatedAt: new Date() });
      return image;
    }
    return undefined;
  }

  async deleteUserImage(id: number, userId: number): Promise<void> {
    const index = this.userImages.findIndex(img => img.id === id && img.userId === userId);
    if (index >= 0) {
      this.userImages.splice(index, 1);
    }
  }
}

export const storage = new MemStorage();