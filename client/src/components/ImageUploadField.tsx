/**
 * Unified Image Upload Field Component
 * Provides consistent upload experience across all pages
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Loader2, CheckCircle } from 'lucide-react';
import { RedditNativeUploadPortal } from './RedditNativeUploadPortal';
import { ImgurUploadPortal } from './ImgurUploadPortal';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showPreview?: boolean;
  preferredService?: 'native' | 'imgur';
}

export function ImageUploadField({
  value,
  onChange,
  label = 'Image',
  placeholder = 'https://example.com/image.jpg',
  required = false,
  showPreview = true,
  preferredService = 'native'
}: ImageUploadFieldProps) {
  const [uploadMode, setUploadMode] = useState<'url' | 'upload'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUploadComplete = (url: string) => {
    onChange(url);
    setIsUploading(false);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="image">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'url' | 'upload')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-4">
          <Input
            id="image"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={isUploading}
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <div className="space-y-4">
            {preferredService === 'native' ? (
              <RedditNativeUploadPortal
                onComplete={(result) => {
                  handleUploadComplete(result.imageUrl);
                }}
                showPreview={false}
              />
            ) : (
              <ImgurUploadPortal
                onComplete={(result) => {
                  handleUploadComplete(result.imageUrl);
                }}
                showPreview={false}
              />
            )}
            
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            )}

            {uploadSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Upload complete!
              </div>
            )}

            {value && (
              <div className="p-2 bg-muted rounded text-sm break-all">
                {value}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {showPreview && value && (
        <div className="mt-4">
          <Label className="text-sm text-muted-foreground">Preview</Label>
          <div className="mt-2 relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border">
            <img 
              src={value} 
              alt="Preview" 
              className="object-contain w-full h-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
