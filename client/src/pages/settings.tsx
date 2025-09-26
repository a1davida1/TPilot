import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  Moon, 
  Sun, 
  Globe, 
  Download, 
  Trash2, 
  Key,
  ArrowLeft,
  Crown,
  Zap
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

type UserSettingsResponse = {
  theme?: string;
  notifications?: boolean;
  emailUpdates?: boolean;
  autoSave?: boolean;
  defaultPlatform?: string;
  defaultStyle?: string;
  watermarkPosition?: string;
};

type UpdateSettingsResponse = {
  success: boolean;
  settings: UserSettingsResponse;
};

type UserSettingsPayload = {
  theme: string;
  notifications: boolean;
  emailUpdates: boolean;
  autoSave: boolean;
  defaultPlatform: string;
};

export default function SettingsPage() {
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [defaultPlatform, setDefaultPlatform] = useState('reddit');
  const [apiUsage] = useState({ used: 0, limit: 1000 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userSettings } = useQuery<UserSettingsResponse>({
    queryKey: ['/api/user/settings'],
  });

  const { data: subscriptionData } = useQuery<{
    subscription: { id: string; status: string; plan: string; nextBillDate?: string; amount?: number } | null;
    isPro: boolean;
    tier: string;
  }>({
    queryKey: ['/api/subscription'],
  });

  useEffect(() => {
    if (!userSettings) {
      return;
    }

    setTheme(userSettings.theme ?? 'light');
    setNotifications(userSettings.notifications ?? true);
    setEmailUpdates(userSettings.emailUpdates ?? true);
    setAutoSave(userSettings.autoSave ?? true);
    setDefaultPlatform(userSettings.defaultPlatform ?? 'reddit');
  }, [userSettings]);

  const updateSettingsMutation = useMutation<UpdateSettingsResponse, Error, UserSettingsPayload>({
    mutationFn: async (settings) => {
      const response = await apiRequest('PATCH', '/api/user/settings', settings);
      return response.json() as Promise<UpdateSettingsResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user/settings'], data.settings);
      setTheme(data.settings.theme ?? 'light');
      setNotifications(data.settings.notifications ?? true);
      setEmailUpdates(data.settings.emailUpdates ?? true);
      setAutoSave(data.settings.autoSave ?? true);
      setDefaultPlatform(data.settings.defaultPlatform ?? 'reddit');
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved.",
      });
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', '/api/user/account');
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setLocation('/login');
    }
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/user/export');
      return response.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thottopilot-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Data exported",
        description: "Your data has been downloaded.",
      });
    }
  });

  const handleSaveSettings = () => {
    const payload: UserSettingsPayload = {
      theme,
      notifications,
      emailUpdates,
      autoSave,
      defaultPlatform
    };

    updateSettingsMutation.mutate(payload);
  };

  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    // Navigate to Stripe checkout page
    const selectedPlan = subscriptionData?.subscription?.plan === 'free' ? 'pro' : 'pro_plus';
    setLocation(`/checkout?plan=${selectedPlan}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Settings className="mr-2 h-6 w-6" />
                  Settings
                </h1>
                <p className="text-sm text-gray-600">Manage your account preferences and settings</p>
              </div>
            </div>
            {subscriptionData?.isPro ? (
              <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                PRO USER
              </Badge>
            ) : (
              <Button onClick={handleUpgrade} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Account Settings
            </CardTitle>
            <CardDescription>
              Manage your profile and account preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Settings */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Theme</Label>
                <div className="text-sm text-muted-foreground">
                  Choose how ThottoPilot looks to you
                </div>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center">
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center">
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Default Platform */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Default Platform</Label>
                <div className="text-sm text-muted-foreground">
                  Your preferred platform for content generation
                </div>
              </div>
              <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="onlyfans">OnlyFans</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <div className="text-sm text-muted-foreground">
                  Receive notifications about content generation and account updates
                </div>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Updates</Label>
                <div className="text-sm text-muted-foreground">
                  Get notified about new features and important updates
                </div>
              </div>
              <Switch
                checked={emailUpdates}
                onCheckedChange={setEmailUpdates}
              />
            </div>
          </CardContent>
        </Card>

        {/* Content Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              Content Settings
            </CardTitle>
            <CardDescription>
              Customize your content creation experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-Save Drafts</Label>
                <div className="text-sm text-muted-foreground">
                  Automatically save your work as you create content
                </div>
              </div>
              <Switch
                checked={autoSave}
                onCheckedChange={setAutoSave}
              />
            </div>
          </CardContent>
        </Card>

        {/* API Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="mr-2 h-5 w-5" />
              API Usage
            </CardTitle>
            <CardDescription>
              Monitor your AI generation usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generations Used</span>
                <span>{apiUsage.used} / {apiUsage.limit}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" 
                  style={{ width: `${(apiUsage.used / apiUsage.limit) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Resets monthly • {subscriptionData?.isPro ? 'Unlimited' : 'Upgrade for more'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Info */}
        {subscriptionData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>
                Manage your billing and subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Current Plan</span>
                  <Badge variant={subscriptionData.isPro ? "default" : "outline"}>
                    {subscriptionData.tier.toUpperCase()}
                  </Badge>
                </div>

                {subscriptionData.subscription?.nextBillDate && (
                  <div className="flex items-center justify-between">
                    <span>Next Billing Date</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(subscriptionData.subscription.nextBillDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {!subscriptionData.isPro && (
                  <Button 
                    onClick={handleUpgrade} 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Data & Privacy
            </CardTitle>
            <CardDescription>
              Manage your data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              onClick={() => exportDataMutation.mutate()}
              disabled={exportDataMutation.isPending}
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              {exportDataMutation.isPending ? 'Exporting...' : 'Export My Data'}
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                  deleteAccountMutation.mutate();
                }
              }}
              disabled={deleteAccountMutation.isPending}
              className="w-full justify-start"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete Account'}
            </Button>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}