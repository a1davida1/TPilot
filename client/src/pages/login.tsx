import React, { useState } from 'react';
// Password reset component removed - was non-functional
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Sparkles, Mail, Lock, User, Eye, EyeOff, Zap, Shield, Target, BarChart, Brain } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export default function Login() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<'landing' | 'login' | 'signup'>('landing');
  // Password reset state removed - was non-functional
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; username?: string; mode: 'login' | 'signup' }) => {
      return apiRequest('POST', `/api/auth/${data.mode}`, data);
    },
    onSuccess: async (response: Response) => {
      const data = await response.json();
      
      toast({
        title: view === 'login' ? "Welcome back!" : "Account created!",
        description: view === 'login' ? "You're logged in successfully." : "Your account has been created and you're logged in.",
      });
      
      // Store auth token/user data
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      // Trigger auth refetch to update useAuth state
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: view === 'login' ? "Login failed" : "Signup failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Admin login shortcut - fast access for development/admin use
    
    
    if (view === 'signup') {
      if (password !== confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure both passwords are the same.",
          variant: "destructive",
        });
        return;
      }
      if (password.length < 6) {
        toast({
          title: "Password too short",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
        return;
      }
    }

    authMutation.mutate({
      email,
      password,
      username: view === 'signup' ? username : undefined,
      mode: view === 'signup' ? 'signup' : 'login'
    });
  };

  // Landing Page View
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 rounded-2xl">
                  <Sparkles className="h-12 w-12 text-white" />
                </div>
              </div>
              <h1 className="text-7xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent mb-6">
                ThottoPilot
              </h1>
              <p className="text-xl text-gray-700 font-medium mb-8 max-w-3xl mx-auto">
                AI-powered content creation platform for content creators. Generate engaging posts, 
                protect your images, and optimize your social media presence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Button 
                  onClick={() => setView('signup')}
                  className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold px-10 py-5 text-xl shadow-2xl border-2 border-white/20 hover:shadow-purple-500/30 hover:scale-105 transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
                    boxShadow: '0 20px 40px rgba(79, 70, 229, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
                  }}
                >
                  Get Started Free
                </Button>
                <Button 
                  onClick={() => setView('login')}
                  className="bg-white/90 backdrop-blur-sm border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold px-10 py-5 text-xl shadow-xl transition-all duration-300"
                >
                  Sign In
                </Button>
              </div>
              
              <div className="text-center mb-16">
                <Button 
                  onClick={() => setLocation('/demo')}
                  variant="ghost"
                  className="bg-gray-800/10 backdrop-blur-sm text-gray-800 hover:bg-indigo-600 hover:text-white underline font-semibold text-lg px-6 py-3 rounded-full border border-gray-300 transition-all duration-300"
                >
                  Continue as Guest - Try it first
                </Button>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <Card className="text-center p-6 glass-card hover:shadow-xl transition-shadow">
                <div className="bg-blue-100 p-3 rounded-lg inline-block mb-4">
                  <Brain className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI Content Generation</h3>
                <p className="text-gray-600">Create personalized posts with AI that understands your brand and audience</p>
              </Card>
              
              <Card className="text-center p-6 glass-card hover:shadow-xl transition-shadow">
                <div className="bg-purple-100 p-3 rounded-lg inline-block mb-4">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Image Protection</h3>
                <p className="text-gray-600">Protect your photos from reverse searches while maintaining quality</p>
              </Card>
              
              <Card className="text-center p-6 glass-card hover:shadow-xl transition-shadow">
                <div className="bg-green-100 p-3 rounded-lg inline-block mb-4">
                  <Target className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Smart Targeting</h3>
                <p className="text-gray-600">Optimize content for different platforms and promotion strategies</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login/Signup Form View
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Landing */}
        <div className="text-center mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setView('landing')}
            className="text-foreground hover:text-purple-600 font-medium transition-colors duration-200"
          >
            ← Back to Home
          </Button>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-xl">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            ThottoPilot
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered content creation for creators
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center">
              {view === 'login' ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-center">
              {view === 'login' 
                ? 'Sign in to your account to continue' 
                : 'Get started with your free account'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email or Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your email or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {view === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending 
                  ? (view === 'login' ? 'Signing in...' : 'Creating account...')
                  : (view === 'login' ? 'Sign In' : 'Create Account')
                }
              </Button>
            </form>
            
            <div className="mt-6 text-center space-y-2">
              {/* Password reset feature removed - was non-functional */}
              
              <p className="text-sm text-gray-600">
                {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => setView(view === 'login' ? 'signup' : 'login')}
                  className="ml-1 text-purple-600 hover:text-purple-800 font-medium"
                >
                  {view === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
            
            {view === 'login' && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs text-purple-700 text-center">
                  <strong>Admin Access:</strong> admin@thottopilot.com / admin123
                </p>
              </div>
            )}

          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Protected by industry-standard encryption</p>
        </div>
      </div>
      
      {/* Password reset modal removed - was non-functional */}
    </div>
  );
}