import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, LogIn, Shield, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AdminAccessGuide() {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copied!`,
      description: "Paste it in the login form"
    });
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-400" />
          Admin Portal Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-purple-300">Quick Admin Login:</h3>
          
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Email:</span>
              <div className="flex items-center gap-2">
                <code className="text-purple-300">admin@thottopilot.com</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard("admin@thottopilot.com", "Email")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Password:</span>
              <div className="flex items-center gap-2">
                <code className="text-purple-300">admin123</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard("admin123", "Password")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-purple-300">Access Steps:</h3>
          <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
            <li>Click the login button below</li>
            <li>Use the admin credentials above</li>
            <li>You'll be redirected to /admin portal</li>
            <li>Access all pro features & system metrics</li>
          </ol>
        </div>

        <div className="flex gap-3">
          <Button 
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
            onClick={() => window.location.href = '/login'}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Go to Login
          </Button>
          
          <Button 
            variant="outline"
            className="flex-1 border-purple-500/50"
            onClick={() => window.location.href = '/admin'}
          >
            <User className="h-4 w-4 mr-2" />
            Direct to Admin
          </Button>
        </div>

        <div className="text-xs text-gray-400 text-center">
          Admin portal shows system metrics, user management, and cost analytics
        </div>
      </CardContent>
    </Card>
  );
}