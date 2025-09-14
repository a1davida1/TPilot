import { Request, Response } from 'express';
import { db } from '../db';
import { leads } from '@shared/schema.js';
import { desc } from 'drizzle-orm';

export async function getLeads(req: Request, res: Response) {
  try {
    // In a real implementation, you'd check admin authentication here
    // For now, we'll allow access in development mode
    
    const allLeads = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));

    res.json(allLeads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
}