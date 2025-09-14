import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone, Download, Wifi, WifiOff, Battery, Signal, Share2, 
  Home, Settings, Bell, Moon, Sun, Zap, Shield, Target
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed'; platform: string[] }>;
}

interface PWAFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'available' | 'beta' | 'coming-soon';
  enabled: boolean;
}

export default function MobilePWA() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [networkType, setNetworkType] = useState<string>('unknown');
  
  const { toast } = useToast();

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      if ('getInstalledRelatedApps' in navigator) {
        (navigator as any).getInstalledRelatedApps().then((apps: unknown[]) => {
          setIsInstalled(apps.length > 0);
        });
      }
    };

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Get battery status
    const getBatteryInfo = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
        } catch (error) {
          console.log('Battery API not available');
        }
      }
    };

    // Get network type
    const getNetworkInfo = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        setNetworkType(connection.effectiveType || 'unknown');
      }
    };

    checkInstalled();
    getBatteryInfo();
    getNetworkInfo();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pwaFeatures: PWAFeature[] = [
    {
      id: 'offline-mode',
      title: 'Offline Content Creation',
      description: 'Create and edit content even without internet connection',
      icon: <WifiOff className="h-5 w-5" />,
      status: 'available',
      enabled: true
    },
    {
      id: 'push-notifications',
      title: 'Smart Notifications',
      description: 'Get notified about optimal posting times and engagement',
      icon: <Bell className="h-5 w-5" />,
      status: 'available',
      enabled: true
    },
    {
      id: 'quick-actions',
      title: 'Quick Actions',
      description: 'Access key features directly from your home screen',
      icon: <Zap className="h-5 w-5" />,
      status: 'available',
      enabled: true
    },
    {
      id: 'background-sync',
      title: 'Background Sync',
      description: 'Upload content automatically when connection is restored',
      icon: <Shield className="h-5 w-5" />,
      status: 'beta',
      enabled: false
    },
    {
      id: 'camera-integration',
      title: 'Camera Integration',
      description: 'Take photos directly in the app with built-in editing tools',
      icon: <Target className="h-5 w-5" />,
      status: 'coming-soon',
      enabled: false
    },
    {
      id: 'location-services',
      title: 'Location-Based Content',
      description: 'Optimize content based on your location and local trends',
      icon: <Target className="h-5 w-5" />,
      status: 'coming-soon',
      enabled: false
    }
  ];

  const handleInstallApp = async () => {
    if (!installPrompt) {
      toast({
        title: "Installation Not Available",
        description: "The app installation prompt is not available in this browser.",
        variant: "destructive",
      });
      return;
    }

    const result = await installPrompt.prompt();
    
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      toast({
        title: "App Installed!",
        description: "ThottoPilot has been added to your home screen.",
      });
    }
  };

  const shareApp = async () => {
    if ('share' in navigator) {
      try {
        await navigator.share({
          title: 'ThottoPilot - AI Content Creation',
          text: 'Check out this amazing AI-powered content creation platform!',
          url: window.location.href
        });
      } catch (error) {
        // Fallback to clipboard
        (navigator as any).clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "App URL has been copied to your clipboard.",
        });
      }
    } else {
      (navigator as any).clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "App URL has been copied to your clipboard.",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'beta': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'coming-soon': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Mobile & PWA Features</h2>
          <p className="text-gray-400">Enhanced mobile experience and app-like functionality</p>
        </div>
        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
      </div>

      {/* Device Status */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Smartphone className="h-5 w-5 text-blue-400" />
            <span>Device Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-400" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
                <p className="text-xs text-gray-400">
                  Network: {networkType}
                </p>
              </div>
            </div>

            {batteryLevel !== null && (
              <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                <Battery className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {batteryLevel}%
                  </p>
                  <p className="text-xs text-gray-400">Battery</p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
              <Signal className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">
                  {isInstalled ? 'Installed' : 'Web App'}
                </p>
                <p className="text-xs text-gray-400">App Status</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
              <Home className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium text-white">PWA Ready</p>
                <p className="text-xs text-gray-400">Features Active</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      {!isInstalled && (
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Download className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-400">
            <div className="flex items-center justify-between">
              <div>
                <strong>Install ThottoPilot</strong>
                <p className="text-sm text-gray-300 mt-1">
                  Add to your home screen for a native app experience with offline support.
                </p>
              </div>
              <div className="flex space-x-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={shareApp}
                  className="border-blue-500/30 text-blue-400"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
                {installPrompt && (
                  <Button
                    size="sm"
                    onClick={handleInstallApp}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Install
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Offline Mode Notice */}
      {!isOnline && (
        <Alert className="bg-orange-500/10 border-orange-500/20">
          <WifiOff className="h-4 w-4 text-orange-400" />
          <AlertDescription className="text-orange-400">
            <strong>Offline Mode Active</strong> - You can continue creating content. Changes will sync when you're back online.
          </AlertDescription>
        </Alert>
      )}

      {/* PWA Features */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white">Progressive Web App Features</CardTitle>
          <CardDescription>
            Enhanced mobile functionality for a native app experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pwaFeatures.map((feature) => (
              <Card key={feature.id} className="bg-gray-700 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-purple-600/20 rounded-lg">
                      {feature.icon}
                    </div>
                    <Badge className={getStatusColor(feature.status)} variant="outline">
                      {feature.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  
                  <h4 className="font-medium text-white mb-1">{feature.title}</h4>
                  <p className="text-sm text-gray-400 mb-3">{feature.description}</p>
                  
                  {feature.status === 'available' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-400">Ready to use</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-purple-400 hover:text-purple-300"
                      >
                        Configure
                      </Button>
                    </div>
                  )}
                  
                  {feature.status === 'beta' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-yellow-400">Beta testing</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-yellow-400 hover:text-yellow-300"
                      >
                        Join Beta
                      </Button>
                    </div>
                  )}
                  
                  {feature.status === 'coming-soon' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">In development</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-400"
                        disabled
                      >
                        Coming Soon
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white">Mobile Quick Actions</CardTitle>
          <CardDescription>
            Optimized shortcuts for mobile content creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2 border-purple-500/20 hover:border-purple-500/40"
            >
              <Zap className="h-6 w-6 text-purple-400" />
              <span className="text-sm">Quick Create</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2 border-purple-500/20 hover:border-purple-500/40"
            >
              <Shield className="h-6 w-6 text-blue-400" />
              <span className="text-sm">Protect Image</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2 border-purple-500/20 hover:border-purple-500/40"
            >
              <Target className="h-6 w-6 text-green-400" />
              <span className="text-sm">View Analytics</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2 border-purple-500/20 hover:border-purple-500/40"
            >
              <Settings className="h-6 w-6 text-gray-400" />
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white">Mobile Performance Tips</CardTitle>
          <CardDescription>
            Optimize your experience on mobile devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-gray-700 rounded-lg">
            <Zap className="h-4 w-4 text-yellow-400 mt-1" />
            <div>
              <h5 className="font-medium text-white text-sm">Enable Offline Mode</h5>
              <p className="text-xs text-gray-400">Continue working even without internet connection</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-700 rounded-lg">
            <Bell className="h-4 w-4 text-blue-400 mt-1" />
            <div>
              <h5 className="font-medium text-white text-sm">Smart Notifications</h5>
              <p className="text-xs text-gray-400">Get notified about optimal posting times</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-700 rounded-lg">
            <Battery className="h-4 w-4 text-green-400 mt-1" />
            <div>
              <h5 className="font-medium text-white text-sm">Battery Optimization</h5>
              <p className="text-xs text-gray-400">Background sync reduces battery usage</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}