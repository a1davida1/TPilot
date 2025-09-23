import { useState } from 'react';
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

export default function SettingsPage() {
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [defaultPlatform, setDefaultPlatform] = useState('reddit');
  const [apiUsage] = useState({ used: 0, limit: 1000 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: _userSettings } = useQuery({
    queryKey: ['/api/user/settings'],
  });

  const { data: subscriptionData } = useQuery<{
    subscription: { id: string; status: string; plan: string; nextBillDate?: string; amount?: number } | null;
    isPro: boolean;
    tier: string;
  }>({
    queryKey: ['/api/subscription'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      return apiRequest('PATCH', '/api/user/settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
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
      a.download = `promotionpro-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Data exported",
        description: "Your data has been downloaded.",
      });
    }
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      theme,
      notifications,
      emailUpdates,
      autoSave,
      defaultPlatform
    });
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
                  <Settings className="mr-2 h-6 w-6 text-blue-600" />
                  Settings
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          
          {/* Subscription Status */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Crown className="h-5 w-5 mr-2 text-yellow-600" />
                Subscription & Usage
              </CardTitle>
              <CardDescription>
                Manage your plan and monitor API usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Current Plan</h3>
                  <p className="text-sm text-gray-600">
                    {subscriptionData?.subscription?.plan === 'admin' ? 'Admin' : 
                     subscriptionData?.subscription?.plan || 'Free'} Plan
                  </p>
                </div>
                <div className="text-right">
                  <Badge 
                    className={`mb-2 ${
                      subscriptionData?.subscription?.plan === 'admin' ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white' :
                      subscriptionData?.subscription?.plan === 'pro' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' :
                      subscriptionData?.subscription?.plan === 'starter' ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' :
                      'bg-gray-100 text-gray-800 border border-gray-300'
                    }`}
                  >
                    {subscriptionData?.subscription?.plan === 'admin' ? 'ADMIN' : 
                     subscriptionData?.subscription?.plan === 'free' ? 'Free' : 
                     subscriptionData?.subscription?.plan || 'Free'}
                  </Badge>
                  <br />
                  {subscriptionData?.subscription?.plan !== 'admin' && (
                    <Button onClick={handleUpgrade} className="bg-gradient-to-r from-purple-600 to-blue-600">
                      <Zap className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </Button>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">API Usage This Month</span>
                  <span className="text-sm text-gray-600">{apiUsage.used} / {apiUsage.limit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(apiUsage.used / apiUsage.limit) * 100}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Settings */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
              </div>
            </CardContent>
          </Card>

          {/* App Preferences */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="h-5 w-5 mr-2 text-blue-600" />
                App Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <p className="text-sm text-gray-600">Choose your preferred theme</p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center">
                        <Sun className="h-4 w-4 mr-2" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center">
                        <Moon className="h-4 w-4 mr-2" />
                        Dark
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="defaultPlatform">Default Platform</Label>
                  <p className="text-sm text-gray-600">Your preferred content platform</p>
                </div>
                <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoSave">Auto-save content</Label>
                  <p className="text-sm text-gray-600">Automatically save generated content</p>
                </div>
                <Switch
                  id="autoSave"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2 text-blue-600" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">Push notifications</Label>
                  <p className="text-sm text-gray-600">Get notified about important updates</p>
                </div>
                <Switch
                  id="notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailUpdates">Email updates</Label>
                  <p className="text-sm text-gray-600">Receive product updates via email</p>
                </div>
                <Switch
                  id="emailUpdates"
                  checked={emailUpdates}
                  onCheckedChange={setEmailUpdates}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-600" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                <Key className="h-4 w-4 mr-2" />
                Change Password
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => exportDataMutation.mutate()}
                disabled={exportDataMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Export My Data
              </Button>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                Billing & Payment
              </CardTitle>
              <CardDescription>
                Manage your subscription and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Payment Method</h4>
                    <p className="text-sm text-gray-600">
                      {subscriptionData?.subscription?.plan === 'free' ? 
                        'No payment method on file' : 
                        'Card ending in •••• (managed by Stripe)'}
                    </p>
                  </div>
                  {subscriptionData?.subscription?.plan !== 'free' && (
                    <Button variant="outline" size="sm">
                      Update Card
                    </Button>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Billing History</h4>
                  <p className="text-sm text-gray-600">
                    View and download your past invoices
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    View Billing History
                  </Button>
                </div>
                
                {subscriptionData?.subscription?.plan !== 'free' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Cancel Subscription</h4>
                      <p className="text-sm text-gray-600">
                        Cancel your subscription at any time. You&apos;ll retain access until the end of your billing period.
                      </p>
                      <Button variant="outline" size="sm" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                        Cancel Subscription
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="shadow-lg border-red-200 bg-red-50/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-red-600">
                <Trash2 className="h-5 w-5 mr-2" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                    deleteAccountMutation.mutate();
                  }
                }}
                disabled={deleteAccountMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}