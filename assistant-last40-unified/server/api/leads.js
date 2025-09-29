import { db } from '../db.js';
import { leads } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

// Validation schema for lead creation
const createLeadSchema = z.object({
  email: z.string().email(),
  platformTags: z.array(z.string()).min(1),
  painPoint: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  referrer: z.string().optional()
});

/**
 * Create a new lead for waitlist functionality
 */
export async function createLead(req, res) {
  try {
    const validatedData = createLeadSchema.parse(req.body);
    
    const leadId = nanoid();
    
    const newLead = await db.insert(leads).values({
      id: leadId,
      ...validatedData,
      createdAt: new Date()
    }).returning();

    res.status(201).json({
      success: true,
      data: newLead[0],
      message: 'Lead created successfully'
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Create lead error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Confirm a lead (mark as confirmed)
 */
export async function confirmLead(req, res) {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation token required'
      });
    }

    // For now, use the token as lead ID
    // In production, you might want a separate confirmation token system
    const leadId = token;

    const updatedLead = await db
      .update(leads)
      .set({ 
        confirmedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();

    if (updatedLead.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: updatedLead[0],
      message: 'Lead confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm lead error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}