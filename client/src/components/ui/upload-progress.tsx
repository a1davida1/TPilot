import React, { useState, useEffect } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileImage } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface UploadProgressProps {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function UploadProgress({
  file,
  progress,
  status,
  error,
  onCancel,
  onRetry,
  className
}: UploadProgressProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [file]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Upload className="h-5 w-5 animate-pulse text-primary" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <FileImage className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return `Uploading... ${progress}%`;
      case 'processing':
        return 'Processing image...';
      case 'complete':
        return 'Upload complete!';
      case 'error':
        return error || 'Upload failed';
      default:
        return 'Ready to upload';
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image Preview */}
          {imagePreview && (
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-md overflow-hidden bg-muted">
                <img 
                  src={imagePreview} 
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Upload Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {getStatusIcon()}
            </div>

            {/* Progress Bar */}
            {(status === 'uploading' || status === 'processing') && (
              <div className="space-y-2">
                <Progress 
                  value={progress} 
                  className="h-2"
                  aria-label={`Upload progress: ${progress}%`}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {getStatusMessage()}
                  </span>
                  {onCancel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCancel}
                      className="h-6 px-2 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Success State */}
            {status === 'complete' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600">
                  {getStatusMessage()}
                </span>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="space-y-2">
                <span className="text-sm text-destructive">
                  {getStatusMessage()}
                </span>
                {onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRetry}
                    className="h-7"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Multiple file upload progress
export function MultiUploadProgress({ 
  uploads 
}: { 
  uploads: Array<UploadProgressProps & { id: string }> 
}) {
  const completed = uploads.filter(u => u.status === 'complete').length;
  const total = uploads.length;
  const hasErrors = uploads.some(u => u.status === 'error');

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Uploading {total} {total === 1 ? 'file' : 'files'}
          </h3>
          <span className="text-xs text-muted-foreground">
            {completed} of {total} complete
          </span>
        </div>
        {hasErrors && (
          <p className="text-xs text-destructive">
            Some uploads failed. Please retry.
          </p>
        )}
      </div>

      {/* Individual Uploads */}
      <div className="space-y-2">
        {uploads.map((upload) => (
          <UploadProgress key={upload.id} {...upload} />
        ))}
      </div>
    </div>
  );
}
