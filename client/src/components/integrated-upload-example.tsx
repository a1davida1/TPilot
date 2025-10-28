import React, { useState, useCallback } from 'react';
import { Upload, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiUploadProgress } from '@/components/ui/upload-progress';
import { CaptionProgress } from '@/components/ui/caption-progress';
import { FriendlyError, useErrorHandler } from '@/components/ui/friendly-error';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
  uploadedUrl?: string;
}

export function IntegratedUploadExample() {
  const { toast } = useToast();
  const { error, handleError, clearError } = useErrorHandler();
  
  // Upload state
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Caption generation state
  const [captionStatus, setCaptionStatus] = useState<
    'idle' | 'analyzing' | 'generating' | 'refining' | 'complete' | 'error'
  >('idle');
  const [captionProgress, setCaptionProgress] = useState(0);
  const [generatedCaptions, setGeneratedCaptions] = useState<
    Array<{ text: string; style: string }>
  >([]);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList) => {
    const newUploads: UploadFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploads(prev => [...prev, ...newUploads]);

    // Process each file
    for (const upload of newUploads) {
      await uploadFile(upload);
    }
  }, []);

  // Upload single file with progress
  const uploadFile = async (upload: UploadFile) => {
    const formData = new FormData();
    formData.append('file', upload.file);

    try {
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploads(prev => prev.map(u => 
            u.id === upload.id 
              ? { ...u, progress } 
              : u
          ));
        }
      });

      // Handle completion
      await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              setUploads(prev => prev.map(u => 
                u.id === upload.id 
                  ? { 
                      ...u, 
                      status: 'complete', 
                      progress: 100,
                      uploadedUrl: response.url 
                    } 
                  : u
              ));
              setSelectedImage(response.url);
              resolve(response);
            } catch (_error) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', '/api/upload');
        
        // Add auth headers if needed
        const token = localStorage.getItem('auth_token');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(formData);
      });

    } catch (error) {
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { 
              ...u, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed' 
            } 
          : u
      ));
      handleError(error);
    }
  };

  // Generate captions with progress tracking
  const generateCaptions = async () => {
    if (!selectedImage) {
      toast({
        title: 'No Image Selected',
        description: 'Please upload an image first',
        variant: 'destructive'
      });
      return;
    }

    try {
      clearError();
      setCaptionStatus('analyzing');
      setCaptionProgress(0);
      setGeneratedCaptions([]);

      // Simulate progress stages
      const progressInterval = setInterval(() => {
        setCaptionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      // Stage 1: Analyze image
      setCaptionStatus('analyzing');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Stage 2: Generate captions
      setCaptionStatus('generating');
      setCaptionProgress(40);
      
      const response = await apiRequest(
        'POST',
        '/api/caption/generate',
        {
          imageUrl: selectedImage,
          styles: ['playful', 'seductive', 'mysterious']
        }
      );
      
      // Parse response
      const data = await response.json() as { 
        captions?: Array<{ text: string; style: string }> 
      };

      // Stage 3: Refine results
      setCaptionStatus('refining');
      setCaptionProgress(80);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Complete
      clearInterval(progressInterval);
      setCaptionProgress(100);
      setCaptionStatus('complete');
      
      if (data?.captions) {
        setGeneratedCaptions(data.captions);
        toast({
          title: 'Success!',
          description: `Generated ${data.captions.length} captions`,
        });
      }

    } catch (error) {
      setCaptionStatus('error');
      handleError(error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  };

  // Retry handlers
  const retryUpload = (uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload) {
      setUploads(prev => prev.map(u => 
        u.id === uploadId 
          ? { ...u, status: 'uploading', progress: 0, error: undefined } 
          : u
      ));
      uploadFile(upload);
    }
  };

  const retryCaptionGeneration = () => {
    generateCaptions();
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
          <CardDescription>
            Select one or more images to upload and generate captions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Button */}
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />
            <label htmlFor="file-upload">
              <div className="cursor-pointer space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG, GIF up to 10MB
                </p>
                <Button asChild className="mt-4">
                  <span>Choose Files</span>
                </Button>
              </div>
            </label>
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <MultiUploadProgress
              uploads={uploads.map(u => ({
                ...u,
                onCancel: () => {
                  setUploads(prev => prev.filter(upload => upload.id !== u.id));
                },
                onRetry: () => retryUpload(u.id)
              }))}
            />
          )}

          {/* Error Display */}
          {error && (
            <FriendlyError
              error={error}
              variant="inline"
              onRetry={() => {
                clearError();
                // Retry last failed upload
                const failedUpload = uploads.find(u => u.status === 'error');
                if (failedUpload) {
                  retryUpload(failedUpload.id);
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Caption Generation Section */}
      {selectedImage && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Captions</CardTitle>
            <CardDescription>
              Create engaging captions for your uploaded image
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Image Preview */}
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={selectedImage}
                alt="Selected"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedImage(null)}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Change Image
                </Button>
              </div>
            </div>

            {/* Caption Progress */}
            {captionStatus !== 'idle' && (
              <CaptionProgress
                status={captionStatus}
                progress={captionProgress}
                captions={generatedCaptions}
                onRetry={retryCaptionGeneration}
                onCancel={() => {
                  setCaptionStatus('idle');
                  setCaptionProgress(0);
                }}
                error={captionStatus === 'error' ? error?.message : undefined}
              />
            )}

            {/* Generate Button */}
            {captionStatus === 'idle' && (
              <Button 
                onClick={generateCaptions}
                className="w-full"
                size="lg"
              >
                Generate Captions
              </Button>
            )}

            {/* Generated Captions Display */}
            {captionStatus === 'complete' && generatedCaptions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Generated Captions</h3>
                {generatedCaptions.map((caption, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <p className="text-sm">{caption.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          Style: {caption.style}
                        </span>
                        <Button size="sm" variant="outline">
                          Use This Caption
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
