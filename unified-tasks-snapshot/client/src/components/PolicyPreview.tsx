import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Shield, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, type ApiError } from '@/lib/queryClient';

interface PolicyResult {
  state: 'ok' | 'warn' | 'block';
  warnings: string[];
}

interface PreviewStats {
  okCount14d: number;
  totalPreviews14d: number;
  canQueue: boolean;
  required: number;
}

interface PolicyPreviewProps {
  subreddit: string;
  title: string;
  body: string;
  hasLink?: boolean;
  onPreviewComplete?: (result: PolicyResult) => void;
}

export function PolicyPreview({ subreddit, title, body, hasLink = false, onPreviewComplete }: PolicyPreviewProps) {
  const queryClient = useQueryClient();
  const [lastPreviewResult, setLastPreviewResult] = useState<PolicyResult | null>(null);
  const { toast } = useToast();

  // Get user's preview gate stats
  const { data: previewStats, isLoading: statsLoading } = useQuery<PreviewStats>({
    queryKey: ['/api/user/previewStats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get policy feature flags
  const { data: policyFlags } = useQuery<{ blockOnWarn: boolean }>({
    queryKey: ['/api/policy/flags'],
  });

  // Preview content mutation
  const isApiError = (error: unknown): error is ApiError => {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return 'status' in error && 'statusText' in error;
  };

  const previewMutation = useMutation({
    mutationFn: async (previewData: { subreddit: string; title: string; body: string; hasLink: boolean }) => {
      const response = await apiRequest('POST', '/api/preview', previewData);
      const resultData = await response.json() as { policyState: 'ok' | 'warn' | 'block'; warnings?: string[] };
      return {
        policyState: resultData.policyState,
        warnings: Array.isArray(resultData.warnings) ? resultData.warnings : [],
      };
    },
    onSuccess: (result) => {
      const policyResult: PolicyResult = {
        state: result.policyState,
        warnings: result.warnings,
      };
      setLastPreviewResult(policyResult);
      onPreviewComplete?.(policyResult);

      // Refresh preview stats
      queryClient.invalidateQueries({ queryKey: ['/api/user/previewStats'] });
    },
    onError: (error: unknown) => {
      console.error('Preview error:', error);
      let toastTitle = 'Preview failed';
      let description = 'Content review temporarily unavailable';

      if (isApiError(error)) {
        if (error.isAuthError) {
          toastTitle = 'Please log in';
        }
        description = error.userMessage ?? error.message;
      } else if (error instanceof Error) {
        description = error.message;
      }

      toast({
        title: toastTitle,
        description,
        variant: 'destructive',
      });

      setLastPreviewResult({
        state: 'warn',
        warnings: [description]
      });
    }
  });

  const handlePreview = () => {
    previewMutation.mutate({
      subreddit,
      title,
      body,
      hasLink
    });
  };

  const getStateIcon = (state: 'ok' | 'warn' | 'block') => {
    switch (state) {
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'block':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStateBadgeVariant = (state: 'ok' | 'warn' | 'block') => {
    switch (state) {
      case 'ok':
        return 'default'; // Green
      case 'warn':
        return 'secondary'; // Yellow
      case 'block':
        return 'destructive'; // Red
    }
  };

  const canQueuePost = () => {
    if (!previewStats || !lastPreviewResult) return false;
    
    // Must meet preview gate requirements
    if (!previewStats.canQueue) return false;
    
    // Must not be blocked
    if (lastPreviewResult.state === 'block') return false;
    
    // If blockOnWarn is enabled, warnings also block
    if (policyFlags?.blockOnWarn && lastPreviewResult.state === 'warn') return false;
    
    return true;
  };

  const progressPercentage = previewStats 
    ? Math.min(100, (previewStats.okCount14d / previewStats.required) * 100)
    : 0;

  return (
    <Card className="w-full" data-testid="policy-preview-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          <CardTitle>Content Policy Check</CardTitle>
        </div>
        <CardDescription>
          Review your content against subreddit rules and platform guidelines
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Preview Gate Status */}
        {!statsLoading && previewStats && (
          <div className="space-y-2" data-testid="preview-gate-status">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Preview Gate Status
              </span>
              <span className="text-muted-foreground">
                {previewStats.okCount14d}/{previewStats.required} required
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground">
              {previewStats.canQueue 
                ? "✅ Gate requirement met - you can queue posts"
                : `Need ${previewStats.required - previewStats.okCount14d} more clean previews in the last 14 days`
              }
            </p>
          </div>
        )}

        {/* Preview Button */}
        <Button
          onClick={handlePreview}
          disabled={previewMutation.isPending || !title.trim() || !subreddit.trim()}
          className="w-full"
          variant="outline"
          data-testid="button-preview-content"
        >
          {previewMutation.isPending ? 'Checking Content...' : 'Preview Content'}
        </Button>

        {/* Preview Results */}
        {lastPreviewResult && (
          <div className="space-y-3" data-testid="preview-results">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {getStateIcon(lastPreviewResult.state)}
              <Badge variant={getStateBadgeVariant(lastPreviewResult.state)}>
                {lastPreviewResult.state.toUpperCase()}
              </Badge>
            </div>

            {/* Warnings */}
            {lastPreviewResult.warnings.length > 0 && (
              <div className="space-y-2">
                {lastPreviewResult.warnings.map((warning, index) => (
                  <Alert key={index} variant={lastPreviewResult.state === 'block' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Success Message */}
            {lastPreviewResult.state === 'ok' && lastPreviewResult.warnings.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Content looks great! No policy issues detected.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Queue Status */}
        {lastPreviewResult && previewStats && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Can Queue Post:</span>
              <Badge variant={canQueuePost() ? 'default' : 'secondary'}>
                {canQueuePost() ? 'Yes' : 'No'}
              </Badge>
            </div>
            {!canQueuePost() && (
              <p className="text-xs text-muted-foreground mt-1">
                {!previewStats.canQueue && "Preview gate requirement not met"}
                {previewStats.canQueue && lastPreviewResult.state === 'block' && "Content blocked by policy"}
                {previewStats.canQueue && lastPreviewResult.state === 'warn' && policyFlags?.blockOnWarn && "Warnings block posting (strict mode)"}
              </p>
            )}
          </div>
        )}

        {/* Policy Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Content is checked against r/{subreddit} rules</p>
          <p>• Preview results count toward your posting gate</p>
          <p>• "OK" previews help you unlock posting privileges</p>
        </div>
      </CardContent>
    </Card>
  );
}