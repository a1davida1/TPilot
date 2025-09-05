interface ContentFeatures {
  titleLength: number;
  hasEmojis: boolean;
  hasQuestion: boolean;
  postTime: number; // Hour of day
  dayOfWeek: number;
  contentLength: number;
  imageCount: number;
  hashtagCount: number;
  platform: string;
  contentType: 'sfw' | 'nsfw' | 'mixed';
  hasCTA: boolean; // Call to action
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface PredictionResult {
  estimatedEngagement: number; // 0-100 score
  confidence: number; // 0-1 confidence level
  recommendations: string[];
  riskFactors: string[];
}

class ContentPerformancePredictor {
  // Feature weights based on historical analysis
  private featureWeights = {
    titleLength: {
      optimal: { min: 40, max: 80 },
      weight: 0.15
    },
    hasEmojis: {
      value: true,
      weight: 0.10
    },
    hasQuestion: {
      value: true,
      weight: 0.12
    },
    postTime: {
      optimal: [19, 20, 21, 22], // Evening hours
      weight: 0.15
    },
    dayOfWeek: {
      optimal: [4, 5, 6], // Thu, Fri, Sat
      weight: 0.08
    },
    contentLength: {
      optimal: { min: 100, max: 500 },
      weight: 0.10
    },
    imageCount: {
      optimal: { min: 1, max: 5 },
      weight: 0.20
    },
    hashtagCount: {
      optimal: { min: 3, max: 7 },
      weight: 0.05
    },
    hasCTA: {
      value: true,
      weight: 0.05
    }
  };

  // Platform-specific adjustments
  private platformMultipliers: Record<string, Partial<Record<keyof ContentFeatures, number>>> = {
    reddit: {
      titleLength: 1.2,
      hasQuestion: 1.3,
      imageCount: 0.8
    },
    twitter: {
      titleLength: 0.8,
      hasEmojis: 1.2,
      hashtagCount: 1.3
    },
    instagram: {
      imageCount: 1.5,
      hashtagCount: 1.2,
      hasEmojis: 1.1
    },
    onlyfans: {
      imageCount: 1.4,
      hasCTA: 1.5,
      contentLength: 0.7
    },
    tiktok: {
      titleLength: 0.6,
      hasEmojis: 1.3,
      hashtagCount: 1.4
    }
  };

  async predictEngagement(content: Partial<ContentFeatures>): Promise<PredictionResult> {
    // Extract features
    const features = this.extractFeatures(content);
    
    // Calculate base score
    let score = this.calculateBaseScore(features);
    
    // Apply platform-specific adjustments
    score = this.applyPlatformAdjustments(score, features);
    
    // Apply content type adjustments
    score = this.applyContentTypeAdjustments(score, features);
    
    // Calculate confidence based on feature completeness
    const confidence = this.calculateConfidence(features);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(features, score);
    
    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(features);
    
    return {
      estimatedEngagement: Math.min(100, Math.max(0, Math.round(score))),
      confidence,
      recommendations,
      riskFactors
    };
  }

  private extractFeatures(content: Partial<ContentFeatures>): ContentFeatures {
    return {
      titleLength: content.titleLength || 0,
      hasEmojis: content.hasEmojis || false,
      hasQuestion: content.hasQuestion || false,
      postTime: content.postTime || new Date().getHours(),
      dayOfWeek: content.dayOfWeek || new Date().getDay(),
      contentLength: content.contentLength || 0,
      imageCount: content.imageCount || 0,
      hashtagCount: content.hashtagCount || 0,
      platform: content.platform || 'reddit',
      contentType: content.contentType || 'sfw',
      hasCTA: content.hasCTA || false,
      sentiment: content.sentiment || 'neutral'
    };
  }

  private calculateBaseScore(features: ContentFeatures): number {
    let score = 50; // Base score
    
    // Title length score
    const titleOpt = this.featureWeights.titleLength.optimal;
    if (features.titleLength >= titleOpt.min && features.titleLength <= titleOpt.max) {
      score += 10 * this.featureWeights.titleLength.weight;
    } else if (features.titleLength > 0) {
      score += 5 * this.featureWeights.titleLength.weight;
    }
    
    // Emoji score
    if (features.hasEmojis === this.featureWeights.hasEmojis.value) {
      score += 15 * this.featureWeights.hasEmojis.weight;
    }
    
    // Question score
    if (features.hasQuestion === this.featureWeights.hasQuestion.value) {
      score += 20 * this.featureWeights.hasQuestion.weight;
    }
    
    // Post time score
    if (this.featureWeights.postTime.optimal.includes(features.postTime)) {
      score += 15 * this.featureWeights.postTime.weight;
    } else if (features.postTime >= 17 && features.postTime <= 23) {
      score += 10 * this.featureWeights.postTime.weight;
    }
    
    // Day of week score
    if (this.featureWeights.dayOfWeek.optimal.includes(features.dayOfWeek)) {
      score += 10 * this.featureWeights.dayOfWeek.weight;
    }
    
    // Content length score
    const contentOpt = this.featureWeights.contentLength.optimal;
    if (features.contentLength >= contentOpt.min && features.contentLength <= contentOpt.max) {
      score += 10 * this.featureWeights.contentLength.weight;
    }
    
    // Image count score
    const imageOpt = this.featureWeights.imageCount.optimal;
    if (features.imageCount >= imageOpt.min && features.imageCount <= imageOpt.max) {
      score += 25 * this.featureWeights.imageCount.weight;
    } else if (features.imageCount > 0) {
      score += 15 * this.featureWeights.imageCount.weight;
    }
    
    // Hashtag count score
    const hashtagOpt = this.featureWeights.hashtagCount.optimal;
    if (features.hashtagCount >= hashtagOpt.min && features.hashtagCount <= hashtagOpt.max) {
      score += 10 * this.featureWeights.hashtagCount.weight;
    }
    
    // CTA score
    if (features.hasCTA === this.featureWeights.hasCTA.value) {
      score += 10 * this.featureWeights.hasCTA.weight;
    }
    
    // Sentiment bonus
    if (features.sentiment === 'positive') {
      score += 5;
    } else if (features.sentiment === 'negative') {
      score -= 5;
    }
    
    return score;
  }

  private applyPlatformAdjustments(score: number, features: ContentFeatures): number {
    const multipliers = this.platformMultipliers[features.platform as keyof typeof this.platformMultipliers];

    if (!multipliers) return score;

    let adjustment = 1.0;

    // Apply platform-specific multipliers
    if (features.titleLength > 0 && multipliers.titleLength !== undefined) {
      adjustment *= multipliers.titleLength;
    }

    if (features.hasEmojis && multipliers.hasEmojis !== undefined) {
      adjustment *= multipliers.hasEmojis;
    }

    if (features.hasQuestion && multipliers.hasQuestion !== undefined) {
      adjustment *= multipliers.hasQuestion;
    }

    if (features.imageCount > 0 && multipliers.imageCount !== undefined) {
      adjustment *= multipliers.imageCount;
    }

    if (features.hashtagCount > 0 && multipliers.hashtagCount !== undefined) {
      adjustment *= multipliers.hashtagCount;
    }

    if (features.hasCTA && multipliers.hasCTA !== undefined) {
      adjustment *= multipliers.hasCTA;
    }

    return score * adjustment;
  }

  private applyContentTypeAdjustments(score: number, features: ContentFeatures): number {
    // NSFW content typically has different engagement patterns
    if (features.contentType === 'nsfw') {
      // NSFW performs better with images
      if (features.imageCount === 0) {
        score *= 0.7; // 30% penalty for no images
      } else if (features.imageCount > 2) {
        score *= 1.2; // 20% bonus for multiple images
      }
      
      // NSFW performs better on certain platforms
      if (['onlyfans', 'reddit'].includes(features.platform)) {
        score *= 1.1;
      }
      
      // NSFW performs better during evening/night
      if (features.postTime >= 20 || features.postTime <= 2) {
        score *= 1.15;
      }
    }
    
    return score;
  }

  private calculateConfidence(features: ContentFeatures): number {
    let completeness = 0;
    let totalFields = 0;
    
    // Check feature completeness
    if (features.titleLength > 0) completeness++;
    totalFields++;
    
    if (features.contentLength > 0) completeness++;
    totalFields++;
    
    if (features.imageCount !== undefined) completeness++;
    totalFields++;
    
    if (features.hashtagCount !== undefined) completeness++;
    totalFields++;
    
    if (features.platform) completeness++;
    totalFields++;
    
    return completeness / totalFields;
  }

  private generateRecommendations(features: ContentFeatures, score: number): string[] {
    const recommendations: string[] = [];
    
    // Title recommendations
    const titleOpt = this.featureWeights.titleLength.optimal;
    if (features.titleLength < titleOpt.min) {
      recommendations.push(`Make your title longer (aim for ${titleOpt.min}-${titleOpt.max} characters)`);
    } else if (features.titleLength > titleOpt.max) {
      recommendations.push(`Shorten your title (aim for ${titleOpt.min}-${titleOpt.max} characters)`);
    }
    
    // Emoji recommendation
    if (!features.hasEmojis && ['instagram', 'tiktok', 'twitter'].includes(features.platform)) {
      recommendations.push('Add emojis to make your post more engaging');
    }
    
    // Question recommendation
    if (!features.hasQuestion && features.platform === 'reddit') {
      recommendations.push('Consider asking a question to boost engagement');
    }
    
    // Image recommendations
    if (features.imageCount === 0 && ['instagram', 'onlyfans'].includes(features.platform)) {
      recommendations.push('Add images - visual content performs much better');
    } else if (features.imageCount > 5) {
      recommendations.push('Consider reducing the number of images (3-5 is optimal)');
    }
    
    // Hashtag recommendations
    const hashtagOpt = this.featureWeights.hashtagCount.optimal;
    if (features.hashtagCount < hashtagOpt.min && ['instagram', 'twitter', 'tiktok'].includes(features.platform)) {
      recommendations.push(`Add more hashtags (${hashtagOpt.min}-${hashtagOpt.max} recommended)`);
    } else if (features.hashtagCount > hashtagOpt.max) {
      recommendations.push(`Reduce hashtags to ${hashtagOpt.max} or fewer`);
    }
    
    // CTA recommendation
    if (!features.hasCTA && features.platform === 'onlyfans') {
      recommendations.push('Add a clear call-to-action to drive conversions');
    }
    
    // Time recommendations
    if (!this.featureWeights.postTime.optimal.includes(features.postTime)) {
      recommendations.push('Consider posting during peak hours (7-9 PM)');
    }
    
    // Platform-specific recommendations
    if (features.platform === 'reddit' && features.contentLength < 100) {
      recommendations.push('Add more context to your post for Reddit audiences');
    }
    
    if (features.platform === 'twitter' && features.contentLength > 280) {
      recommendations.push('Consider creating a thread for longer content');
    }
    
    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  private identifyRiskFactors(features: ContentFeatures): string[] {
    const risks: string[] = [];
    
    // Content length risks
    if (features.contentLength === 0) {
      risks.push('No content body may result in low engagement');
    }
    
    if (features.contentLength > 1000 && features.platform === 'twitter') {
      risks.push('Content too long for platform');
    }
    
    // Image risks
    if (features.imageCount === 0 && features.contentType === 'nsfw') {
      risks.push('NSFW content without images typically underperforms');
    }
    
    // Timing risks
    if (features.postTime >= 2 && features.postTime <= 5) {
      risks.push('Posting during low-activity hours (2-5 AM)');
    }
    
    // Platform-content mismatch
    if (features.contentType === 'nsfw' && ['twitter', 'instagram'].includes(features.platform)) {
      risks.push('Platform may restrict NSFW content visibility');
    }
    
    // Oversaturation risks
    if (features.hashtagCount > 15) {
      risks.push('Too many hashtags may appear spammy');
    }
    
    // Day of week risks
    if ([0, 1].includes(features.dayOfWeek) && features.platform === 'reddit') {
      risks.push('Sunday/Monday typically have lower engagement on Reddit');
    }
    
    return risks;
  }

  // Batch prediction for multiple content pieces
  async predictBatch(contents: Partial<ContentFeatures>[]): Promise<PredictionResult[]> {
    return Promise.all(contents.map(content => this.predictEngagement(content)));
  }

  // Learning from actual performance (for future ML implementation)
  async updateModel(actualPerformance: { features: ContentFeatures; engagement: number }[]): Promise<void> {
    // In production, this would update ML model weights
    // For now, log for analysis
  }
}

// Create singleton instance
export const contentPerformancePredictor = new ContentPerformancePredictor();