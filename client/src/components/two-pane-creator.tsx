import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Upload,
  Sparkles,
  Calendar,
  ChevronRight,
  Loader2,
  Check,
  Edit,
  Save,
  X,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';


import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TwoPaneCreatorProps {
  className?: string;
}

interface Persona {
  id: string;
  name: string;
  description: string;
  voice: 'bratty_tease' | 'seductive_goddess' | 'playful_flirt';
}

interface Tone {
  id: string;
  label: string;
  value: string;
}

interface Community {
  id: string;
  name: string;
  displayName: string;
  memberCount: number;
  successRate: number;
}

interface Caption {
  id: string;
  text: string;
  style?: string;
  confidence?: number;
}

const personas: Persona[] = [
  { id: 'bratty', name: 'Bratty Tease', description: 'Playful and challenging', voice: 'bratty_tease' },
  { id: 'seductive', name: 'Seductive Goddess', description: 'Sultry and confident', voice: 'seductive_goddess' },
  { id: 'playful', name: 'Playful Flirt', description: 'Fun and energetic', voice: 'playful_flirt' },
];

const tones: Tone[] = [
  { id: 'flirty', label: '😘 Flirty', value: 'flirty' },
  { id: 'confident', label: '💪 Confident', value: 'confident' },
  { id: 'teasing', label: '😏 Teasing', value: 'teasing' },
  { id: 'casual', label: '😊 Casual', value: 'casual' },
];

export function TwoPaneCreator({ className }: TwoPaneCreatorProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // States
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<Persona>(personas[0]);
  const [selectedTone, setSelectedTone] = useState<Tone>(tones[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [generatedCaption, setGeneratedCaption] = useState<Caption | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editedCaptionText, setEditedCaptionText] = useState('');
  const [selectedCommunities, setSelectedCommunities] = useState<Community[]>([]);
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleTime, setScheduleTime] = useState<string>('09:00');

  // Fetch communities
  const { data: communities = [] } = useQuery<Community[]>({
    queryKey: ['/api/reddit/communities'],
    enabled: !!user?.id,
  });

  // Caption generation mutation
  const generateCaptionMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedImage) throw new Error('No image uploaded');
      
      const formData = new FormData();
      formData.append('image', uploadedImage);
      formData.append('persona', selectedPersona.voice);
      formData.append('tone', selectedTone.value);
      formData.append('tags', JSON.stringify(tags));

      const data = await apiRequest<unknown>('POST', '/api/caption/generate', formData);
      return data;
    },
    onSuccess: (data: any) => {
      const caption = data.topVariants?.[0] || data.captions?.[0] || data.final;
      if (caption) {
        setGeneratedCaption({
          id: caption.id || Math.random().toString(),
          text: caption.caption || caption.text,
          style: caption.style || caption.label,
          confidence: caption.confidence,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate caption',
        variant: 'destructive',
      });
    },
  });

  // Schedule posts mutation
  const schedulePostsMutation = useMutation({
    mutationFn: async () => {
      if (!generatedCaption || selectedCommunities.length === 0) {
        throw new Error('Missing caption or communities');
      }

      const scheduledPosts = selectedCommunities.map((community, index) => {
        const date = scheduleDate || new Date();
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        date.setHours(hours + index * 2, minutes, 0, 0); // Stagger by 2 hours

        return {
          subreddit: community.name,
          title: generatedCaption.text.slice(0, 50) + '...',
          caption: generatedCaption.text,
          scheduledAt: date.toISOString(),
          imageUrl: imagePreview,
        };
      });

      const data = await apiRequest<unknown>('POST', '/api/posts/schedule', { posts: scheduledPosts });
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Posts Scheduled!',
        description: `${selectedCommunities.length} posts scheduled successfully`,
      });
      setLocation('/post-scheduling');
    },
    onError: (error) => {
      toast({
        title: 'Scheduling Failed',
        description: error instanceof Error ? error.message : 'Failed to schedule posts',
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleToggleCommunity = (community: Community) => {
    if (selectedCommunities.find(c => c.id === community.id)) {
      setSelectedCommunities(selectedCommunities.filter(c => c.id !== community.id));
    } else {
      setSelectedCommunities([...selectedCommunities, community]);
    }
  };

  const handleEditCaption = () => {
    if (generatedCaption) {
      setEditedCaptionText(generatedCaption.text);
      setEditingCaption(true);
    }
  };

  const handleSaveCaption = () => {
    if (generatedCaption) {
      setGeneratedCaption({ ...generatedCaption, text: editedCaptionText });
      setEditingCaption(false);
    }
  };

  const handleCopyCaption = () => {
    if (generatedCaption) {
      navigator.clipboard.writeText(generatedCaption.text);
      toast({
        title: 'Copied!',
        description: 'Caption copied to clipboard',
      });
    }
  };

  const canGenerate = uploadedImage && selectedPersona && selectedTone;
  const canSchedule = generatedCaption && selectedCommunities.length > 0;

  return (
    <div className={cn('flex h-[calc(100vh-8rem)] gap-6', className)}>
      {/* Left Pane - Input */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader>
          <CardTitle>Create Post</CardTitle>
          <CardDescription>Upload image and configure generation settings</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-6">
              {/* Image Upload */}
              <div>
                <Label htmlFor="image-upload">📤 Upload Image</Label>
                <div className="mt-2">
                  {!imagePreview ? (
                    <label
                      htmlFor="image-upload"
                      className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50"
                    >
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                        <span className="mt-2 text-sm text-muted-foreground">
                          Click to upload image
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-48 w-full rounded-lg object-cover"
                      />
                      <Button
                        onClick={() => {
                          setUploadedImage(null);
                          setImagePreview('');
                        }}
                        size="sm"
                        variant="destructive"
                        className="absolute right-2 top-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              <Separator />

              {/* Persona Selection */}
              <div>
                <Label>🎭 Select Persona</Label>
                <div className="mt-2 space-y-2">
                  {personas.map(persona => (
                    <div
                      key={persona.id}
                      onClick={() => setSelectedPersona(persona)}
                      className={cn(
                        'cursor-pointer rounded-lg border p-3 transition-colors',
                        selectedPersona.id === persona.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="font-medium">{persona.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {persona.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Tone Selection */}
              <div>
                <Label>🎨 Choose Tone</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {tones.map(tone => (
                    <Button
                      key={tone.id}
                      onClick={() => setSelectedTone(tone)}
                      variant={selectedTone.id === tone.id ? 'default' : 'outline'}
                      className="justify-start"
                    >
                      {tone.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <Label>🏷️ Add Tags</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add tag..."
                    className="flex-1"
                  />
                  <Button onClick={handleAddTag} size="sm">
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Generate Button */}
              <Button
                onClick={() => generateCaptionMutation.mutate()}
                disabled={!canGenerate || generateCaptionMutation.isPending}
                className="w-full"
                size="lg"
              >
                {generateCaptionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Caption
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Pane - Output */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader>
          <CardTitle>Preview & Schedule</CardTitle>
          <CardDescription>Review generated content and schedule posts</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-6">
              {/* Generated Caption */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>✨ Generated Caption</Label>
                  {generatedCaption && (
                    <div className="flex gap-1">
                      <Button
                        onClick={handleEditCaption}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={handleCopyCaption}
                        size="sm"
                        variant="ghost"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => generateCaptionMutation.mutate()}
                        size="sm"
                        variant="ghost"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <Card className="mt-2">
                  <CardContent className="p-4">
                    {!generatedCaption ? (
                      <div className="text-center text-muted-foreground">
                        Caption will appear here after generation
                      </div>
                    ) : editingCaption ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedCaptionText}
                          onChange={(e) => setEditedCaptionText(e.target.value)}
                          rows={4}
                          className="resize-none"
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleSaveCaption} size="sm">
                            <Save className="mr-1 h-3 w-3" />
                            Save
                          </Button>
                          <Button
                            onClick={() => setEditingCaption(false)}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{generatedCaption.text}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Schedule Card */}
              <div>
                <Label>📅 Schedule Posts</Label>
                <Card className="mt-2">
                  <CardContent className="p-4 space-y-4">
                    {/* Community Selection */}
                    <div>
                      <Label className="text-xs">Select Subreddits</Label>
                      <Popover open={communityPickerOpen} onOpenChange={setCommunityPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={communityPickerOpen}
                            className="w-full justify-between"
                          >
                            {selectedCommunities.length === 0
                              ? 'Select subreddits...'
                              : `${selectedCommunities.length} selected`}
                            <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search subreddits..." />
                            <CommandEmpty>No subreddit found.</CommandEmpty>
                            <CommandGroup>
                              {communities.map(community => (
                                <CommandItem
                                  key={community.id}
                                  onSelect={() => handleToggleCommunity(community)}
                                >
                                  <div className="flex items-center">
                                    <div className={cn(
                                      'mr-2 h-4 w-4 rounded-sm border',
                                      selectedCommunities.find(c => c.id === community.id)
                                        ? 'bg-primary'
                                        : 'border-primary'
                                    )}>
                                      {selectedCommunities.find(c => c.id === community.id) && (
                                        <Check className="h-3 w-3 text-primary-foreground" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium">r/{community.displayName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {community.memberCount.toLocaleString()} members • {community.successRate}% success
                                      </div>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Schedule Time */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={scheduleDate ? format(scheduleDate, 'yyyy-MM-dd') : ''}
                          onChange={(e) => setScheduleDate(new Date(e.target.value))}
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Selected Communities List */}
                    {selectedCommunities.length > 0 && (
                      <div className="space-y-2">
                        {selectedCommunities.map((community, index) => {
                          const postTime = new Date();
                          if (scheduleDate) {
                            postTime.setFullYear(scheduleDate.getFullYear());
                            postTime.setMonth(scheduleDate.getMonth());
                            postTime.setDate(scheduleDate.getDate());
                          }
                          const [hours, minutes] = scheduleTime.split(':').map(Number);
                          postTime.setHours(hours + index * 2, minutes, 0, 0);

                          return (
                            <div key={community.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                              <div>
                                <div className="text-sm font-medium">r/{community.displayName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(postTime, 'MMM d, h:mm a')}
                                </div>
                              </div>
                              <Badge variant="outline">
                                {community.successRate}% match
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Schedule Button */}
                    <Button
                      onClick={() => schedulePostsMutation.mutate()}
                      disabled={!canSchedule || schedulePostsMutation.isPending}
                      className="w-full"
                    >
                      {schedulePostsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule {selectedCommunities.length} Posts
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
