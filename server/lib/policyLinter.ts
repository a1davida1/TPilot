import { db } from "../db.js";
import { eq } from "drizzle-orm";
import { subredditRules } from "@shared/schema";

export interface PolicyWarning {
  type: 'bannedWord' | 'linkPolicy' | 'flairRequired' | 'lengthLimit' | 'imagePolicy';
  message: string;
  severity: 'warning' | 'error';
}

export interface PolicyResult {
  state: 'ok' | 'warn' | 'block';
  warnings: PolicyWarning[];
  score: number; // 0-100, higher is better
}

export interface SubredditPolicyRules {
  bannedWords?: string[];
  maxTitleLength?: number;
  maxBodyLength?: number;
  requiresFlair?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  imageRequired?: boolean;
  selfPostOnly?: boolean;
}

// Default NSFW-friendly rules for adult content subreddits
const DEFAULT_RULES: SubredditPolicyRules = {
  bannedWords: [
    'spam', 'bot', 'fake', 'scam', 'virus',
    'underage', 'minor', 'young', 'teen',
    'rape', 'violence', 'illegal', 'drugs'
  ],
  maxTitleLength: 300,
  maxBodyLength: 40000,
  requiresFlair: false,
  allowedDomains: ['reddit.com', 'imgur.com', 'gfycat.com', 'redgifs.com'],
  blockedDomains: ['bit.ly', 'tinyurl.com', 'short.link'],
  imageRequired: false,
  selfPostOnly: false,
};

export class PolicyLinter {
  private rules: SubredditPolicyRules;
  private subreddit: string;

  constructor(subreddit: string, rules?: SubredditPolicyRules) {
    this.subreddit = subreddit.toLowerCase();
    this.rules = { ...DEFAULT_RULES, ...rules };
  }

  static async forSubreddit(subreddit: string): Promise<PolicyLinter> {
    try {
      const rule = await db
        .select()
        .from(subredditRules)
        .where(eq(subredditRules.subreddit, subreddit.toLowerCase()))
        .limit(1);

      const customRules = rule.length > 0 
        ? rule[0].rulesJson as SubredditPolicyRules
        : undefined;

      return new PolicyLinter(subreddit, customRules);
    } catch (_error) {
      console.error(`Failed to load rules for r/${subreddit}:`, error);
      return new PolicyLinter(subreddit);
    }
  }

  async lintPost(title: string, body: string, hasImage: boolean = false): Promise<PolicyResult> {
    const warnings: PolicyWarning[] = [];
    let score = 100;

    // Check title length
    if (title.length > (this.rules.maxTitleLength || 300)) {
      warnings.push({
        type: 'lengthLimit',
        message: `Title too long (${title.length}/${this.rules.maxTitleLength} chars)`,
        severity: 'error',
      });
      score -= 25;
    }

    // Check body length
    if (body.length > (this.rules.maxBodyLength || 40000)) {
      warnings.push({
        type: 'lengthLimit',
        message: `Body too long (${body.length}/${this.rules.maxBodyLength} chars)`,
        severity: 'error',
      });
      score -= 25;
    }

    // Check banned words
    const fullText = `${title} ${body}`.toLowerCase();
    const bannedWordsFound = (this.rules.bannedWords || []).filter(word => 
      fullText.includes(word.toLowerCase())
    );

    if (bannedWordsFound.length > 0) {
      warnings.push({
        type: 'bannedWord',
        message: `Contains banned words: ${bannedWordsFound.join(', ')}`,
        severity: 'error',
      });
      score -= 30;
    }

    // Check for links and validate domains
    const linkRegex = /https?:\/\/(www\.)?([^/\s]+)/gi;
    const links = Array.from(fullText.matchAll(linkRegex));
    
    for (const link of links) {
      const domain = link[2].toLowerCase();
      
      if (this.rules.blockedDomains?.some(blocked => domain.includes(blocked))) {
        warnings.push({
          type: 'linkPolicy',
          message: `Blocked domain detected: ${domain}`,
          severity: 'error',
        });
        score -= 20;
      }
      
      if (this.rules.allowedDomains && 
          !this.rules.allowedDomains.some(allowed => domain.includes(allowed))) {
        warnings.push({
          type: 'linkPolicy',
          message: `Domain not in allowlist: ${domain}`,
          severity: 'warning',
        });
        score -= 10;
      }
    }

    // Check image requirements
    if (this.rules.imageRequired && !hasImage) {
      warnings.push({
        type: 'imagePolicy',
        message: 'This subreddit requires images with posts',
        severity: 'error',
      });
      score -= 20;
    }

    if (this.rules.requiresFlair) {
      warnings.push({
        type: 'flairRequired',
        message: 'Remember to add appropriate flair after posting',
        severity: 'warning',
      });
      score -= 5;
    }

    // Determine final state
    const hasErrors = warnings.some(w => w.severity === 'error');
    const hasWarnings = warnings.some(w => w.severity === 'warning');
    
    let state: PolicyResult['state'];
    if (hasErrors || score < 50) {
      state = 'block';
    } else if (hasWarnings || score < 80) {
      state = 'warn';
    } else {
      state = 'ok';
    }

    return {
      state,
      warnings,
      score: Math.max(0, score),
    };
  }

  // Get policy summary for UI
  getPolicySummary() {
    return {
      subreddit: this.subreddit,
      rules: {
        maxTitleLength: this.rules.maxTitleLength,
        maxBodyLength: this.rules.maxBodyLength,
        bannedWordsCount: this.rules.bannedWords?.length || 0,
        requiresFlair: this.rules.requiresFlair,
        imageRequired: this.rules.imageRequired,
        allowedDomainsCount: this.rules.allowedDomains?.length || 0,
        blockedDomainsCount: this.rules.blockedDomains?.length || 0,
      },
    };
  }
}

// Utility function to update subreddit rules
export async function updateSubredditRules(subreddit: string, rules: SubredditPolicyRules) {
  await db
    .insert(subredditRules)
    .values({
      subreddit: subreddit.toLowerCase(),
      rulesJson: rules,
    })
    .onConflictDoUpdate({
      target: subredditRules.subreddit,
      set: {
        rulesJson: rules,
        updatedAt: new Date(),
      },
    });
}