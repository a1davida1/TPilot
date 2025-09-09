import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMetrics } from "@/hooks/use-metrics";
import { 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  Star,
  Gift 
} from "lucide-react";

interface DemoFallbackProps {
  error?: string;
  onRetry?: () => void;
  onSignUp?: () => void;
}

export function DemoFallback({ error, onRetry, onSignUp }: DemoFallbackProps) {
  const { data: metrics, isLoading, isError } = useMetrics();
  const creatorText = isLoading
    ? "Loading creator count..."
    : isError || !metrics
      ? "Trusted by creators worldwide"
      : `Trusted by ${metrics.creators.toLocaleString()} content creators`;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-premium">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <CardDescription className="text-lg">
            You're experiencing ThottoPilot with limited functionality
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
            </h3>
            <div className="grid gap-3">
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800">User Interface Preview</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800">Feature Exploration</span>
              </div>
            </div>
          </div>

          {/* Upgrade Benefits */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Star className="mr-2 h-5 w-5 text-yellow-600" />
              Unlock with Free Account:
            </h3>
            <div className="grid gap-3">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Star className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800">Save & organize your generated content</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Star className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800">Access content history and analytics</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Star className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800">Image protection tools</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Star className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button 
              onClick={onSignUp || (() => window.location.href = '/login')}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white h-12"
            >
              <Gift className="mr-2 h-5 w-5" />
              Sign Up Free - No Credit Card
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="outline"
                className="sm:w-32 h-12"
              >
                Try Again
              </Button>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">
              {creatorText}
            </p>
            <div className="flex justify-center items-center space-x-4 text-xs text-gray-400">
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                No Email Required
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Instant Access
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                30s Setup
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}