import { db } from "../db.js";
import { subredditRules } from "@shared/schema.js";
import { eq } from "drizzle-orm";
// Default rules for NSFW content creation (safe and professional)
const DEFAULT_RULES = {
    bannedWords: [
        // Professional content creation focused - avoiding explicit terms
        "underage", "minor", "child", "teen", "young", "school", "student",
        "illegal", "drugs", "violence", "harassment", "revenge",
        // Spam-related terms
        "click here", "free money", "guaranteed", "make money fast"
    ],
    titleRegexes: [
        // Common spam patterns
        "^(FREE|CLICK|URGENT|AMAZING)",
        "!!!+",
        "\\$\\$\\$"
    ],
    bodyRegexes: [
        // Links that look spammy
        "bit\\.ly|tinyurl|short\\.link",
        // All caps content (suggests spam)
        "^[A-Z\\s!?]{20,}"
    ],
    linkPolicy: "one-link", // Most NSFW subreddits allow one promotional link
    requiredTags: [], // Subreddit-specific, so empty by default
    maxTitleLength: 300, // Reddit's limit
    maxBodyLength: 10000, // Reddit's limit
    flairRequired: false // Varies by subreddit
};
export async function lintCaption(input) {
    const { subreddit, title, body, hasLink } = input;
    const warnings = [];
    let state = "ok";
    try {
        // Load subreddit-specific rules
        const [subredditRule] = await db
            .select()
            .from(subredditRules)
            .where(eq(subredditRules.subreddit, subreddit.toLowerCase()));
        const rules = subredditRule?.rulesJson || DEFAULT_RULES;
        // Check banned words (blocking violation)
        if (rules.bannedWords?.length) {
            const bannedFound = rules.bannedWords.filter(word => title.toLowerCase().includes(word.toLowerCase()) ||
                body.toLowerCase().includes(word.toLowerCase()));
            if (bannedFound.length > 0) {
                warnings.push(`Contains banned terms: ${bannedFound.join(", ")}`);
                state = "block";
            }
        }
        // Check title regexes (blocking violation)
        if (rules.titleRegexes?.length) {
            for (const regexStr of rules.titleRegexes) {
                try {
                    const regex = new RegExp(regexStr, "i");
                    if (regex.test(title)) {
                        warnings.push(`Title violates pattern rules`);
                        state = "block";
                        break;
                    }
                }
                catch (e) {
                    console.warn(`Invalid regex in subreddit rules: ${regexStr}`);
                }
            }
        }
        // Check body regexes (blocking violation)
        if (rules.bodyRegexes?.length) {
            for (const regexStr of rules.bodyRegexes) {
                try {
                    const regex = new RegExp(regexStr, "i");
                    if (regex.test(body)) {
                        warnings.push(`Content violates formatting rules`);
                        state = "block";
                        break;
                    }
                }
                catch (e) {
                    console.warn(`Invalid regex in subreddit rules: ${regexStr}`);
                }
            }
        }
        // Check link policy (blocking violation)
        if (rules.linkPolicy && hasLink) {
            if (rules.linkPolicy === "no-link") {
                warnings.push("This subreddit doesn't allow promotional links");
                state = "block";
            }
            // For "one-link", we assume the client only sends hasLink=true for one link
            // More sophisticated link counting would happen in a real implementation
        }
        // Check required tags (warning)
        if (rules.requiredTags?.length) {
            const hasRequiredTag = rules.requiredTags.some(tag => title.includes(tag) || body.includes(tag));
            if (!hasRequiredTag) {
                warnings.push(`Missing required tags: ${rules.requiredTags.join(", ")}`);
                if (state !== "block")
                    state = "warn";
            }
        }
        // Check length limits (warning)
        if (rules.maxTitleLength && title.length > rules.maxTitleLength) {
            warnings.push(`Title too long (${title.length}/${rules.maxTitleLength} chars)`);
            if (state !== "block")
                state = "warn";
        }
        if (rules.maxBodyLength && body.length > rules.maxBodyLength) {
            warnings.push(`Body too long (${body.length}/${rules.maxBodyLength} chars)`);
            if (state !== "block")
                state = "warn";
        }
        // Check flair requirement (warning)
        if (rules.flairRequired) {
            // Basic flair detection - look for common patterns
            const hasFlairPattern = /\[[^\]]+\]/.test(title) || /\([^)]+\)/.test(title);
            if (!hasFlairPattern) {
                warnings.push("This subreddit may require post flair or tags");
                if (state !== "block")
                    state = "warn";
            }
        }
        // Additional content quality checks (warnings)
        if (title.length < 10) {
            warnings.push("Title might be too short for engagement");
            if (state !== "block")
                state = "warn";
        }
        if (body.length > 0 && body.length < 20) {
            warnings.push("Body content might be too brief");
            if (state !== "block")
                state = "warn";
        }
        // Check for common engagement killers (warnings)
        if (title.includes("upvote") || body.includes("upvote")) {
            warnings.push("Asking for upvotes may hurt engagement");
            if (state !== "block")
                state = "warn";
        }
        return { state, warnings };
    }
    catch (error) {
        console.error("Policy linter error:", error);
        // Fail safe - if linter crashes, allow with warning
        return {
            state: "warn",
            warnings: ["Content review system temporarily unavailable"]
        };
    }
}
// Get feature flag value for policy strictness
export async function shouldBlockOnWarn() {
    try {
        // Check if we have feature flags table and get the setting
        // For now, default to false (warnings don't block)
        return false;
    }
    catch (error) {
        return false; // Fail safe
    }
}
