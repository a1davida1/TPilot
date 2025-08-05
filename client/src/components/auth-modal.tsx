import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FaGoogle, FaFacebook, FaReddit } from "react-icons/fa";
import { 
  X, 
  Mail, 
  Lock, 
  User,
  ArrowRight,
  Sparkles,
  CheckCircle
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const authMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Authentication failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: mode === 'login' ? 'Welcome back!' : 'Account created!',
        description: mode === 'login' 
          ? 'You have successfully logged in.' 
          : 'Your account has been created successfully.'
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Authentication failed. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const socialProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: <FaGoogle className="h-5 w-5" />,
      color: 'bg-red-500 hover:bg-red-600',
      url: '/api/auth/google'
    },
    {
      id: 'reddit',
      name: 'Reddit',
      icon: <FaReddit className="h-5 w-5" />,
      color: 'bg-orange-500 hover:bg-orange-600',
      url: '/api/auth/reddit'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <FaFacebook className="h-5 w-5" />,
      color: 'bg-blue-600 hover:bg-blue-700',
      url: '/api/auth/facebook'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate(formData);
  };

  const handleSocialAuth = (url: string) => {
    window.location.href = url;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 max-w-md w-full relative overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-purple-600/20 opacity-50" />
        
        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {mode === 'login' 
                  ? 'Sign in to access your content' 
                  : 'Join ThottoPilot today'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Social Auth */}
          <div className="space-y-3 mb-6">
            {socialProviders.map((provider) => (
              <Button
                key={provider.id}
                onClick={() => handleSocialAuth(provider.url)}
                className={`w-full ${provider.color} text-white border-0`}
              >
                {provider.icon}
                <span className="ml-2">Continue with {provider.name}</span>
              </Button>
            ))}
          </div>

          <div className="relative mb-6">
            <Separator className="bg-gray-800" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-gray-900 px-3 text-sm text-gray-500">
              or
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-gray-300">
                Username
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-white focus:border-purple-500"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <Label htmlFor="email" className="text-gray-300">
                  Email (optional)
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 bg-gray-800/50 border-gray-700 text-white focus:border-purple-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-gray-300">
                Password
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-white focus:border-purple-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={authMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {authMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="ml-2 text-purple-400 hover:text-purple-300 font-medium"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Benefits for signup */}
          {mode === 'signup' && (
            <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-800/50">
              <h4 className="text-sm font-medium text-purple-300 mb-2 flex items-center">
                <Sparkles className="h-4 w-4 mr-2" />
                Pro Benefits Include:
              </h4>
              <ul className="space-y-1 text-xs text-purple-300/80">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Unlimited AI content generation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Advanced fine-tuning options
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Sample library & personalization
                </li>
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}