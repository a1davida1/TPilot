/**
 * One-Click Post Wizard
 * Orchestrates ImageShield + Caption Generation + Subreddit Recommendation + Reddit Upload
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TwoCaptionPicker, type Caption } from '@/components/two-caption-picker';
import { protectImage, createLowResPreview } from '@/lib/imageshield';
import { uploadAndSubmitToReddit, getRedditCredentials } from '@/lib/reddit-upload';
import {
  trackCaptionShown,
  trackCaptionChoice,
  trackProtectionMetrics,
  trackPostSubmit,
  generatePairId,
  getDeviceBucket
} from '@/lib/caption-telemetry';
import { AlertCircle, CheckCircle, Loader2, Upload } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { OptimalTimeIndicator } from './scheduling/optimal-time-badge';

interface SubredditRecommendation {
  name: string;
  score: number;
  avgUpvotes: number;
  reason: string;
}

type Step = 'upload' | 'protecting' | 'generating' | 'picker' | 'linting' | 'posting' | 'complete' | 'error';

export function OneClickPostWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [protectedBlob, setProtectedBlob] = useState<Blob | null>(null);
  const [captions, setCaptions] = useState<[Caption, Caption] | null>(null);
  const [pairId, setPairId] = useState<string>('');
  const [subredditRecommendations, setSubredditRecommendations] = useState<SubredditRecommendation[]>([]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('');
  const [postUrl, setPostUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [metrics, setMetrics] = useState<{
    ssim: number;
    phashDelta: number;
    processingTime: number;
  } | null>(null);

  // Fetch optimal posting time for selected subreddit
  const { data: optimalTimeData } = useQuery({
    queryKey: ['optimal-time', selectedSubreddit],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(
        `/api/scheduling/analyze-best-times?subreddit=${encodeURIComponent(selectedSubreddit)}&count=1`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedSubreddit && step === 'picker'
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage('');
  };

  const startOneClickPost = async () => {
    if (!selectedFile) return;

    try {
      setStep('protecting');
      setProgress(10);

      // Step 1: Protect image client-side
      const protectionResult = await protectImage(selectedFile, 'medium');
      setProtectedBlob(protectionResult.blob);
      setMetrics({
        ssim: protectionResult.metrics.ssim,
        phashDelta: protectionResult.metrics.phashDelta,
        processingTime: protectionResult.metrics.processingTime
      });

      // Track protection metrics
      trackProtectionMetrics({
        ssim: protectionResult.metrics.ssim,
        phashDelta: protectionResult.metrics.phashDelta,
        preset: 'medium',
        durationMs: protectionResult.metrics.processingTime,
        downscaled: protectionResult.metrics.downscaled
      });

      setProgress(30);
      setStep('generating');

      // Step 2: Generate captions (parallel with protection)
      const preview = await createLowResPreview(selectedFile);
      const captionResponse = await fetch('/api/caption/one-click-captions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ image_base64: preview })
      });

      if (!captionResponse.ok) {
        throw new Error('Failed to generate captions');
      }

      const captionData = await captionResponse.json();
      const captionPair: [Caption, Caption] = [
        captionData.captions[0],
        captionData.captions[1]
      ];
      setCaptions(captionPair);

      // Generate pair ID and track
      const newPairId = generatePairId();
      setPairId(newPairId);
      
      // Fetch AI recommendation for which style to show first
      try {
        const recommendRes = await fetch(
          `/api/caption-analytics/recommend-style?subreddit=${encodeURIComponent(selectedSubreddit || '')}&device=${getDeviceBucket()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );
        
        if (recommendRes.ok) {
          const { recommendation } = await recommendRes.json();
          // Reorder captions to show recommended style first
          if (recommendation.style === 'slutty' && captionPair[0].style === 'flirty') {
            captionPair.reverse();
          }
          // Show confidence badge if high confidence (logged for debugging)
          if (recommendation.confidence > 0.7) {
            // AI recommendation will be used silently
          }
        }
      } catch (_err) {
        // Silently fail - not critical
        // Could not fetch recommendation - continue without it
      }
      
      trackCaptionShown({
        pairId: newPairId,
        captionIds: [captionPair[0].id, captionPair[1].id],
        captionTexts: [captionPair[0].text, captionPair[1].text],
        styles: [captionPair[0].style, captionPair[1].style],
        model: captionData.model || 'unknown',
        category: captionData.category,
        tags: captionData.tags,
        protectionPreset: 'medium',
        deviceBucket: getDeviceBucket()
      });

      setProgress(50);

      // Step 3: Get subreddit recommendations
      const recommendResponse = await fetch('/api/subreddit-recommender', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          category: captionData.category,
          tags: captionData.tags,
          nsfw: true
        })
      });

      if (recommendResponse.ok) {
        const recommendData = await recommendResponse.json();
        setSubredditRecommendations(recommendData.recommendations || []);
        if (recommendData.recommendations?.length > 0) {
          setSelectedSubreddit(recommendData.recommendations[0].name);
        }
      }

      setProgress(70);
      setStep('picker');

    } catch (error) {
      console.error('One-click post error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      setStep('error');
    }
  };

  const handleCaptionSelect = async (
    caption: Caption,
    metadata: { timeToChoice: number; autoSelected: boolean; edited: boolean }
  ) => {
    if (!protectedBlob || !selectedSubreddit) return;

    try {
      setStep('linting');
      setProgress(75);

      // Track caption choice
      trackCaptionChoice({
        pairId,
        chosenCaptionId: caption.id,
        timeToChoiceMs: metadata.timeToChoice,
        edited: metadata.edited,
        autoSelected: metadata.autoSelected
      });

      // Step 4: Lint against subreddit rules
      const lintResponse = await fetch('/api/subreddit-lint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          subreddit: selectedSubreddit,
          title: caption.text,
          nsfw: true
        })
      });

      if (lintResponse.ok) {
        const lintData = await lintResponse.json();
        if (!lintData.ok && lintData.warnings?.length > 0) {
          // Show warnings but allow user to proceed
          console.warn('Subreddit rule warnings:', lintData.warnings);
        }
      }

      setProgress(80);
      setStep('posting');

      // Step 5: Upload to Reddit
      const credentials = await getRedditCredentials();
      const uploadStart = Date.now();

      const result = await uploadAndSubmitToReddit(protectedBlob, credentials, {
        subreddit: selectedSubreddit,
        title: caption.text,
        nsfw: true
      });

      const uploadLatency = Date.now() - uploadStart;

      // Track post submission
      trackPostSubmit({
        redditPostId: result.postId || result.url,
        subreddit: selectedSubreddit,
        captionId: caption.id,
        pairId,
        nsfwFlag: true,
        protectionPreset: 'medium',
        metricsSSIM: metrics?.ssim || 0,
        metricsPhashDelta: metrics?.phashDelta || 0,
        uploadLatencyMs: uploadLatency
      });

      setPostUrl(result.url);
      setProgress(100);
      setStep('complete');

    } catch (error) {
      console.error('Post submission error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to post to Reddit');
      setStep('error');
    }
  };

  const handleRegenerateCaption = async () => {
    if (!selectedFile) return;

    try {
      setStep('generating');
      const preview = await createLowResPreview(selectedFile);
      const captionResponse = await fetch('/api/caption/one-click-captions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ image_base64: preview })
      });

      if (captionResponse.ok) {
        const captionData = await captionResponse.json();
        setCaptions([captionData.captions[0], captionData.captions[1]]);
        setStep('picker');
      }
    } catch (error) {
      console.error('Caption regeneration error:', error);
    }
  };

  const reset = () => {
    setStep('upload');
    setProgress(0);
    setSelectedFile(null);
    setPreviewUrl(null);
    setProtectedBlob(null);
    setCaptions(null);
    setSubredditRecommendations([]);
    setSelectedSubreddit('');
    setPostUrl('');
    setErrorMessage('');
    setMetrics(null);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>One-Click Post to Reddit</CardTitle>
        <CardDescription>
          Protected image + AI caption + smart subreddit recommendation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress bar */}
        {step !== 'upload' && step !== 'error' && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              {step === 'protecting' && 'Protecting image...'}
              {step === 'generating' && 'Generating captions...'}
              {step === 'picker' && 'Choose your caption'}
              {step === 'linting' && 'Validating...'}
              {step === 'posting' && 'Posting to Reddit...'}
              {step === 'complete' && 'Complete!'}
            </p>
          </div>
        )}

        {/* Upload step */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-12 w-12 text-muted-foreground" />
                <span className="text-sm font-medium">Click to upload image</span>
                <span className="text-xs text-muted-foreground">PNG, JPG up to 10MB</span>
              </label>
            </div>

            {previewUrl && (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full rounded-lg max-h-96 object-contain"
                />
                <Button onClick={startOneClickPost} className="w-full" size="lg">
                  Start One-Click Post
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Caption picker step */}
        {step === 'picker' && captions && (
          <div className="space-y-4">
            {subredditRecommendations.length > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Recommended subreddit:</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">r/{selectedSubreddit}</span>
                  <span className="text-xs text-muted-foreground">
                    ({subredditRecommendations[0].reason})
                  </span>
                </div>
                {optimalTimeData?.optimalTimes?.[0] && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Best time to post:</span>
                    <OptimalTimeIndicator
                      dayOfWeek={optimalTimeData.optimalTimes[0].dayOfWeek}
                      hourOfDay={optimalTimeData.optimalTimes[0].hourOfDay}
                      avgUpvotes={optimalTimeData.optimalTimes[0].avgUpvotes}
                    />
                  </div>
                )}
              </div>
            )}

            <TwoCaptionPicker
              captions={captions}
              onSelect={handleCaptionSelect}
              onRegenerate={handleRegenerateCaption}
              autoSelectTimeout={6000}
            />
          </div>
        )}

        {/* Complete step */}
        {step === 'complete' && (
          <div className="space-y-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-lg font-semibold">Posted successfully!</h3>
            {metrics && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Image protection: SSIM {metrics.ssim.toFixed(3)}</p>
                <p>Processing time: {(metrics.processingTime / 1000).toFixed(1)}s</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button asChild variant="default">
                <a href={postUrl} target="_blank" rel="noopener noreferrer">
                  View Post
                </a>
              </Button>
              <Button onClick={reset} variant="outline">
                Post Another
              </Button>
            </div>
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Loading states */}
        {(step === 'protecting' || step === 'generating' || step === 'linting' || step === 'posting') && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
