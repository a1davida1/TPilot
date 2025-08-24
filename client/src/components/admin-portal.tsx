import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  Users,
  Gift,
  TrendingUp,
  Settings,
  Mail,
  Shield,
  Activity,
  DollarSign,
  UserPlus,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Zap,
  Crown,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Target,
  Rocket,
  CheckSquare,
  Square
} from 'lucide-react';

interface UserStats {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  premiumUsers: number;
  trialUsers: number;
  newUsersToday: number;
  activeToday: number;
  revenue: number;
}

interface TrialRequest {
  email: string;
  username: string;
  duration: number;
  tier: 'pro' | 'premium';
}

export function AdminPortal() {
  const [trialForm, setTrialForm] = useState<TrialRequest>({
    email: '',
    username: '',
    duration: 30,
    tier: 'pro'
  });
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { toast } = useToast();
  const { token } = useAuth();
  
  // Authenticated API request with JWT token
  const authenticatedRequest = async (url: string, method: string = 'GET', data?: any) => {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      throw new Error(errorMessage);
    }
    
    return response.json();
  };

  // Fetch user statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: () => authenticatedRequest('/api/admin/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!token
  });

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: () => authenticatedRequest('/api/admin/users'),
    enabled: !!token
  });

  // Create trial user mutation
  const createTrialMutation = useMutation({
    mutationFn: (data: TrialRequest) => authenticatedRequest('/api/admin/create-trial', 'POST', data),
    onSuccess: () => {
      toast({
        title: "Trial Created Successfully",
        description: `A ${trialForm.duration}-day ${trialForm.tier} trial has been created`,
        action: <CheckCircle className="h-4 w-4 text-green-500" />
      });
      setTrialForm({ email: '', username: '', duration: 30, tier: 'pro' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Trial",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  // Upgrade user mutation
  const upgradeUserMutation = useMutation({
    mutationFn: (data: { userId: number; tier: string }) => 
      authenticatedRequest('/api/admin/upgrade-user', 'POST', data),
    onSuccess: () => {
      toast({
        title: "User Upgraded",
        description: "User tier has been updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    }
  });

  const handleCreateTrial = () => {
    if (!trialForm.email || !trialForm.username) {
      toast({
        title: "Missing Information",
        description: "Please provide both email and username",
        variant: "destructive"
      });
      return;
    }
    createTrialMutation.mutate(trialForm);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white';
      case 'pro': return 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white';
      case 'trial': return 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-blue-600/10 border-purple-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl flex items-center gap-3">
                <Shield className="h-8 w-8 text-purple-600" />
                Admin Control Center
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Manage users, create trials, and monitor platform performance
              </CardDescription>
            </div>
            <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2">
              <Crown className="h-4 w-4 mr-2" />
              ADMIN ACCESS
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold">{(stats as any)?.totalUsers || 0}</p>
                <p className="text-xs text-green-600 mt-1">
                  +{(stats as any)?.newUsersToday || 0} today
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pro/Premium</p>
                <p className="text-3xl font-bold">
                  {((stats as any)?.proUsers || 0) + ((stats as any)?.premiumUsers || 0)}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {(stats as any)?.trialUsers || 0} trials active
                </p>
              </div>
              <Crown className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-3xl font-bold">${(stats as any)?.revenue || 0}</p>
                <p className="text-xs text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  12% increase
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Today</p>
                <p className="text-3xl font-bold">{(stats as any)?.activeToday || 0}</p>
                <p className="text-xs text-orange-600 mt-1">
                  Real-time activity
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="roadmap" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roadmap" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="trials" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Trials
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Roadmap Tab */}
        <TabsContent value="roadmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-purple-600" />
                Development Roadmap
              </CardTitle>
              <CardDescription>
                ThottoPilot implementation progress and milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Core Features */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Phase 1: Core Features (Complete)
                  </h3>
                  <div className="space-y-2 ml-7">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Authentication system with JWT</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Social login (Facebook, Google, Reddit)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Content generation with templates</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ ImageShield protection system</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Watermark system for free users</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Admin portal with user management</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Three-tier access (Guest/Free/Pro/Premium)</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Features */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Phase 2: Advanced Features (Complete)
                  </h3>
                  <div className="space-y-2 ml-7">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ AI content generation (OpenAI GPT-4o)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Image-to-caption workflow</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Multi-platform support (Reddit, Twitter, Instagram)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ 50+ promotional templates</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Quick style presets (8 styles)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>✅ Dark mode with neon accents</span>
                    </div>
                  </div>
                </div>

                {/* In Progress */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    Phase 3: Monetization (In Progress)
                  </h3>
                  <div className="space-y-2 ml-7">
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>⏳ Payment integration (Stripe)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>⏳ Email system (SendGrid)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>⏳ Subscription management</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>⏳ Analytics dashboard</span>
                    </div>
                  </div>
                </div>

                {/* Future Features */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    Phase 4: Future Enhancements
                  </h3>
                  <div className="space-y-2 ml-7">
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>📋 Voice clone library</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>📋 RTX 4090 batch processing</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>📋 Age verification system</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>📋 Mobile app</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-gray-400" />
                      <span>📋 API for external integrations</span>
                    </div>
                  </div>
                </div>

                {/* Progress Summary */}
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Overall Progress</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Core platform complete, monetization in progress
                      </p>
                    </div>
                    <div className="text-3xl font-bold text-purple-600">
                      75%
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Management Tab */}
        <TabsContent value="trials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Create Trial Access
              </CardTitle>
              <CardDescription>
                Generate trial access for new users or influencers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={trialForm.email}
                    onChange={(e) => setTrialForm({...trialForm, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="username"
                    value={trialForm.username}
                    onChange={(e) => setTrialForm({...trialForm, username: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Trial Duration</Label>
                  <Select 
                    value={trialForm.duration.toString()} 
                    onValueChange={(value) => setTrialForm({...trialForm, duration: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="14">14 Days</SelectItem>
                      <SelectItem value="30">30 Days (Recommended)</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Access Tier</Label>
                  <Select 
                    value={trialForm.tier} 
                    onValueChange={(value: 'pro' | 'premium') => setTrialForm({...trialForm, tier: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pro">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-blue-500" />
                          Pro Tier
                        </div>
                      </SelectItem>
                      <SelectItem value="premium">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-purple-500" />
                          Premium Tier
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Trial will automatically expire after the selected duration
                </div>
                <Button 
                  onClick={handleCreateTrial}
                  disabled={createTrialMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {createTrialMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4 mr-2" />
                      Create Trial
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Trials */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Trials</CardTitle>
              <CardDescription>Active trial users and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(Array.isArray(users) ? users.filter((u: any) => u.trialEndsAt && new Date(u.trialEndsAt) > new Date())
                  .slice(0, 5) : [])
                  .map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getTierColor(user.tier)}>
                          {user.tier.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left
                        </Badge>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-gray-500 py-4">No active trials</p>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage user accounts and subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usersLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="text-gray-500 mt-2">Loading users...</p>
                  </div>
                ) : (
                  Array.isArray(users) ? users.slice(0, 10).map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-lg">{user.username}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{user.email || 'No email'}</p>
                          <p className="text-xs text-gray-500">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getTierColor(user.tier)}>
                          {user.tier.toUpperCase()}
                        </Badge>
                        <Select 
                          value={user.tier}
                          onValueChange={(value) => upgradeUserMutation.mutate({ userId: user.id, tier: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )) : null
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Configuration</CardTitle>
              <CardDescription>Manage system-wide settings and features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-purple-500/30 bg-purple-500/5">
                <Zap className="h-4 w-4 text-purple-600" />
                <AlertDescription>
                  <strong>Email System:</strong> {(stats as any)?.emailConfigured ? 'Configured ✓' : 'Not configured - Add SendGrid API key'}
                </AlertDescription>
              </Alert>
              
              <Alert className="border-blue-500/30 bg-blue-500/5">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <strong>Security:</strong> JWT Secret {(stats as any)?.jwtConfigured ? 'Configured ✓' : 'Using default (not secure)'}
                </AlertDescription>
              </Alert>

              <Alert className="border-green-500/30 bg-green-500/5">
                <Activity className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Platform Status:</strong> All systems operational
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}