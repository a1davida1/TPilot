import { db } from "./db.js";
import { subredditRules, featureFlags } from "@shared/schema.js";
export async function seedPolicyData() {
    console.log("🌱 Seeding policy data...");
    try {
        // Sample subreddit rules with professional content creation constraints
        const sampleRules = [
            {
                subreddit: "gonewild",
                rules: {
                    bannedWords: ["underage", "minor", "young", "teen", "school", "illegal", "drugs", "violence"],
                    titleRegexes: ["^(CLICK|FREE|URGENT)", "!!!+"],
                    requiredTags: ["[F]", "[M]", "[MF]", "[FM]"],
                    linkPolicy: "one-link",
                    maxTitleLength: 300,
                    maxBodyLength: 1000,
                    flairRequired: false
                }
            },
            {
                subreddit: "realgirls",
                rules: {
                    bannedWords: ["underage", "minor", "young", "teen", "school", "selling", "buy", "onlyfans"],
                    titleRegexes: ["\\$\\$\\$", "bit\\.ly|tinyurl"],
                    linkPolicy: "no-link", // Strict no promotional links
                    maxTitleLength: 200,
                    maxBodyLength: 500,
                    flairRequired: true
                }
            },
            {
                subreddit: "selfie",
                rules: {
                    bannedWords: ["underage", "minor", "young", "teen", "school"],
                    titleRegexes: ["^[A-Z\\s!?]{20,}"], // No all-caps spam
                    linkPolicy: "one-link",
                    maxTitleLength: 150,
                    maxBodyLength: 800,
                    flairRequired: false
                }
            },
            {
                subreddit: "amihot",
                rules: {
                    bannedWords: ["underage", "minor", "young", "teen", "school"],
                    requiredTags: ["[F]", "[M]", "[NB]"],
                    linkPolicy: "no-link",
                    maxTitleLength: 100,
                    maxBodyLength: 300,
                    flairRequired: false
                }
            }
        ];
        // Insert subreddit rules
        for (const { subreddit, rules } of sampleRules) {
            await db
                .insert(subredditRules)
                .values({
                subreddit,
                rulesJson: rules
            })
                .onConflictDoUpdate({
                target: subredditRules.subreddit,
                set: {
                    rulesJson: rules,
                    updatedAt: new Date()
                }
            });
            console.log(`✅ Added rules for r/${subreddit}`);
        }
        // Insert policy feature flags
        await db
            .insert(featureFlags)
            .values({
            key: "policy.blockOnWarn",
            enabled: false, // Default: warnings don't block posting
            meta: {
                description: "Block posting when content has policy warnings",
                category: "policy"
            }
        })
            .onConflictDoUpdate({
            target: featureFlags.key,
            set: {
                enabled: false,
                meta: {
                    description: "Block posting when content has policy warnings",
                    category: "policy"
                },
                updatedAt: new Date()
            }
        });
        console.log("✅ Added policy feature flags");
        // Add general content quality feature flags
        await db
            .insert(featureFlags)
            .values({
            key: "policy.enableAdvancedLinting",
            enabled: true,
            meta: {
                description: "Enable advanced content quality checking",
                category: "policy"
            }
        })
            .onConflictDoUpdate({
            target: featureFlags.key,
            set: {
                enabled: true,
                meta: {
                    description: "Enable advanced content quality checking",
                    category: "policy"
                },
                updatedAt: new Date()
            }
        });
        console.log("✅ Policy data seeding complete!");
    }
    catch (error) {
        console.error("❌ Error seeding policy data:", error);
        throw error;
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedPolicyData().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
