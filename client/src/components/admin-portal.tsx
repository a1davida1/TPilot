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
  Square,
  Eye,
  Monitor,
  UserX,
  Flag,
  BarChart3,
  MapPin,
  Wifi,
  Database,
  Server,
  AlertTriangle,
  Ban,
  Trash2,
  Clock3
} from 'lucide-react';

interface UserStats {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  starterUsers: number;
  trialUsers: number;
  newUsersToday: number;
  activeToday: number;
  revenue: number;
}

interface TrialRequest {
  email: string;
  username: string;
  duration: number;
  tier: 'starter' | 'pro';
}

export function AdminPortal() {
  const [trialForm, setTrialForm] = useState<TrialRequest>({
    email: '',
    username: '',
    duration: 30,
    tier: 'starter'
  });
  const [selectedUser, setSelectedUser] = useState<unknown>(null);
  const { toast } = useToast();
  const { token } = useAuth();
  
  // Authenticated API request with JWT token
  const authenticatedRequest = async (url: string, method: string = 'GET', data?: unknown) => {
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
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!token
  });

  // Fetch all users
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<any[]>({
    queryKey: ['/api/admin/users'],
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
      setTrialForm({ email: '', username: '', duration: 30, tier: 'starter' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: (error: unknown) => {
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
      case 'admin': return 'bg-gradient-to-r from-red-600 to-orange-600 text-white';
      case 'pro': return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white';
      case 'starter': return 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white';
      case 'trial': return 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white';
      case 'free': return 'bg-gray-100 text-gray-800 border border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border border-gray-300';
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
      <Tabs defaultValue="live-dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="live-dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Live Dashboard
          </TabsTrigger>
          <TabsTrigger value="ip-tracking" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            IP Tracking
          </TabsTrigger>
          <TabsTrigger value="system-monitor" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="user-management" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            User Actions
          </TabsTrigger>
          <TabsTrigger value="moderation" className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Moderation
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

        {/* FEATURE 5: Live Dashboard Tab */}
        <TabsContent value="live-dashboard" className="space-y-4">
          <LiveDashboardTab authenticatedRequest={authenticatedRequest} />
        </TabsContent>

        {/* FEATURE 1: IP Tracking Tab */}
        <TabsContent value="ip-tracking" className="space-y-4">
          <IPTrackingTab authenticatedRequest={authenticatedRequest} />
        </TabsContent>

        {/* FEATURE 2: System Monitoring Tab */}
        <TabsContent value="system-monitor" className="space-y-4">
          <SystemMonitorTab authenticatedRequest={authenticatedRequest} />
        </TabsContent>

        {/* FEATURE 3: User Management Tab */}
        <TabsContent value="user-management" className="space-y-4">
          <UserManagementTab authenticatedRequest={authenticatedRequest} users={users || []} />
        </TabsContent>

        {/* FEATURE 4: Content Moderation Tab */}
        <TabsContent value="moderation" className="space-y-4">
          <ContentModerationTab authenticatedRequest={authenticatedRequest} />
        </TabsContent>

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
                    value={trialForm.email}
                    onChange={(e) => setTrialForm({...trialForm, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
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
                    onValueChange={(value: 'starter' | 'pro') => setTrialForm({...trialForm, tier: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-blue-500" />
                          Starter Tier ($13/mo)
                        </div>
                      </SelectItem>
                      <SelectItem value="pro">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-purple-500" />
                          Pro Tier ($29/mo)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
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
                {(Array.isArray(users) ? users.filter((u: unknown) => u.trialEndsAt && new Date(u.trialEndsAt) > new Date())
                  .slice(0, 5) : [])
                  .map((user: unknown) => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
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
                    <p className="text-center text-muted-foreground py-4">No active trials</p>
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
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground mt-2">Loading users...</p>
                  </div>
                ) : (
                  Array.isArray(users) ? users.slice(0, 10).map((user: unknown) => (
                    <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-lg">{user.username}</p>
                          <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
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
                            <SelectItem value="starter">Starter ($13/mo)</SelectItem>
                            <SelectItem value="pro">Pro ($29/mo)</SelectItem>
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

// ============================================================================
// ADMIN FEATURE COMPONENTS
// ============================================================================

// FEATURE 5: Live Dashboard Component
function LiveDashboardTab({ authenticatedRequest }: { authenticatedRequest: unknown }) {
  const { data: liveData, refetch } = useQuery({
    queryKey: ['/api/admin/live-dashboard'],
    queryFn: () => authenticatedRequest('/api/admin/live-dashboard'),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { toast } = useToast();

  const acknowledgeAlert = useMutation({
    mutationFn: (alertId: number) => authenticatedRequest('/api/admin/acknowledge-alert', 'POST', { alertId }),
    onSuccess: () => {
      toast({ title: "Alert acknowledged" });
      refetch();
    }
  });

  return (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{liveData?.realTime?.activeUsers || 0}</p>
                <div className="flex items-center text-xs text-green-600">
                  <Wifi className="h-3 w-3 mr-1" />
                  {liveData?.realTime?.onlineNow || 0} online now
                </div>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Content Gen</p>
                <p className="text-2xl font-bold text-blue-600">{liveData?.realTime?.contentBeingGenerated || 0}</p>
                <p className="text-xs text-blue-600">Active processes</p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">API Calls/Min</p>
                <p className="text-2xl font-bold text-purple-600">{liveData?.realTime?.apiCallsPerMinute || 0}</p>
                <p className="text-xs text-purple-600">Real-time load</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Health</p>
                <div className="flex gap-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${liveData?.systemHealth?.database === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className={`w-2 h-2 rounded-full ${liveData?.systemHealth?.ai === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <div className={`w-2 h-2 rounded-full ${liveData?.systemHealth?.storage === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className={`w-2 h-2 rounded-full ${liveData?.systemHealth?.api === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <p className="text-xs text-orange-600">DB • AI • Storage • API</p>
              </div>
              <Server className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {liveData?.alerts?.map((alert: unknown) => (
                <div key={alert.id} className={`p-3 rounded-lg border ${
                  alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20' : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{alert.message}</p>
                    </div>
                    {!alert.acknowledged && (
                      <Button size="sm" variant="outline" onClick={() => acknowledgeAlert.mutate(alert.id)}
                        data-testid={`button-acknowledge-alert-${alert.id}`}>
                        ✓
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-blue-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {liveData?.recentActivity?.map((activity: unknown, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{activity.user}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {activity.action} {activity.target ? `• ${activity.target}` : ''} {activity.platform ? `on ${activity.platform}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(activity.time).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// FEATURE 1: IP Tracking Component
function IPTrackingTab({ authenticatedRequest }: { authenticatedRequest: unknown }) {
  const { data: ipData } = useQuery({
    queryKey: ['/api/admin/ip-tracking'],
    queryFn: () => authenticatedRequest('/api/admin/ip-tracking'),
  });

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { data: userActivity } = useQuery({
    queryKey: ['/api/admin/user-activity', selectedUserId],
    queryFn: () => authenticatedRequest(`/api/admin/user-activity/${selectedUserId}`),
    enabled: !!selectedUserId
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            IP Address Tracking
          </CardTitle>
          <CardDescription>Monitor user IP addresses and suspicious activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">IP Address</th>
                  <th className="text-left p-2">Users</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Last Seen</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ipData?.map((ip: unknown) => (
                  <tr key={ip.ip} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2 font-mono text-sm">{ip.ip}</td>
                    <td className="p-2">{ip.users}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-500" />
                        {ip.location}
                      </div>
                    </td>
                    <td className="p-2">{new Date(ip.lastSeen).toLocaleDateString()}</td>
                    <td className="p-2">
                      <Badge className={ip.flagged ? 'bg-red-500' : 'bg-green-500'}>
                        {ip.flagged ? 'Flagged' : 'Clean'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="outline"
                        data-testid={`button-view-activity-${ip.ip.replace(/\./g, '-')}`}>
                        View Activity
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Session Details */}
      {selectedUserId && (
        <Card>
          <CardHeader>
            <CardTitle>User Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userActivity?.map((session: unknown) => (
                <div key={session.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{session.ipAddress}</span>
                        <Badge className={session.isActive ? 'bg-green-500' : 'bg-gray-500'}>
                          {session.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {session.deviceType} • {session.browser} • {session.os}
                      </p>
                      <p className="text-xs text-gray-500">
                        {session.location?.city}, {session.location?.country}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>Login: {new Date(session.loginAt).toLocaleString()}</p>
                      <p>Last: {new Date(session.lastActivity).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// FEATURE 2: System Monitoring Component
function SystemMonitorTab({ authenticatedRequest }: { authenticatedRequest: unknown }) {
  const { data: metrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['/api/admin/system-metrics'],
    queryFn: () => authenticatedRequest('/api/admin/system-metrics'),
    refetchInterval: 10000,
  });

  const { data: logs } = useQuery({
    queryKey: ['/api/admin/system-logs'],
    queryFn: () => authenticatedRequest('/api/admin/system-logs?limit=20'),
    refetchInterval: 15000,
  });

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              Server Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium">{formatUptime(metrics?.uptime || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Memory</span>
              <span className="text-sm font-medium">{formatMemory(metrics?.memoryUsage?.heapUsed || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <Badge className="bg-green-500">Healthy</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Connections</span>
              <span className="text-sm font-medium">{metrics?.database?.connections}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg Query</span>
              <span className="text-sm font-medium">{metrics?.database?.avgQueryTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <Badge className="bg-green-500">Healthy</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              API Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Requests</span>
              <span className="text-sm font-medium">{metrics?.api?.totalRequests}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg Response</span>
              <span className="text-sm font-medium">{metrics?.api?.avgResponseTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Error Rate</span>
              <span className="text-sm font-medium text-green-600">{metrics?.api?.errorRate}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-green-500" />
            System Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs?.map((log: unknown) => (
              <div key={log.id} className={`p-2 rounded text-sm border-l-4 ${
                log.level === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 
                log.level === 'warn' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 
                'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{log.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.service} • {log.level.toUpperCase()} 
                      {log.ipAddress && ` • ${log.ipAddress}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${metrics?.services?.ai?.gemini ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-medium">Gemini AI</p>
              <p className="text-xs text-muted-foreground">{metrics?.services?.ai?.gemini ? 'Connected' : 'Offline'}</p>
            </div>
            <div className="text-center p-3 border rounded">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${metrics?.services?.ai?.openai ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-medium">OpenAI</p>
              <p className="text-xs text-muted-foreground">{metrics?.services?.ai?.openai ? 'Connected' : 'Offline'}</p>
            </div>
            <div className="text-center p-3 border rounded">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${metrics?.services?.email ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground">{metrics?.services?.email ? 'Connected' : 'Offline'}</p>
            </div>
            <div className="text-center p-3 border rounded">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${metrics?.services?.storage ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-medium">Storage</p>
              <p className="text-xs text-muted-foreground">{metrics?.services?.storage ? 'Connected' : 'Offline'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// FEATURE 3: User Management Component
function UserManagementTab({ authenticatedRequest, users }: { authenticatedRequest: unknown, users: unknown[] }) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<unknown>(null);
  const [actionType, setActionType] = useState<'ban' | 'suspend' | 'unban' | 'reset-password' | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('24');
  const [tempPassword, setTempPassword] = useState('');

  const actionMutation = useMutation({
    mutationFn: async (data: unknown) => {
      switch (data.action) {
        case 'ban':
          return authenticatedRequest('/api/admin/ban-user', 'POST', data);
        case 'unban':
          return authenticatedRequest('/api/admin/unban-user', 'POST', data);
        case 'suspend':
          return authenticatedRequest('/api/admin/suspend-user', 'POST', data);
        case 'force-logout':
          return authenticatedRequest('/api/admin/force-logout', 'POST', data);
        case 'reset-password':
          return authenticatedRequest('/api/admin/reset-password', 'POST', data);
      }
    },
    onSuccess: (data, variables) => {
      if (variables.action === 'reset-password') {
        setTempPassword(data.tempPassword);
        toast({ 
          title: "Password Reset Successful", 
          description: "Temporary password generated. User must change on next login."
        });
      } else {
        toast({ title: `User ${variables.action} successful` });
        setSelectedUser(null);
        setActionType(null);
        setReason('');
      }
    },
    onError: (error: unknown) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleAction = () => {
    if (!selectedUser || !actionType) return;
    if (actionType !== 'reset-password' && !reason) return;
    
    const actionData: unknown = {
      userId: selectedUser.id,
      action: actionType,
      reason: actionType === 'reset-password' ? 'Admin password reset' : reason
    };

    if (actionType === 'suspend') {
      actionData.hours = parseInt(duration);
    }

    actionMutation.mutate(actionData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-red-500" />
            User Management Actions
          </CardTitle>
          <CardDescription>Ban, suspend, or manage user accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Tier</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(users) ? users.slice(0, 10).map((user: unknown) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2">
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-gray-500">ID: {user.id}</p>
                      </div>
                    </td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">
                      <Badge className={
                        user.tier === 'pro' ? 'bg-purple-600' :
                        user.tier === 'free' ? 'bg-blue-600' :
                        user.tier === 'banned' ? 'bg-red-600' : 'bg-gray-600'
                      }>
                        {user.tier.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={user.tier === 'banned' ? 'bg-red-500' : 'bg-green-500'}>
                        {user.tier === 'banned' ? 'Banned' : 'Active'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        {user.tier !== 'banned' ? (
                          <>
                            <Button size="sm" variant="destructive" 
                              onClick={() => { setSelectedUser(user); setActionType('ban'); }}
                              data-testid={`button-ban-user-${user.id}`}>
                              <Ban className="h-3 w-3 mr-1" />
                              Ban
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => { setSelectedUser(user); setActionType('suspend'); }}
                              data-testid={`button-suspend-user-${user.id}`}>
                              <Clock3 className="h-3 w-3 mr-1" />
                              Suspend
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline"
                            onClick={() => { setSelectedUser(user); setActionType('unban'); }}
                            data-testid={`button-unban-user-${user.id}`}>
                            Unban
                          </Button>
                        )}
                        <Button size="sm" variant="outline"
                          onClick={() => actionMutation.mutate({ userId: user.id, action: 'force-logout' })}
                          data-testid={`button-logout-user-${user.id}`}>
                          Force Logout
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setSelectedUser(user); setActionType('reset-password'); }}
                          data-testid={`button-reset-password-${user.id}`}
                          className="text-orange-600 hover:text-orange-700">
                          🔑 Reset Password
                        </Button>
                      </div>
                    </td>
                  </tr>
                )) : []}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Modal */}
      {selectedUser && actionType && (
        <Card className="border-2 border-red-500/50">
          <CardHeader>
            <CardTitle className="text-red-600">
              {actionType.toUpperCase()} User: {selectedUser.username}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionType === 'suspend' && (
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Hour</SelectItem>
                    <SelectItem value="6">6 Hours</SelectItem>
                    <SelectItem value="24">24 Hours</SelectItem>
                    <SelectItem value="72">72 Hours</SelectItem>
                    <SelectItem value="168">1 Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {actionType === 'reset-password' && (
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    ⚠️ <strong>Security Notice:</strong> This will generate a temporary password that the user must change on their next login.
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    The temporary password will be displayed only once for security reasons.
                  </p>
                </div>
                {tempPassword && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <Label className="text-sm font-semibold text-green-800 dark:text-green-200">Temporary Password Generated:</Label>
                    <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border font-mono text-lg">
                      <div className="flex justify-between items-center">
                        <span className="select-all">{tempPassword}</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(tempPassword);
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          📋 Copy
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                      ✅ Share this with the user. They'll be required to change it on next login.
                    </p>
                  </div>
                )}
              </div>
            )}
            {actionType !== 'reset-password' && (
              <div className="space-y-2">
                <Label>Reason *</Label>
                <textarea 
                  className="w-full p-2 border rounded" 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-action-reason"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setSelectedUser(null); setActionType(null); setReason(''); }}
                data-testid="button-cancel-action">
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleAction}
                disabled={!reason || actionMutation.isPending}
                data-testid="button-confirm-action">
                {actionMutation.isPending ? 'Processing...' : `Confirm ${actionType.toUpperCase()}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// FEATURE 4: Content Moderation Component
function ContentModerationTab({ authenticatedRequest }: { authenticatedRequest: unknown }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: flaggedContent, refetch } = useQuery({
    queryKey: ['/api/admin/flagged-content', statusFilter],
    queryFn: () => authenticatedRequest(`/api/admin/flagged-content?status=${statusFilter}`),
  });

  const moderateMutation = useMutation({
    mutationFn: (data: unknown) => authenticatedRequest('/api/admin/moderate-content', 'POST', data),
    onSuccess: (_, variables) => {
      toast({ title: `Content ${variables.action}d successfully` });
      refetch();
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-orange-500" />
                Content Moderation
              </CardTitle>
              <CardDescription>Review and moderate flagged content</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flaggedContent?.map((flag: unknown) => (
              <div key={flag.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gray-500">{flag.content.platform}</Badge>
                      <Badge className={
                        flag.reason === 'inappropriate' ? 'bg-red-500' :
                        flag.reason === 'spam' ? 'bg-yellow-500' : 'bg-blue-500'
                      }>
                        {flag.reason}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Reported by {flag.reportedBy}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{flag.content.titles[0]}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {flag.content.preview}
                      </p>
                    </div>
                    <p className="text-sm">
                      <strong>Reason:</strong> {flag.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      Flagged {new Date(flag.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline"
                      onClick={() => moderateMutation.mutate({ flagId: flag.id, action: 'approve', reason: 'Content approved after review' })}
                      data-testid={`button-approve-content-${flag.id}`}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => moderateMutation.mutate({ flagId: flag.id, action: 'remove', reason: 'Content removed for policy violation' })}
                      data-testid={`button-remove-content-${flag.id}`}>
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!flaggedContent?.length && (
              <div className="text-center py-8 text-gray-500">
                No {statusFilter === 'all' ? '' : statusFilter} content flags found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}