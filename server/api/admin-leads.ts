import { Request, Response } from 'express';
import { db } from '../db';
import { leads } from '@shared/schema';
import { desc } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

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
    logger.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
}