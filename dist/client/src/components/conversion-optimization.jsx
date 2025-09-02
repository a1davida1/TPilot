import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { TrendingUp, Users, Clock, CheckCircle, ArrowRight, Star, Zap, Shield } from "lucide-react";
export function ConversionOptimization({ isGuestMode = false, onUpgrade }) {
    const [trialProgress, setTrialProgress] = useState(0);
    const [timeSpent, setTimeSpent] = useState(0);
    useEffect(() => {
        if (isGuestMode) {
            const timer = setInterval(() => {
                setTimeSpent(prev => prev + 1);
                setTrialProgress(prev => Math.min(prev + 2, 100));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isGuestMode]);
    const benefits = [
        { icon: <TrendingUp className="h-4 w-4"/>, text: "3x higher engagement rates" },
        { icon: <Users className="h-4 w-4"/>, text: "Unlimited content generations" },
        { icon: <Shield className="h-4 w-4"/>, text: "Advanced image protection" },
        { icon: <Zap className="h-4 w-4"/>, text: "Priority AI processing" },
    ];
    const testimonialHighlight = {
        quote: "ThottoPilot increased my engagement by 300% in just two weeks!",
        author: "Sarah M.",
        role: "Content Creator",
        earnings: "+$2,500/month"
    };
    if (!isGuestMode) {
        return null;
    }
    return (<div className="space-y-4">
      {/* Trial Progress */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600"/>
              <CardTitle className="text-lg text-orange-900">Trial Progress</CardTitle>
            </div>
            <Badge className="bg-orange-100 text-orange-800">
              {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')} used
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={trialProgress} className="mb-3"/>
          <p className="text-sm text-orange-700 mb-4">
            You're making great progress! See what unlimited access can do for your content.
          </p>
          <Button onClick={onUpgrade} className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600">
            Upgrade to Unlock Everything
            <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
        </CardContent>
      </Card>

      {/* Social Proof */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-green-900 flex items-center">
            <Star className="mr-2 h-5 w-5 fill-yellow-400 text-yellow-400"/>
            Success Story
          </CardTitle>
        </CardHeader>
        <CardContent>
          <blockquote className="text-green-800 font-medium mb-3">
            "{testimonialHighlight.quote}"
          </blockquote>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-900">{testimonialHighlight.author}</p>
              <p className="text-sm text-green-700">{testimonialHighlight.role}</p>
            </div>
            <Badge className="bg-green-100 text-green-800">
              {testimonialHighlight.earnings}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-blue-600"/>
            Unlock Premium Features
          </CardTitle>
          <CardDescription>
            See what you're missing with a full ThottoPilot account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4">
            {benefits.map((benefit, index) => (<div key={index} className="flex items-center space-x-3">
                <div className="text-blue-600">{benefit.icon}</div>
                <span className="text-sm">{benefit.text}</span>
              </div>))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Sign Up Free
              </Button>
            </Link>
            <Button onClick={onUpgrade} className="w-full bg-blue-600 hover:bg-blue-700">
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scarcity Element */}
      {trialProgress > 50 && (<Card className="border-red-200 bg-gradient-to-r from-red-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <h4 className="font-medium text-red-900 mb-2">
                Don't lose your progress!
              </h4>
              <p className="text-sm text-red-700 mb-4">
                Sign up now to save your generated content and unlock unlimited access.
              </p>
              <Link href="/login">
                <Button className="bg-red-600 hover:bg-red-700 text-white">
                  Save My Progress
                  <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>)}
    </div>);
}
