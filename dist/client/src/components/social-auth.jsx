import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowRight, Shield, Zap, CheckCircle, Users } from "lucide-react";
import { FaReddit, FaGoogle, FaFacebook } from "react-icons/fa";
export function SocialAuth({ onSuccess, isLoading = false }) {
    const [loadingProvider, setLoadingProvider] = useState(null);
    const socialProviders = [
        {
            id: 'google',
            name: 'Google',
            icon: <FaGoogle className="h-5 w-5"/>,
            color: 'bg-red-500 hover:bg-red-600',
            description: 'Fast & secure with Google',
            url: '/api/auth/google',
            popular: true
        },
        {
            id: 'reddit',
            name: 'Reddit',
            icon: <FaReddit className="h-5 w-5"/>,
            color: 'bg-orange-500 hover:bg-orange-600',
            description: 'Perfect for content creators',
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
                }
                catch (error) {
                    console.error('Failed to connect Reddit:', error);
                }
            },
            recommended: true
        },
        {
            id: 'facebook',
            name: 'Facebook',
            icon: <FaFacebook className="h-5 w-5"/>,
            color: 'bg-blue-600 hover:bg-blue-700',
            description: 'Connect with Facebook',
            url: '/api/auth/facebook'
        }
    ];
    const handleSocialAuth = async (provider) => {
        setLoadingProvider(provider.id);
        try {
            // Check if provider has custom handler
            if (provider.handler) {
                await provider.handler();
            }
            else if (provider.url) {
                // Redirect to OAuth provider
                window.location.href = provider.url;
            }
            onSuccess?.(provider.id);
        }
        catch (error) {
            console.error(`${provider.name} auth failed:`, error);
            setLoadingProvider(null);
        }
    };
    const benefits = [
        { icon: <Zap className="h-4 w-4"/>, text: "Instant access - no email verification needed" },
        { icon: <Shield className="h-4 w-4"/>, text: "Secure OAuth authentication" },
        { icon: <Users className="h-4 w-4"/>, text: "Auto-import your profile information" }
    ];
    return (<div className="space-y-6">
      {/* Social Authentication Options */}
      <Card className="border-0 shadow-premium bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
            Get Started in Seconds
          </CardTitle>
          <CardDescription className="text-lg">
            Choose your preferred way to sign up
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Social Login Buttons */}
          <div className="space-y-3">
            {socialProviders.map((provider) => (<Button key={provider.id} onClick={() => handleSocialAuth(provider)} disabled={isLoading || loadingProvider !== null} className={`
                  w-full h-14 text-white font-medium text-lg transition-all-smooth hover-lift
                  ${provider.color}
                  ${loadingProvider === provider.id ? 'opacity-75' : ''}
                `} size="lg">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-3">
                    {loadingProvider === provider.id ? (<div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/>) : (provider.icon)}
                    <div className="text-left">
                      <div className="font-semibold">Continue with {provider.name}</div>
                      <div className="text-sm opacity-90">{provider.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {provider.popular && (<Badge className="bg-white/20 text-white border-white/30 text-xs">
                        Most Popular
                      </Badge>)}
                    {provider.recommended && (<Badge className="bg-white/20 text-white border-white/30 text-xs">
                        Recommended
                      </Badge>)}
                    <ArrowRight className="h-4 w-4"/>
                  </div>
                </div>
              </Button>))}
          </div>

          {/* Separator */}
          <div className="relative">
            <Separator className="my-6"/>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-white px-4 text-sm text-gray-500 font-medium">
                or continue with email
              </span>
            </div>
          </div>

          {/* Email Option */}
          <Button variant="outline" className="w-full h-12 border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all-smooth" onClick={() => {
            // Handle email signup - can be implemented later
            console.log('Email signup clicked');
        }}>
            <Mail className="mr-3 h-5 w-5 text-gray-600"/>
            <span className="text-gray-700 font-medium">Sign up with Email</span>
          </Button>

          {/* Benefits */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
              <CheckCircle className="mr-2 h-5 w-5"/>
              Why creators choose social signup:
            </h4>
            <div className="space-y-2">
              {benefits.map((benefit, index) => (<div key={index} className="flex items-center text-sm text-blue-800">
                  <div className="text-blue-600 mr-2">{benefit.icon}</div>
                  {benefit.text}
                </div>))}
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-500 mb-2">
              Trusted by thousands of content creators
            </p>
            <div className="flex justify-center items-center space-x-4 text-xs text-gray-400">
              <div className="flex items-center">
                <Shield className="h-3 w-3 mr-1"/>
                SSL Secured
              </div>
              <div className="flex items-center">
                <Users className="h-3 w-3 mr-1"/>
                10,000+ Users
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1"/>
                GDPR Compliant
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alternative: Guest Mode */}
      <Card className="border border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
        <CardContent className="p-4">
          <div className="text-center">
            <h4 className="font-medium text-orange-900 mb-2">
              Want to try first?
            </h4>
            <p className="text-sm text-orange-700 mb-3">
              Explore ThottoPilot with a free demo - no signup required
            </p>
            <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => window.location.href = '/dashboard?guest=true'}>
              Try Demo Mode
              <ArrowRight className="ml-2 h-4 w-4"/>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>);
}
