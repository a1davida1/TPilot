import { db } from '../db.js';
import { leads } from '@shared/schema';
import { desc, count, and, gte, lte } from 'drizzle-orm';

/**
 * Get leads for admin dashboard
 * Supports pagination and filtering
 */
export async function getLeads(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const platform = req.query.platform;

    // Build where conditions
    const whereConditions = [];
    
    if (startDate) {
      whereConditions.push(gte(leads.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      whereConditions.push(lte(leads.createdAt, new Date(endDate)));
    }

    // Get total count
    let countQuery = db
      .select({ count: count() })
      .from(leads);

    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }

    const totalCountResult = await countQuery;
    
    const totalCount = totalCountResult[0]?.count || 0;

    // Get leads data
    let query = db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    const leadsData = await query;

    // Filter by platform if specified (JSON search)
    let filteredLeads = leadsData;
    if (platform) {
      filteredLeads = leadsData.filter(lead => 
        lead.platformTags && lead.platformTags.includes(platform)
      );
    }

    // Calculate statistics
    const stats = {
      total: totalCount,
      confirmed: leadsData.filter(lead => lead.confirmedAt).length,
      pending: leadsData.filter(lead => !lead.confirmedAt).length,
      byPlatform: {}
    };

    // Platform breakdown
    leadsData.forEach(lead => {
      if (lead.platformTags) {
        lead.platformTags.forEach(platform => {
          stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
        });
      }
    });

    res.json({
      success: true,
      data: filteredLeads,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats,
      metadata: {
        lastUpdated: new Date().toISOString(),
        query: {
          startDate,
          endDate,
          platform
        }
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}