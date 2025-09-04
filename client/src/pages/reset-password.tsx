import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { ThottoPilotLogo } from "@/components/thottopilot-logo";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  // Extract token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (!tokenParam) {
      toast({
        title: "Invalid reset link",
        description: "The password reset link is missing or invalid.",
        variant: "destructive"
      });
      setLocation('/login');
      return;
    }
    
    // IMPORTANT: Decode the token (it's URL-encoded in the email)
    const decodedToken = decodeURIComponent(tokenParam);
    setToken(decodedToken);
  }, [setLocation, toast]);

  const resetMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      return apiRequest('POST', '/api/auth/reset-password', data);
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Password reset successful!",
        description: "You can now login with your new password.",
      });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation('/login');
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Could not reset password. The link may be expired.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive"
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }
    
    resetMutation.mutate({ token, newPassword });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ThottoPilotLogo />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6" />
              Password Reset Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                Your password has been successfully reset! You will be redirected to the login page shortly.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => setLocation('/login')}
              className="w-full mt-4"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ThottoPilotLogo />
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Reset Your Password
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your new password below
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Confirm new password"
                data-testid="input-confirm-password"
              />
            </div>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <Alert variant="destructive">
                <AlertDescription>
                  Passwords don't match
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || resetMutation.isPending}
              data-testid="button-reset-password"
            >
              {resetMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation('/login')}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}