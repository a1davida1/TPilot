import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type AiPromoJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { contentGenerations, eventLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AiService } from "../ai-service.js";
import { logger } from "../logger.js";

export class AiPromoWorker {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    await registerProcessor<AiPromoJobData>(
      QUEUE_NAMES.AI_PROMO,
      this.processJob.bind(this),
      { concurrency: 1 } // Process 1 AI job at a time to avoid rate limits
    );
    
    this.initialized = true;
    logger.info('✅ AI Promo worker initialized with queue abstraction');
  }

  private async processJob(jobData: unknown, jobId: string): Promise<void> {
    // Validate job data structure
    if (!jobData || typeof jobData !== 'object') {
      throw new Error('Invalid job data: expected object');
    }
    const { userId, generationId, promptText, imageKey, platforms, styleHints, variants = 1 } = jobData as AiPromoJobData;

    try {
      logger.info(`Processing AI promo job for generation ${generationId}`);

      // Generate promotional content variants
      interface ContentResult {
        success: boolean;
        content?: string;
        error?: string;
        variant: number;
      }
      const results: ContentResult[] = [];
      
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
        const contentResult: ContentResult = {
          success: !!content && Array.isArray(content) && content.length > 0,
          content: Array.isArray(content) ? JSON.stringify(content) : 'No content generated',
          error: !content ? 'Generation failed' : undefined,
          variant: i + 1
        };
        results.push(contentResult);

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

      logger.info(`AI promo job completed successfully`, { generationId, results });

    } catch (error: unknown) {
      logger.error(`AI promo job for generation ${generationId} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Update generation status to failed
      await this.updateGenerationStatus(
        generationId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Log failure event
      await this.logEvent(userId, 'ai_promo.failed', {
        generationId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private async getImageContext(imageKey: string) {
    try {
      // In a real implementation, this would analyze the image to provide context
      // For now, return basic context
      return {
        hasImage: true,
        imageKey,
        description: 'User uploaded image for promotional content',
      };
    } catch (_error) {
      logger.error('Failed to get image context:', { error });
      return null;
    }
  }

  private async updateGenerationResults(generationId: number, results: { content?: string | { body?: string; titles?: string[] }[] }[]) {
    try {
      // Use the first result to update the generation record
      const firstResult = results[0];
      if (firstResult?.content && firstResult.content.length > 0) {
        // Type guard to ensure content is an array before indexing
        if (Array.isArray(firstResult.content)) {
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
            })
            .where(eq(contentGenerations.id, generationId));
        } else {
          // Handle case where content is a string
          await db
            .update(contentGenerations)
            .set({
              content: firstResult.content,
              titles: [],
              photoInstructions: {
                lighting: 'Natural lighting preferred',
                cameraAngle: 'Eye level angle',
                composition: 'Center composition',
                styling: 'Authentic styling',
                mood: 'Confident and natural',
                technicalSettings: 'Auto settings'
              },
            })
            .where(eq(contentGenerations.id, generationId));
        }
      }

    } catch (_error) {
      logger.error('Failed to update generation results:', { error });
    }
  }

  private async updateGenerationStatus(generationId: number, status: string, error?: string) {
    try {
      await db
        .update(contentGenerations)
        .set({
          content: error ? `Generation failed: ${error}` : 'Processing...',
        })
        .where(eq(contentGenerations.id, generationId));

    } catch (_error) {
      logger.error('Failed to update generation status:', { error });
    }
  }

  private async logEvent(userId: number, type: string, meta: Record<string, unknown>) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (_error) {
      logger.error('Failed to log AI promo event:', { error });
    }
  }

  private sleep(ms: number): Promise<void> {
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