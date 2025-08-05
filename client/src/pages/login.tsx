import { useState } from 'react';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; username?: string; mode: 'login' | 'signup' }) => {
      return apiRequest(`/api/auth/${data.mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      toast({
        title: view === 'login' ? "Welcome back!" : "Account created!",
        description: view === 'login' ? "You're logged in successfully." : "Your account has been created and you're logged in.",
      });
      // Store auth token/user data
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setLocation('/dashboard');
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 rounded-2xl">
                  <Sparkles className="h-12 w-12 text-white" />
                </div>
              </div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">
                PromotionPro
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                AI-powered content creation platform for content creators. Generate engaging posts, 
                protect your images, and optimize your social media presence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                <Button 
                  onClick={() => setView('signup')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 text-lg"
                >
                  Get Started Free
                </Button>
                <Button 
                  onClick={() => setView('login')}
                  variant="outline"
                  className="px-8 py-3 text-lg hover:bg-white/80"
                >
                  Sign In
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Landing */}
        <div className="text-center mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setView('landing')}
            className="text-gray-600 hover:text-gray-800"
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
            PromotionPro
          </h1>
          <p className="text-gray-600 mt-2">
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
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
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
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {view === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2.5"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending 
                  ? (view === 'login' ? 'Signing in...' : 'Creating account...')
                  : (view === 'login' ? 'Sign In' : 'Create Account')
                }
              </Button>
            </form>
            
            <div className="mt-6 text-center">
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
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Protected by industry-standard encryption</p>
        </div>
      </div>
    </div>
  );
}