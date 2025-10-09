// Basic in-memory metrics - can be extended to database laterimport { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';

export class BasicAuthMetrics {
  private events: Array<{
    action: string;
    success: boolean;
    duration: number;
    error: string | null;
    timestamp: string;
  }> = [];
  private maxEvents = 1000; // Keep last 1000 events in memory
  private readonly maxErrorKeyLength = 120;

  private normalizeErrorKey(error: string): string | null {
    const normalizedWhitespace = error.replace(/\s+/g, ' ').trim();

    if (!normalizedWhitespace) {
      return null;
    }

    if (normalizedWhitespace.length <= this.maxErrorKeyLength) {
      return normalizedWhitespace;
    }

    return normalizedWhitespace.slice(0, this.maxErrorKeyLength);
  }
  
  track(action: string, success: boolean, duration: number, error: string | null = null) {
    const event = {
      action,
      success,
      duration,
      error,
      timestamp: new Date().toISOString()
    };
    
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // Log failures for monitoring
    if (!success) {
      logger.error(...formatLogArgs(`⚠️ Auth failure: ${action} - ${error}`));
    }
  }
  
  getSummary(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recent = this.events.filter(e => new Date(e.timestamp) > since);
    
    const summary: {
      total: number;
      successful: number;
      failed: number;
      averageDuration: number;
      byAction: { [key: string]: { success: number; failed: number } };
      topErrors: { [key: string]: number };
    } = {
      total: recent.length,
      successful: recent.filter(e => e.success).length,
      failed: recent.filter(e => !e.success).length,
      averageDuration: recent.reduce((sum, e) => sum + e.duration, 0) / recent.length || 0,
      byAction: {},
      topErrors: {}
    };
    
    // Group by action
    recent.forEach(e => {
      if (!summary.byAction[e.action]) {
        summary.byAction[e.action] = { success: 0, failed: 0 };
      }
      if (e.success) {
        summary.byAction[e.action].success++;
      } else {
        summary.byAction[e.action].failed++;
      }
    });
    
    // Count errors
    recent.forEach(e => {
      const errorKey = e.error ? this.normalizeErrorKey(e.error) : null;
      if (!errorKey) {
        return;
      }

      summary.topErrors[errorKey] = (summary.topErrors[errorKey] || 0) + 1;
    });

    return summary;
  }
  
  getRecentEvents(limit = 50) {
    return this.events.slice(-limit).reverse();
  }
}

export const authMetrics = new BasicAuthMetrics();