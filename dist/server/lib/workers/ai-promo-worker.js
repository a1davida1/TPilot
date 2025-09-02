import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES } from "../queue/index.js";
import { db } from "../../db.js";
import { contentGenerations, eventLogs } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { AiService } from "../ai-service.js";
import { logger } from "../logger.js";
export class AiPromoWorker {
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        await registerProcessor(QUEUE_NAMES.AI_PROMO, this.processJob.bind(this), { concurrency: 1 } // Process 1 AI job at a time to avoid rate limits
        );
        this.initialized = true;
        logger.info('✅ AI Promo worker initialized with queue abstraction');
    }
    async processJob(jobData, jobId) {
        const { userId, generationId, promptText, imageKey, platforms, styleHints, variants = 1 } = jobData;
        try {
            logger.info(`Processing AI promo job for generation ${generationId}`);
            // Generate promotional content variants
            const results = [];
            for (let i = 0; i < variants; i++) {
                logger.info(`Generating variant ${i + 1}/${variants}`);
                const aiRequest = {
                    userId,
                    platforms,
                    styleHints: styleHints || [],
                    prompt: promptText,
                    imageContext: imageKey ? await this.getImageContext(imageKey) : undefined,
                    variant: i + 1,
                };
                const content = await AiService.generateContent(aiRequest);
                results.push(content);
                // Add delay between variants to avoid rate limits
                if (i < variants - 1) {
                    await this.sleep(2000); // 2 second delay
                }
            }
            // Update generation record with results
            await this.updateGenerationResults(generationId, results);
            // Log success event
            await this.logEvent(userId, 'ai_promo.completed', {
                generationId,
                variantsGenerated: results.length,
                platforms,
            });
            return { success: true, results };
        }
        catch (error) {
            logger.error(`AI promo job for generation ${generationId} failed:`, { error: error.message, stack: error.stack });
            // Update generation status to failed
            await this.updateGenerationStatus(generationId, 'failed', error.message);
            // Log failure event
            await this.logEvent(userId, 'ai_promo.failed', {
                generationId,
                error: error.message,
            });
            throw error;
        }
    }
    async getImageContext(imageKey) {
        try {
            // In a real implementation, this would analyze the image to provide context
            // For now, return basic context
            return {
                hasImage: true,
                imageKey,
                description: 'User uploaded image for promotional content',
            };
        }
        catch (error) {
            logger.error('Failed to get image context:', { error });
            return null;
        }
    }
    async updateGenerationResults(generationId, results) {
        try {
            // Use the first result to update the generation record
            const firstResult = results[0];
            if (firstResult && firstResult.content && firstResult.content.length > 0) {
                const content = firstResult.content[0];
                await db
                    .update(contentGenerations)
                    .set({
                    content: content.body || '',
                    titles: content.titles || [],
                    photoInstructions: {
                        lighting: 'Natural lighting preferred',
                        cameraAngle: 'Eye level angle',
                        composition: 'Center composition',
                        styling: 'Authentic styling',
                        mood: 'Confident and natural',
                        technicalSettings: 'Auto settings'
                    },
                    updatedAt: new Date(),
                })
                    .where(eq(contentGenerations.id, generationId));
            }
        }
        catch (error) {
            logger.error('Failed to update generation results:', { error });
        }
    }
    async updateGenerationStatus(generationId, status, error) {
        try {
            await db
                .update(contentGenerations)
                .set({
                content: error ? `Generation failed: ${error}` : 'Processing...',
                updatedAt: new Date(),
            })
                .where(eq(contentGenerations.id, generationId));
        }
        catch (error) {
            logger.error('Failed to update generation status:', { error });
        }
    }
    async logEvent(userId, type, meta) {
        try {
            await db.insert(eventLogs).values({
                userId,
                type,
                meta,
            });
        }
        catch (error) {
            logger.error('Failed to log AI promo event:', { error });
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async close() {
        this.initialized = false;
    }
}
// Export singleton instance
export const aiPromoWorker = new AiPromoWorker();
// Initialize the AI promo worker
export async function initializeAiPromoWorker() {
    await aiPromoWorker.initialize();
}
