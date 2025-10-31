/**
 * Rule Validator Component (QW-3)
 * 
 * Validates posts against subreddit rules with personalized warnings
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, XCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Violation {
  rule: string;
  severity: 'warning' | 'error';
  message: string;
  field: 'title' | 'content' | 'flair' | 'timing' | 'general';
}

interface ValidationResult {
  isValid: boolean;
  severity: 'pass' | 'warning' | 'error';
  violations: Violation[];
  personalizedWarnings: string[];
  recommendations: string[];
}

interface RuleValidatorProps {
  subreddit: string;
  title: string;
  content?: string;
  flair?: string;
  autoValidate?: boolean;
}

const severityConfig = {
  pass: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-500',
    label: 'Looks Good!',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-500',
    label: 'Review Warnings',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-500',
    label: 'Fix Errors',
  },
};

export function RuleValidator({
  subreddit,
  title,
  content,
  flair,
  autoValidate = false,
}: RuleValidatorProps) {
  const [showResults, setShowResults] = useState(autoValidate);

  const validation = useMutation<ValidationResult>({
    mutationFn: async () => {
      const response = await fetch('/api/analytics/validate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit, title, content, flair }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to validate post');
      }

      return response.json();
    },
    onSuccess: () => {
      setShowResults(true);
    },
  });

  const handleValidate = () => {
    validation.mutate();
  };

  if (!showResults && !autoValidate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rule Validator
          </CardTitle>
          <CardDescription>
            Check your post against subreddit rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleValidate} disabled={validation.isPending} className="w-full">
            {validation.isPending ? 'Validating...' : 'Validate Post'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (validation.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rule Validator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Validating your post...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (validation.error || !validation.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rule Validator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to validate post. Please try again.
            </AlertDescription>
          </Alert>
          <Button onClick={handleValidate} variant="outline" className="w-full mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const result = validation.data;
  const config = severityConfig[result.severity];
  const Icon = config.icon;

  return (
    <Card className={cn('border-l-4', config.borderColor)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Rule Validator
        </CardTitle>
        <CardDescription>r/{subreddit}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className={cn('rounded-lg p-4', config.bgColor)}>
          <div className="flex items-center gap-3">
            <Icon className={cn('h-6 w-6', config.color)} />
            <div>
              <div className={cn('text-lg font-semibold', config.color)}>
                {config.label}
              </div>
              <div className="text-sm text-muted-foreground">
                {result.isValid
                  ? 'Your post meets all requirements'
                  : 'Please address the issues below'}
              </div>
            </div>
          </div>
        </div>

        {/* Violations */}
        {result.violations.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Issues Found:</div>
            {result.violations.map((violation, idx) => (
              <Alert
                key={idx}
                variant={violation.severity === 'error' ? 'destructive' : 'default'}
              >
                {violation.severity === 'error' ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{violation.rule}</div>
                      <div className="text-sm">{violation.message}</div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {violation.field}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Personalized Warnings */}
        {result.personalizedWarnings.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Personalized Warnings:</div>
            {result.personalizedWarnings.map((warning, idx) => (
              <Alert key={idx}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recommendations:</div>
            <ul className="space-y-1">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Re-validate Button */}
        <Button onClick={handleValidate} variant="outline" className="w-full">
          Re-validate
        </Button>
      </CardContent>
    </Card>
  );
}
