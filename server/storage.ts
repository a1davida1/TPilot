import { 
  type User, 
  type InsertUser, 
  type ContentGeneration, 
  type InsertContentGeneration,
  type UserSample,
  type InsertUserSample,
  type UserPreference,
  type InsertUserPreference,
  users,
  contentGenerations,
  userSamples,
  userPreferences
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTier(userId: number, tier: string): Promise<void>;
  
  // Generation operations
  createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getGenerationsByUserId(userId: number): Promise<ContentGeneration[]>;
  
  // Sample operations
  createUserSample(sample: InsertUserSample): Promise<UserSample>;
  getUserSamples(userId: number): Promise<UserSample[]>;
  deleteUserSample(id: number, userId: number): Promise<void>;
  
  // Preference operations
  getUserPreferences(userId: number): Promise<UserPreference | undefined>;
  upsertUserPreferences(prefs: InsertUserPreference): Promise<UserPreference>;
}

export class MemStorage implements IStorage {
  private users: User[] = [];
  private contentGenerations: ContentGeneration[] = [];
  private userSamples: UserSample[] = [];
  private userPreferences: UserPreference[] = [];
  private nextUserId = 1;
  private nextGenId = 1;
  private nextSampleId = 1;
  private nextPrefId = 1;

  constructor() {
    // Create a demo user
    this.users.push({
      id: 1,
      username: "demo",
      password: "demo",
      email: "demo@example.com",
      tier: "pro",
      createdAt: new Date(),
    });
    this.nextUserId = 2;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      ...user,
      id: this.nextUserId++,
      createdAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUserTier(userId: number, tier: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.tier = tier;
    }
  }

  // Generation operations
  async createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    const newGen: ContentGeneration = {
      ...gen,
      id: this.nextGenId++,
      createdAt: new Date(),
    };
    this.contentGenerations.push(newGen);
    return newGen;
  }

  async getGenerationsByUserId(userId: number): Promise<ContentGeneration[]> {
    return this.contentGenerations.filter(g => g.userId === userId);
  }

  // Sample operations
  async createUserSample(sample: InsertUserSample): Promise<UserSample> {
    const newSample: UserSample = {
      ...sample,
      id: this.nextSampleId++,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.userPreferences.push(newPrefs);
      return newPrefs;
    }
  }
}

export const storage = new MemStorage();
