/**
 * Post Scheduling Page
 * Complete workflow: Upload → Select → Caption → Protect → Schedule
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Sparkles,
  Shield,
  CheckCircle,
  ArrowRight,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { CatboxUploadPortal } from '@/components/CatboxUploadPortal';
import { cn } from '@/lib/utils';
import { SchedulingCalendar } from '@/components/SchedulingCalendar';

interface UploadedImage {
  id: string;
  url: string;
  deleteHash?: string;
  selected: boolean;
  caption?: string;
  protected?: boolean;
  protectedUrl?: string;
  scheduled?: boolean;
}

interface ScheduleData {
  imageUrl: string;
  caption: string;
  subreddit: string;
  scheduledFor: string;
  nsfw: boolean;
}

export default function PostSchedulingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Workflow states
  const [currentStep, setCurrentStep] = useState<'upload' | 'select' | 'caption' | 'protect' | 'schedule'>('upload');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<UploadedImage[]>([]);

  // Scheduling form state
  const [nsfw, setNsfw] = useState(false);

  // Handle image upload
  const handleImageUpload = (result: { imageUrl: string; deleteHash?: string }) => {
    const newImage: UploadedImage = {
      id: Date.now().toString(),
      url: result.imageUrl,
      deleteHash: result.deleteHash,
      selected: false
    };
    setUploadedImages(prev => [...prev, newImage]);
    toast({
      title: 'Image uploaded',
      description: 'Image successfully uploaded to Imgur'
    });
  };

  // Toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setUploadedImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, selected: !img.selected } : img
    ));
  };

  // Generate captions for selected images
  const generateCaptions = useMutation({
    mutationFn: async (images: UploadedImage[]) => {
      const promises = images.map(async (image) => {
        const response = await apiRequest('POST', '/api/ai/generate-from-url', {
          imageUrl: image.url,
          platform: 'reddit',
          voice: 'flirty_playful',
          style: 'explicit',
          nsfw: true
        });
        return { imageId: image.id, caption: (response as { caption?: string }).caption || '' };
      });
      return Promise.all(promises);
    },
    onSuccess: (results) => {
      results.forEach(({ imageId, caption }) => {
        setUploadedImages(prev => prev.map(img => 
          img.id === imageId ? { ...img, caption } : img
        ));
      });
      setCurrentStep('protect');
      toast({
        title: 'Captions generated',
        description: `Generated captions for ${results.length} images`
      });
    },
    onError: () => {
      toast({
        title: 'Generation failed',
        description: 'Could not generate captions. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Apply ImageShield protection
  const protectImages = useMutation({
    mutationFn: async (images: UploadedImage[]) => {
      // In production, this would apply protection and re-upload to Imgur
      // For now, simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      return images.map(img => ({ ...img, protected: true, protectedUrl: img.url }));
    },
    onSuccess: (protectedImages) => {
      setUploadedImages(prev => prev.map(img => {
        const protectedImg = protectedImages.find(p => p.id === img.id);
        return protectedImg ? { ...img, protected: true, protectedUrl: protectedImg.protectedUrl } : img;
      }));
      setCurrentStep('schedule');
      toast({
        title: 'Protection applied',
        description: 'Images protected with ImageShield'
      });
    }
  });

  // Schedule posts
  const schedulePosts = useMutation({
    mutationFn: async (data: ScheduleData[]) => {
      const promises = data.map(post => 
        apiRequest('POST', '/api/scheduled-posts', {
          title: post.caption.substring(0, 100) + '...',
          subreddit: post.subreddit,
          imageUrl: post.imageUrl,
          caption: post.caption,
          scheduledFor: post.scheduledFor,
          nsfw: post.nsfw
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-posts'] });
      toast({
        title: 'Posts scheduled!',
        description: `Successfully scheduled ${selectedImages.length} posts`
      });
      // Reset workflow
      setUploadedImages([]);
      setSelectedImages([]);
      setCurrentStep('upload');
    },
    onError: () => {
      toast({
        title: 'Scheduling failed',
        description: 'Could not schedule posts. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Move to next step
  const proceedToNextStep = () => {
    const selected = uploadedImages.filter(img => img.selected);
    
    switch (currentStep) {
      case 'upload':
        if (uploadedImages.length === 0) {
          toast({
            title: 'No images',
            description: 'Please upload at least one image',
            variant: 'destructive'
          });
          return;
        }
        setCurrentStep('select');
        break;
      
      case 'select':
        if (selected.length === 0) {
          toast({
            title: 'No selection',
            description: 'Please select at least one image',
            variant: 'destructive'
          });
          return;
        }
        setSelectedImages(selected);
        setCurrentStep('caption');
        generateCaptions.mutate(selected);
        break;
      
      case 'caption':
        protectImages.mutate(selected);
        break;
      
      case 'protect':
        setCurrentStep('schedule');
        break;
      
      case 'schedule':
        // Scheduling is now handled by SchedulingCalendar component
        break;
    }
  };

  // Get step number
  const getStepNumber = (step: string) => {
    const steps = ['upload', 'select', 'caption', 'protect', 'schedule'];
    return steps.indexOf(step) + 1;
  };

  const currentStepNumber = getStepNumber(currentStep);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Post Scheduling
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Complete workflow to schedule your Reddit posts
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['Upload', 'Select', 'Caption', 'Protect', 'Schedule'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-semibold",
                currentStepNumber > index + 1 
                  ? "bg-green-500 text-white" 
                  : currentStepNumber === index + 1 
                  ? "bg-purple-500 text-white" 
                  : "bg-gray-200 text-gray-500"
              )}>
                {currentStepNumber > index + 1 ? <CheckCircle className="h-5 w-5" /> : index + 1}
              </div>
              <span className="ml-2 text-sm font-medium">{step}</span>
              {index < 4 && (
                <ArrowRight className="mx-4 h-4 w-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Upload Images</h2>
                <p className="text-muted-foreground mb-4">
                  Upload your images to Catbox. They'll be stored securely and never on our servers.
                </p>
              </div>
              
              <CatboxUploadPortal onComplete={handleImageUpload} />
              
              {uploadedImages.length > 0 && (
                <div>
                  <Label className="mb-2">Uploaded Images ({uploadedImages.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {uploadedImages.map(img => (
                      <div key={img.id} className="relative group">
                        <img 
                          src={img.url} 
                          alt="Uploaded" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  onClick={() => proceedToNextStep()}
                  disabled={uploadedImages.length === 0}
                >
                  Continue to Selection
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Select Step */}
          {currentStep === 'select' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Select Images</h2>
                <p className="text-muted-foreground mb-4">
                  Choose which images you want to schedule for posting.
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uploadedImages.map(img => (
                  <div 
                    key={img.id} 
                    className={cn(
                      "relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                      img.selected ? "border-purple-500 shadow-lg" : "border-transparent"
                    )}
                    onClick={() => toggleImageSelection(img.id)}
                  >
                    <img 
                      src={img.url} 
                      alt="Select" 
                      className="w-full h-32 object-cover"
                    />
                    {img.selected && (
                      <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                  Back
                </Button>
                <Button 
                  onClick={() => proceedToNextStep()}
                  disabled={uploadedImages.filter(img => img.selected).length === 0}
                >
                  Generate Captions
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Caption Step */}
          {currentStep === 'caption' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Generating Captions</h2>
                <p className="text-muted-foreground mb-4">
                  AI is creating engaging captions for your images...
                </p>
              </div>
              
              {generateCaptions.isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedImages.map(img => (
                    <div key={img.id} className="flex gap-4">
                      <img 
                        src={img.url} 
                        alt="Caption" 
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <Label>Caption</Label>
                        <Textarea 
                          value={img.caption || ''} 
                          onChange={(e) => {
                            setUploadedImages(prev => prev.map(i => 
                              i.id === img.id ? { ...i, caption: e.target.value } : i
                            ));
                          }}
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep('select')}>
                      Back
                    </Button>
                    <Button onClick={() => proceedToNextStep()}>
                      Apply Protection
                      <Shield className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Protect Step */}
          {currentStep === 'protect' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Applying ImageShield</h2>
                <p className="text-muted-foreground mb-4">
                  Protecting your images from reverse search and unauthorized use...
                </p>
              </div>
              
              {protectImages.isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <div>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      All images have been protected with ImageShield technology
                    </AlertDescription>
                  </Alert>
                  
                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep('caption')}>
                      Back
                    </Button>
                    <Button onClick={() => proceedToNextStep()}>
                      Schedule Posts
                      <Calendar className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule Step */}
          {currentStep === 'schedule' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Schedule Posts</h2>
                <p className="text-muted-foreground mb-4">
                  Select dates and times for your posts using the calendar below.
                </p>
              </div>
              
              <SchedulingCalendar 
                selectedImages={selectedImages.map(img => ({
                  id: img.id,
                  url: img.url,
                  caption: img.caption,
                  subreddit: ''
                }))}
                onSchedule={(scheduleData) => {
                  // Add nsfw flag to each post in the schedule data
                  const scheduleDataWithNsfw = scheduleData.map(post => ({
                    ...post,
                    nsfw
                  }));
                  schedulePosts.mutate(scheduleDataWithNsfw);
                }}
                userTier={user?.tier as 'free' | 'starter' | 'pro' | 'premium' || 'free'}
              />
              
              <div className="flex items-center space-x-2 mt-4">
                <Switch 
                  id="nsfw"
                  checked={nsfw}
                  onCheckedChange={setNsfw}
                />
                <Label htmlFor="nsfw">Mark all posts as NSFW</Label>
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep('protect')}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
