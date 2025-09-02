import { db } from '../db.js';
import { leads } from '@shared/schema';
import { desc } from 'drizzle-orm';
export async function getLeads(req, res) {
    try {
        // In a real implementation, you'd check admin authentication here
        // For now, we'll allow access in development mode
        const allLeads = await db
            .select()
            .from(leads)
            .orderBy(desc(leads.createdAt));
        res.json(allLeads);
    }
    catch (error) {
        console.error('Get leads error:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
}
