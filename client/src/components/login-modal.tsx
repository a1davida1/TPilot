import { useState, useId } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogIn, UserPlus, Sparkles } from "lucide-react";
import { SocialLoginButtons } from "./social-login-buttons";
import { Link } from "wouter";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: unknown) => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const errorId = useId();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      const data = await apiRequest<{ accessToken?: string; token?: string; user: { username: string; id?: number }; userId?: number; mustChangePassword?: boolean }>("POST", "/api/auth/login", {
        username,
        password
      });

      // Check for temporary password status
      if (data.mustChangePassword) {
        toast({
          title: "Password Change Required",
          description: "You must change your temporary password before continuing.",
        });
        onClose();
        // Redirect to password change page with userId
        window.location.href = `/change-password?userId=${data.userId}`;
        return;
      }

      // Phase 3: Store access token in memory only
      const { setAccessToken } = await import('@/lib/auth');
      setAccessToken(data.accessToken || data.token);
      
      // Keep user data in localStorage for now (non-sensitive)
      localStorage.setItem("user", JSON.stringify(data.user));
      
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.username}`,
      });

      onSuccess(data.user);
      onClose();
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if user agreed to terms
    if (!agreeToTerms) {
      toast({
        title: "Agreement Required",
        description: "You must agree to the Terms of Service to create an account",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const data = await apiRequest<{ accessToken?: string; token?: string; user: { username: string; id?: number; email?: string } }>("POST", "/api/auth/signup", {
        username,
        email,
        password
      });

      // Phase 3: Store access token in memory only
      const { setAccessToken } = await import('@/lib/auth');
      setAccessToken(data.accessToken || data.token);

      // Keep user data in localStorage for now (non-sensitive)
      localStorage.setItem("user", JSON.stringify(data.user));

      // Apply referral code if one was stored
      const referralCode = localStorage.getItem('referralCode');
      if (referralCode && data.user?.id) {
        try {
          await apiRequest("POST", "/api/referral/apply", {
            referralCode,
            applicant: {
              email: email,
              userId: data.user.id
            }
          });
          localStorage.removeItem('referralCode'); // Clear after successful application
        } catch (referralError) {
          console.error('Failed to apply referral code:', referralError);
          // Don't block signup if referral fails - just log it
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to ThottoPilot",
      });

      onSuccess(data.user);
      onClose();
    } catch (error) {
      toast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Could not create account",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[425px] bg-gray-900 border-purple-500/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-400" />
            ThottoPilot
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger value="login" className="data-[state=active]:bg-purple-600">
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-purple-600">
              <UserPlus className="h-4 w-4 mr-2" />
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 mt-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setErrors({});
                setIsLoading(true);
                void handleLogin(e).catch(() =>
                  setErrors({ form: 'Login failed. Check credentials.' })
                ).finally(() => setIsLoading(false));
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? `${errorId}-username` : undefined}
                  className="bg-gray-800 border-purple-500/20 text-white"
                />
                {errors.username && (
                  <span
                    id={`${errorId}-username`}
                    role="alert"
                    aria-live="polite"
                    className="text-sm text-red-500"
                  >
                    {errors.username}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="bg-gray-800 border-purple-500/20 text-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <div aria-live="polite" className="sr-only">
                {isLoading && 'Logging in, please wait'}
              </div>
            </form>

            {/* Quick test login */}
            <div className="text-center text-xs text-gray-500">
              Test account: admin@thottopilot.com / Admin123
            </div>
            
            {/* Social login buttons */}
            <div className="mt-6">
              <SocialLoginButtons onClose={onClose} />
            </div>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username" className="text-gray-300">Username</Label>
                <Input
                  id="signup-username"
                  name="username"
                  type="text"
                  required
                  className="bg-gray-800 border-purple-500/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-gray-300">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  className="bg-gray-800 border-purple-500/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-gray-300">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="bg-gray-800 border-purple-500/20 text-white"
                />
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                  className="border-purple-500/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  data-testid="checkbox-agree-terms"
                />
                <div className="space-y-1 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm text-gray-300 cursor-pointer"
                  >
                    I agree to the{" "}
                    <Link href="/terms" className="underline text-purple-400 hover:text-purple-300">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline text-purple-400 hover:text-purple-300">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading || !agreeToTerms}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-create-account"
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
            
            {/* Social login buttons */}
            <div className="mt-6">
              <SocialLoginButtons onClose={onClose} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center text-xs text-gray-400 mt-4">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-300">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-gray-300">
            Privacy Policy
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}