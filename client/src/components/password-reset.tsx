import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Mail, ArrowLeft } from "lucide-react";

interface PasswordResetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PasswordReset({ isOpen, onClose }: PasswordResetProps) {
  const [step, setStep] = useState<'request' | 'sent'>('request');
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const resetMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', '/api/auth/forgot-password', { email });
    },
    onSuccess: () => {
      setStep('sent');
      toast({
        title: "Reset email sent!",
        description: "Check your email for password reset instructions.",
      });
    },
    onError: (error) => {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Could not send reset email",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      resetMutation.mutate(email);
    }
  };

  const handleClose = () => {
    setStep('request');
    setEmail('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 border-purple-500/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
            <Mail className="h-6 w-6 text-purple-400" />
            Password Reset
          </DialogTitle>
        </DialogHeader>

        {step === 'request' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-gray-300">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>
            
            <div className="space-y-3">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? 'Sending...' : 'Send Reset Email'}
              </Button>
              
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleClose}
                className="w-full text-gray-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-green-400" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Check Your Email</h3>
              <p className="text-gray-400 text-sm">
                We've sent password reset instructions to <span className="text-purple-400">{email}</span>
              </p>
            </div>
            
            <Button 
              onClick={handleClose}
              className="w-full bg-gray-700 hover:bg-gray-600"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}