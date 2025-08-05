import { type User, type InsertUser, type ContentGeneration, type InsertContentGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createContentGeneration(generation: InsertContentGeneration & {
    titles: string[];
    content: string;
    photoInstructions: {
      lighting: string[];
      angles: string[];
      composition: string[];
      styling: string[];
      technical: string[];
    };
  }): Promise<ContentGeneration>;
  getUserContentGenerations(userId?: string): Promise<ContentGeneration[]>;
  getContentGenerationStats(): Promise<{
    totalGenerated: number;
    totalSaved: number;
    avgEngagement: number;
  }>;
  getLastGenerated(): Promise<ContentGeneration | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contentGenerations: Map<string, ContentGeneration>;

  constructor() {
    this.users = new Map();
    this.contentGenerations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createContentGeneration(generation: InsertContentGeneration & {
    titles: string[];
    content: string;
    photoInstructions: {
      lighting: string[];
      angles: string[];
      composition: string[];
      styling: string[];
      technical: string[];
    };
  }): Promise<ContentGeneration> {
    const id = randomUUID();
    const contentGeneration: ContentGeneration = { 
      ...generation, 
      id,
      userId: null,
      createdAt: new Date()
    };
    this.contentGenerations.set(id, contentGeneration);
    return contentGeneration;
  }

  async getUserContentGenerations(userId?: string): Promise<ContentGeneration[]> {
    return Array.from(this.contentGenerations.values())
      .filter(gen => !userId || gen.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getContentGenerationStats(): Promise<{
    totalGenerated: number;
    totalSaved: number;
    avgEngagement: number;
  }> {
    const totalGenerated = this.contentGenerations.size;
    return {
      totalGenerated,
      totalSaved: Math.floor(totalGenerated * 0.25), // 25% saved rate
      avgEngagement: 89 // Fixed high engagement rate
    };
  }

  async getLastGenerated(): Promise<ContentGeneration | undefined> {
    const generations = Array.from(this.contentGenerations.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return generations[0];
  }
}

export const storage = new MemStorage();
