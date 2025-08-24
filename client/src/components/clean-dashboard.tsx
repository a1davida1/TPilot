import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  User, 
  Settings, 
  Crown, 
  LogOut,
  Menu,
  X,
  PenTool,
  TrendingUp,
  BookOpen,
  Calculator,
  Shield,
  Brain,
  PlayCircle,
  Zap,
  BarChart3 as BarChart,
  ImageIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UnifiedContentCreator } from '@/components/unified-content-creator';
import { GettingStarted } from '@/components/getting-started';
import TaxTracker from '@/pages/tax-tracker';
import { ImageProtector } from '@/components/image-protector';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';
import { RedditCommunities } from '@/components/reddit-communities';
import { RedditAccounts } from '@/components/reddit-accounts';
import { ImageGallery } from '@/components/image-gallery';
import { TrendingTags } from '@/components/trending-tags';
import { ProPerks } from '@/components/pro-perks';

interface CleanDashboardProps {
  isGuestMode?: boolean;
  user?: any;
  userTier?: 'guest' | 'free' | 'pro' | 'premium';
}

export function CleanDashboard({ isGuestMode = false, user, userTier = 'free' }: CleanDashboardProps) {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = window.innerWidth < 768;

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.reload();
  };

  // Clean navigation structure matching the trial UI
  const navigationItems = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen, badge: 'NEW' },
    { id: 'generator', label: 'Content Creator', icon: PenTool, badge: null },
    { id: 'gallery', label: 'Image Gallery', icon: ImageIcon, badge: null },
    { id: 'protect', label: 'Image Shield', icon: Shield, badge: 'PRO', proOnly: true },
    { id: 'reddit', label: 'Reddit Communities', icon: TrendingUp, badge: null },
    { id: 'reddit-accounts', label: 'Connect Reddit', icon: PlayCircle, badge: null },
    { id: 'trending', label: 'Trending Tags', icon: Zap, badge: null },
    { id: 'analytics', label: 'Analytics', icon: BarChart, badge: 'PRO', proOnly: true },
    { id: 'tax', label: 'Tax Tracker', icon: Calculator, badge: null },
    { id: 'perks', label: 'Pro Perks', icon: Crown, badge: '$1,247 Value' },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'getting-started':
        return (
          <div className="max-w-4xl mx-auto">
            <GettingStarted 
              userTier={userTier} 
              onSectionSelect={(section) => setActiveSection(section)} 
            />
          </div>
        );
      
      case 'generator':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Content Creator</h1>
              <p className="text-gray-600">Generate engaging content for your social media platforms</p>
            </div>
            <UnifiedContentCreator isGuestMode={isGuestMode} userTier={userTier} />
          </div>
        );
      
      case 'gallery':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Image Gallery</h1>
              <p className="text-gray-600">Manage and organize your content images</p>
            </div>
            <ImageGallery />
          </div>
        );
      
      case 'protect':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Image Shield</h1>
              <p className="text-gray-600">Protect your images from theft and reverse search</p>
            </div>
            <ImageProtector userTier={userTier} />
          </div>
        );
      
      case 'analytics':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Analytics</h1>
              <p className="text-gray-600">Track your content performance and engagement</p>
            </div>
            <AnalyticsDashboard isGuestMode={userTier === 'guest'} />
          </div>
        );
      
      case 'reddit':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Reddit Communities</h1>
              <p className="text-gray-600">Discover and join relevant Reddit communities</p>
            </div>
            <RedditCommunities />
          </div>
        );
      
      case 'reddit-accounts':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Connect Reddit</h1>
              <p className="text-gray-600">Connect your Reddit accounts for automated posting</p>
            </div>
            <RedditAccounts />
          </div>
        );
      
      case 'trending':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Trending Tags</h1>
              <p className="text-gray-600">Discover trending hashtags and topics</p>
            </div>
            <TrendingTags />
          </div>
        );
      
      case 'tax':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Tax Tracker</h1>
              <p className="text-gray-600">Track business expenses and tax deductions</p>
            </div>
            <TaxTracker userTier={userTier} />
          </div>
        );
      
      case 'perks':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Pro Perks</h1>
              <p className="text-gray-600">Exclusive benefits and features for Pro members</p>
            </div>
            <ProPerks userTier={userTier} />
          </div>
        );
      
      default:
        return (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="mb-8">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to ThottoPilot</h2>
              <p className="text-gray-600 mb-8">
                Your complete platform for content creation, protection, and monetization.
              </p>
              <Button 
                onClick={() => setActiveSection('generator')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Start Creating Content
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Clean Sidebar - matching trial UI */}
      <motion.div
        initial={{ x: isMobile ? -280 : 0 }}
        animate={{ x: isMobile && !sidebarOpen ? -280 : 0 }}
        className={cn(
          "relative bg-white border-r border-gray-200 shadow-sm",
          isMobile ? "absolute z-40 h-full w-64" : "w-64"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Clean Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-gray-900 font-semibold text-lg">ThottoPilot</span>
              </div>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Clean Navigation */}
          <div className="flex-1 p-4 space-y-1">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isDisabled = item.proOnly && (userTier === 'guest' || userTier === 'free');
              
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-12 text-left font-medium",
                    activeSection === item.id 
                      ? "bg-purple-50 text-purple-700 border-r-2 border-purple-600" 
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                    isDisabled && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={() => !isDisabled && setActiveSection(item.id)}
                  disabled={isDisabled}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <IconComponent className="h-5 w-5" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-xs",
                          item.badge === 'PRO' ? "bg-purple-100 text-purple-700" :
                          item.badge === 'NEW' ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-600"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                    {isDisabled && <Crown className="h-4 w-4 text-yellow-500" />}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Clean User Section */}
          <div className="p-4 border-t border-gray-100">
            {userTier === 'guest' ? (
              <div className="space-y-2">
                <Button 
                  variant="outline"
                  className="w-full justify-center"
                  size="sm"
                >
                  Sign In
                </Button>
                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="sm"
                >
                  Get Started
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user?.username || 'User'}</div>
                    <div className="text-xs text-gray-500 capitalize">{userTier} Plan</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {userTier === 'free' && (
                    <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700">
                      <Crown className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Clean Upgrade Section for Free Users */}
          {(userTier === 'free' || userTier === 'guest') && (
            <div className="p-4 border-t border-gray-100">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-gray-900">Upgrade to Pro</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Unlock unlimited generations, advanced features, and priority support.
                </p>
                <Button 
                  size="sm" 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  Get Pro Access
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Clean Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <div className="bg-white border-b border-gray-200 p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Clean Content Area */}
        <main className="flex-1 overflow-auto bg-white">
          <div className="min-h-full py-8 px-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}