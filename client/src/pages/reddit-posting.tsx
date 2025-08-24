import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Send, 
  Calendar,
  User,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Globe,
  Settings,
  Clock,
  BarChart3,
  Users,
  TrendingUp,
  Zap,
  Shield,
  FileText,
  TestTube,
  ExternalLink
} from 'lucide-react';

interface RedditAccount {
  id: number;
  username: string;
  isActive: boolean;
  connectedAt: string;
  karma: number;
  verified: boolean;
}

interface SubredditCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category: string;
  promotionAllowed: string;
  bestPostingTimes: string[];
  averageUpvotes: number;
  successProbability: number;
  description: string;
  rules: {
    minKarma: number;
    minAccountAge: number;
    watermarksAllowed: boolean;
    sellingAllowed: boolean;
    titleRules: string[];
    contentRules: string[];
  };
}

export default function RedditPostingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [subreddit, setSubreddit] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [nsfw, setNsfw] = useState(false);
  const [spoiler, setSpoiler] = useState(false);
  const [postType, setPostType] = useState<'text' | 'link'>('text');
  const [scheduledAt, setScheduledAt] = useState('');
  
  // UI state
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Fetch Reddit accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/reddit/accounts'],
    retry: false,
  });

  // Fetch subreddit communities data
  const { data: communities = [] } = useQuery({
    queryKey: ['/api/reddit/communities'],
    retry: false,
  });

  // Test Reddit connection
  const { mutate: testConnection, isPending: testingConnection } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/reddit/test');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Connection Test",
        description: data.connected ? 
          `Connected as ${data.profile?.username} (${data.profile?.karma} karma)` : 
          "Connection failed",
        variant: data.connected ? "default" : "destructive"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Connect Reddit account
  const { mutate: connectReddit, isPending: connectingReddit } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/reddit/connect');
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        toast({
          title: "🔗 Reddit Authorization",
          description: "Complete the authorization in the popup window"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Content policy validation
  const { mutate: validateContent, isPending: validating, data: validation } = useMutation({
    mutationFn: async (data: { subreddit: string; title: string; body: string; hasLink: boolean }) => {
      const response = await apiRequest('POST', '/api/preview', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "🔍 Content Validated",
        description: `Policy check: ${data.policyState}`,
        variant: data.policyState === 'block' ? 'destructive' : 'default'
      });
    }
  });

  // Submit post
  const { mutate: submitPost, isPending: submitting } = useMutation({
    mutationFn: async (data: { subreddit: string; title: string; body?: string; url?: string; nsfw: boolean; spoiler: boolean }) => {
      const response = await apiRequest('POST', '/api/reddit/submit', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "🎉 Post Published!",
          description: `Successfully posted to r/${subreddit}`,
          variant: "default"
        });
        // Reset form
        setTitle('');
        setBody('');
        setUrl('');
        setSubreddit('');
        queryClient.invalidateQueries({ queryKey: ['/api/reddit/posts'] });
      } else {
        toast({
          title: "❌ Posting Failed",
          description: data.error,
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Posting Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Schedule post
  const { mutate: schedulePost, isPending: scheduling } = useMutation({
    mutationFn: async (data: { subreddit: string; title: string; body: string; scheduledAt?: string }) => {
      const response = await apiRequest('POST', '/api/posts/schedule', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "📅 Post Scheduled!",
        description: `Post will be published at ${new Date(data.scheduledAt).toLocaleString()}`,
        variant: "default"
      });
      // Reset form
      setTitle('');
      setBody('');
      setSubreddit('');
      setScheduledAt('');
    }
  });

  // Handle content validation
  const handleValidateContent = () => {
    if (!subreddit || !title) {
      toast({
        title: "⚠️ Missing Required Fields",
        description: "Please enter subreddit and title",
        variant: "destructive"
      });
      return;
    }

    validateContent({
      subreddit,
      title,
      body,
      hasLink: postType === 'link' && !!url
    });
  };

  // Handle post submission
  const handleSubmitPost = () => {
    if (!subreddit || !title) {
      toast({
        title: "⚠️ Missing Required Fields",
        description: "Please enter subreddit and title",
        variant: "destructive"
      });
      return;
    }

    const postData = {
      subreddit,
      title,
      nsfw,
      spoiler,
      ...(postType === 'text' ? { body } : { url })
    };

    submitPost(postData);
  };

  // Handle post scheduling
  const handleSchedulePost = () => {
    if (!subreddit || !title) {
      toast({
        title: "⚠️ Missing Required Fields",
        description: "Please enter subreddit and title",
        variant: "destructive"
      });
      return;
    }

    schedulePost({
      subreddit,
      title,
      body,
      scheduledAt: scheduledAt || undefined
    });
  };

  // Find community data for selected subreddit
  const selectedCommunity = (communities as any[]).find((c: SubredditCommunity) => 
    c.name.toLowerCase() === `r/${subreddit.toLowerCase()}` || c.id === subreddit.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Reddit Posting Hub
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Create, validate, and publish content to Reddit communities with intelligent optimization
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Main Posting Interface */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Account Status */}
            <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Reddit Account Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {accountsLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent" />
                      <span className="text-sm text-gray-600">Loading accounts...</span>
                    </div>
                  ) : (accounts as any[])?.length > 0 ? (
                    <div className="space-y-3">
                      {(accounts as any[]).map((account: RedditAccount) => (
                        <div key={account.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full" />
                            <div>
                              <p className="font-medium text-green-800">u/{account.username}</p>
                              <p className="text-sm text-green-600">{account.karma} karma • Connected {new Date(account.connectedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              {account.verified ? 'Verified' : 'Active'}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => testConnection()}
                              disabled={testingConnection}
                              className="border-green-300 text-green-700 hover:bg-green-50"
                            >
                              <TestTube className="h-4 w-4 mr-1" />
                              Test
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
                      <Globe className="h-12 w-12 text-orange-500 mx-auto mb-3" />
                      <h3 className="font-medium text-orange-800 mb-2">No Reddit Account Connected</h3>
                      <p className="text-sm text-orange-600 mb-4">Connect your Reddit account to start posting</p>
                      <Button 
                        onClick={() => connectReddit()}
                        disabled={connectingReddit}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {connectingReddit ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        ) : (
                          <LinkIcon className="h-4 w-4 mr-2" />
                        )}
                        Connect Reddit Account
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Post Creation */}
            <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create Post
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Post Type Selection */}
                <div className="flex gap-2">
                  <Button
                    variant={postType === 'text' ? 'default' : 'outline'}
                    onClick={() => setPostType('text')}
                    className="flex-1"
                    data-testid="button-post-type-text"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Text Post
                  </Button>
                  <Button
                    variant={postType === 'link' ? 'default' : 'outline'}
                    onClick={() => setPostType('link')}
                    className="flex-1"
                    data-testid="button-post-type-link"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link Post
                  </Button>
                </div>

                {/* Subreddit Input */}
                <div className="space-y-2">
                  <Label htmlFor="subreddit">Subreddit</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500 text-sm">r/</span>
                    <Input
                      id="subreddit"
                      value={subreddit}
                      onChange={(e) => setSubreddit(e.target.value)}
                      placeholder="gonewild"
                      className="pl-8"
                      data-testid="input-subreddit"
                    />
                  </div>
                  {selectedCommunity && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-blue-800">{selectedCommunity.displayName}</span>
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          {selectedCommunity.members.toLocaleString()} members
                        </Badge>
                      </div>
                      <p className="text-blue-700 mb-2">{selectedCommunity.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Success Rate: <span className="font-medium text-green-600">{selectedCommunity.successProbability}%</span></div>
                        <div>Avg Upvotes: <span className="font-medium text-blue-600">{selectedCommunity.averageUpvotes}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter an engaging title..."
                    maxLength={300}
                    data-testid="input-title"
                  />
                  <div className="text-xs text-gray-500 text-right">{title.length}/300</div>
                </div>

                {/* Content Input */}
                {postType === 'text' ? (
                  <div className="space-y-2">
                    <Label htmlFor="body">Content (Optional)</Label>
                    <Textarea
                      id="body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your post content..."
                      rows={6}
                      maxLength={10000}
                      data-testid="textarea-body"
                    />
                    <div className="text-xs text-gray-500 text-right">{body.length}/10,000</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      type="url"
                      data-testid="input-url"
                    />
                  </div>
                )}

                {/* Post Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nsfw"
                      checked={nsfw}
                      onCheckedChange={setNsfw}
                      data-testid="switch-nsfw"
                    />
                    <Label htmlFor="nsfw" className="text-sm">Mark as NSFW</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="spoiler"
                      checked={spoiler}
                      onCheckedChange={setSpoiler}
                      data-testid="switch-spoiler"
                    />
                    <Label htmlFor="spoiler" className="text-sm">Mark as Spoiler</Label>
                  </div>
                </div>

                {/* Content Validation */}
                {validation && (
                  <div className={`p-4 rounded-lg border ${
                    (validation as any)?.policyState === 'pass' ? 'bg-green-50 border-green-200' :
                    (validation as any)?.policyState === 'warn' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {(validation as any)?.policyState === 'pass' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (validation as any)?.policyState === 'warn' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        (validation as any)?.policyState === 'pass' ? 'text-green-800' :
                        (validation as any)?.policyState === 'warn' ? 'text-yellow-800' :
                        'text-red-800'
                      }`}>
                        Policy Check: {((validation as any)?.policyState || 'unknown').toUpperCase()}
                      </span>
                    </div>
                    {(validation as any)?.warnings && (validation as any)?.warnings.length > 0 && (
                      <ul className={`text-sm space-y-1 ${
                        (validation as any)?.policyState === 'pass' ? 'text-green-700' :
                        (validation as any)?.policyState === 'warn' ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {(validation as any)?.warnings.map((warning: string, index: number) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleValidateContent}
                    disabled={validating || !subreddit || !title}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-validate"
                  >
                    {validating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent mr-2" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Validate Content
                  </Button>
                  <Button
                    onClick={handleSubmitPost}
                    disabled={submitting || !subreddit || !title || (accounts as any[])?.length === 0}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                    data-testid="button-submit"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Post Now
                  </Button>
                </div>

                {/* Scheduling Section */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <Label className="text-sm font-medium">Schedule for Later</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        data-testid="input-schedule-time"
                      />
                    </div>
                    <Button
                      onClick={handleSchedulePost}
                      disabled={scheduling || !subreddit || !title}
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      data-testid="button-schedule"
                    >
                      {scheduling ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      Schedule Post
                    </Button>
                  </div>
                  {selectedCommunity?.bestPostingTimes && (
                    <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <span className="font-medium text-purple-800">💡 Best posting times for r/{subreddit}: </span>
                      <span className="text-purple-700">{selectedCommunity.bestPostingTimes.join(', ')}</span>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Community Insights */}
            {selectedCommunity && (
              <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Community Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <Users className="h-4 w-4 text-blue-600 mb-1" />
                      <p className="font-medium text-blue-800">{selectedCommunity.members.toLocaleString()}</p>
                      <p className="text-blue-600">Members</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <TrendingUp className="h-4 w-4 text-green-600 mb-1" />
                      <p className="font-medium text-green-800">{selectedCommunity.engagementRate}%</p>
                      <p className="text-green-600">Engagement</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <Zap className="h-4 w-4 text-purple-600 mb-1" />
                      <p className="font-medium text-purple-800">{selectedCommunity.successProbability}%</p>
                      <p className="text-purple-600">Success Rate</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <TrendingUp className="h-4 w-4 text-orange-600 mb-1" />
                      <p className="font-medium text-orange-800">{selectedCommunity.averageUpvotes}</p>
                      <p className="text-orange-600">Avg Upvotes</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Community Rules</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min Karma:</span>
                          <span className="font-medium">{selectedCommunity.rules.minKarma}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min Account Age:</span>
                          <span className="font-medium">{selectedCommunity.rules.minAccountAge} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Watermarks:</span>
                          <Badge variant={selectedCommunity.rules.watermarksAllowed ? 'default' : 'destructive'} className="text-xs">
                            {selectedCommunity.rules.watermarksAllowed ? 'Allowed' : 'Not Allowed'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Selling:</span>
                          <Badge variant={selectedCommunity.rules.sellingAllowed ? 'default' : 'destructive'} className="text-xs">
                            {selectedCommunity.rules.sellingAllowed ? 'Allowed' : 'Not Allowed'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Tips */}
            <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-1">📝 Title Optimization</p>
                  <p className="text-blue-700">Include your age/gender and be descriptive but not clickbait-y</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-medium text-green-800 mb-1">⏰ Timing Matters</p>
                  <p className="text-green-700">Post during peak hours for maximum engagement</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="font-medium text-purple-800 mb-1">🛡️ Stay Safe</p>
                  <p className="text-purple-700">Always validate content before posting to avoid rule violations</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="font-medium text-orange-800 mb-1">💬 Engage</p>
                  <p className="text-orange-700">Reply to comments to boost your post's visibility</p>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </div>
  );
}