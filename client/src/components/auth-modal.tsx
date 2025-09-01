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
  initialMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login' }: AuthModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>(initialMode);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [resetEmail, setResetEmail] = useState('');

  // Reset mode when modal opens
  if (isOpen && mode !== initialMode && mode !== 'forgot-password') {
    setMode(initialMode);
  }

  const authMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      
      // Prepare request data - exclude email for login mode unless signup
      const requestData = mode === 'login' 
        ? { username: data.username, password: data.password }
        : { username: data.username, email: data.email, password: data.password };
        
      return apiRequest('POST', endpoint, requestData);
    },
    onSuccess: async (response: Response) => {
      const data = await response.json();
      
      if (mode === 'login') {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully logged in.'
        });
        
        // Reset form and close modal
        setFormData({ username: '', email: '', password: '' });
        onSuccess();
        
        // Refresh the page to update auth state with HttpOnly cookies
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account before logging in.'
        });
        
        // Switch to login mode for verification
        setMode('login');
        setFormData({ username: '', email: '', password: '' });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Authentication failed. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send reset email');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Reset Email Sent',
        description: 'Please check your email for password reset instructions.'
      });
      setMode('login');
      setResetEmail('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset email. Please try again.',
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
      url: '', // Handled in handleSocialAuth
      handler: async () => {
        try {
          const response = await fetch('/api/reddit/connect', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          const data = await response.json();
          if (data.authUrl) {
            window.location.href = data.authUrl;
          }
        } catch (error) {
          console.error('Failed to connect Reddit:', error);
        }
      }
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <FaFacebook className="h-5 w-5" />,
      color: 'bg-blue-600 hover:bg-blue-700',
      url: '/api/auth/facebook'
    }
  ];

  // Validation functions
  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.username.trim()) {
      errors.push('Username is required');
    } else if (formData.username.length < 3) {
      errors.push('Username must be at least 3 characters');
    } else if (formData.username.length > 50) {
      errors.push('Username must be less than 50 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      errors.push('Username can only contain letters, numbers, underscores and hyphens');
    }
    
    if (mode === 'signup') {
      if (!formData.email.trim()) {
        errors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.push('Please enter a valid email address');
      }
    }
    
    if (!formData.password.trim()) {
      errors.push('Password is required');
    } else if (formData.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    } else if (!/(?=.*[a-z])/.test(formData.password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (!/(?=.*[A-Z])/.test(formData.password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (!/(?=.*\d)/.test(formData.password)) {
      errors.push('Password must contain at least one number');
    }
    
    return errors;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: validationErrors[0],
        variant: 'destructive'
      });
      return;
    }
    
    authMutation.mutate(formData);
  };

  const handleSocialAuth = (url: string) => {
    // Store auth intent for callback handling
    localStorage.setItem('authIntent', 'social');
    localStorage.setItem('authReturnUrl', window.location.pathname);
    window.location.href = url;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-md w-full relative overflow-hidden shadow-2xl">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-pink-600/10 to-purple-600/10 opacity-30" />
        
        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
              </h2>
              <p className="text-sm text-foreground mt-1">
                {mode === 'login' 
                  ? 'Sign in to access your content' 
                  : mode === 'signup' ? 'Join ThottoPilot today'
                  : 'Enter your email to receive reset instructions'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Social Auth - Hide for forgot password */}
          {mode !== 'forgot-password' && (
            <>
              <div className="space-y-3 mb-6">
                {socialProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    onClick={() => {
                      if ((provider as any).handler) {
                        (provider as any).handler();
                      } else if (provider.url) {
                        handleSocialAuth(provider.url);
                      }
                    }}
                    className={`w-full ${provider.color} text-white border-0`}
                  >
                    {provider.icon}
                    <span className="ml-2">Continue with {provider.name}</span>
                  </Button>
                ))}
              </div>

              <div className="relative mb-6">
                <Separator className="bg-border" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-card px-3 text-sm text-foreground">
                  or
                </span>
              </div>
            </>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot-password' ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (resetEmail.trim()) {
                forgotPasswordMutation.mutate(resetEmail);
              }
            }} className="space-y-4">
              <div>
                <Label htmlFor="reset-email" className="text-foreground font-medium">
                  Email Address
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10 bg-background border-input text-foreground focus:border-purple-500"
                    placeholder="Enter your email address"
                    required
                    data-testid="input-reset-email"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                data-testid="button-send-reset"
              >
                {forgotPasswordMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Reset Email
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  data-testid="button-back-to-login"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : (
            /* Login/Signup Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-foreground font-medium">
                {mode === 'login' ? 'Username or Email' : 'Username'}
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="pl-10 bg-background border-input text-foreground focus:border-purple-500"
                  placeholder={mode === 'login' ? 'Username or email address' : 'Enter your username'}
                  required
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <Label htmlFor="email" className="text-foreground font-medium">
                  Email
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 bg-background border-input text-foreground focus:border-purple-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-foreground font-medium">
                Password
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 bg-background border-input text-foreground focus:border-purple-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Forgot Password Link for Login */}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
            )}

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
          )}

          {/* Toggle mode - Only show for login/signup */}
          {mode !== 'forgot-password' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-foreground">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="ml-2 text-primary hover:text-primary/80 font-medium"
                  aria-label={mode === 'login' ? 'Switch to sign up form' : 'Switch to sign in form'}
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          )}

          {/* Benefits for signup */}
          {mode === 'signup' && (
            <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                <Sparkles className="h-4 w-4 mr-2" />
                Pro Benefits Include:
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
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