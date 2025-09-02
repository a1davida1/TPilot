import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Star, Heart, Eye, TrendingUp, Crown, CheckCircle, ArrowRight, Gift } from "lucide-react";
// Polished Loading Component
export function PolishedLoader({ text = "Loading..." }) {
    return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-purple-500/30 rounded-full animate-spin">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-purple-500 rounded-full"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-purple-400 animate-pulse"/>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">{text}</h3>
          <p className="text-purple-300">Preparing your premium experience...</p>
        </div>
      </div>
    </div>);
}
// Premium Success Message
export function SuccessMessage({ title, description, onContinue }) {
    return (<Card className="glass border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 hover-lift">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-white"/>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-green-900">{title}</h4>
            <p className="text-green-700 text-sm">{description}</p>
          </div>
          <Button onClick={onContinue} className="bg-green-600 hover:bg-green-700 text-white">
            Continue
            <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
        </div>
      </CardContent>
    </Card>);
}
// Premium Feature Card
export function PremiumFeatureCard({ icon, title, description, badge, gradient, onClick, disabled = false }) {
    return (<Card className={`
      relative overflow-hidden cursor-pointer transition-all-smooth hover-lift group
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-glow'}
    `}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`}/>
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`text-transparent bg-gradient-to-r ${gradient} bg-clip-text group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          {badge && (<Badge className="bg-purple-100 text-purple-800 text-xs">
              {badge}
            </Badge>)}
        </div>
        <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">
          {title}
        </CardTitle>
        <CardDescription className="text-gray-600">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        <Button onClick={onClick} disabled={disabled} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
          {disabled ? 'Coming Soon' : 'Try Now'}
          {!disabled && <ArrowRight className="ml-2 h-4 w-4"/>}
        </Button>
      </CardContent>
    </Card>);
}
// Engagement Metrics Component
export function EngagementMetrics({ views = 0, likes = 0, engagement = 0, isDemo = false }) {
    const metrics = [
        {
            icon: <Eye className="h-5 w-5"/>,
            label: "Views",
            value: views.toLocaleString(),
            color: "text-blue-600"
        },
        {
            icon: <Heart className="h-5 w-5"/>,
            label: "Likes",
            value: likes.toLocaleString(),
            color: "text-red-600"
        },
        {
            icon: <TrendingUp className="h-5 w-5"/>,
            label: "Engagement",
            value: `${engagement.toFixed(1)}%`,
            color: "text-green-600"
        }
    ];
    return (<div className="grid grid-cols-3 gap-4">
      {metrics.map((metric, index) => (<Card key={index} className="text-center hover-lift transition-all-smooth">
          <CardContent className="p-4">
            <div className={`${metric.color} mb-2 flex justify-center`}>
              {metric.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isDemo ? '---' : metric.value}
            </div>
            <div className="text-sm text-gray-600">{metric.label}</div>
          </CardContent>
        </Card>))}
    </div>);
}
// Premium Upgrade Prompt
export function PremiumUpgradePrompt({ onUpgrade, feature = "this feature", className = "" }) {
    return (<Card className={`border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
            <Crown className="h-6 w-6 text-white"/>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-orange-900 mb-1">
              Premium Feature
            </h4>
            <p className="text-orange-700 text-sm">
              Unlock {feature} with a free account. No credit card required.
            </p>
          </div>
          <Button onClick={onUpgrade} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-glow">
            <Gift className="mr-2 h-4 w-4"/>
            Upgrade Free
          </Button>
        </div>
      </CardContent>
    </Card>);
}
// Achievement Badge
export function AchievementBadge({ icon, title, description, unlocked = false, progress = 0 }) {
    return (<Card className={`
      transition-all-smooth hover-lift cursor-pointer
      ${unlocked
            ? 'border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-glow'
            : 'border-gray-200 bg-gray-50'}
    `}>
      <CardContent className="p-4 text-center">
        <div className={`
          w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center
          ${unlocked
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
            : 'bg-gray-200 text-gray-500'}
        `}>
          {icon}
        </div>
        <h4 className={`font-medium mb-1 ${unlocked ? 'text-orange-900' : 'text-gray-600'}`}>
          {title}
        </h4>
        <p className={`text-xs ${unlocked ? 'text-orange-700' : 'text-gray-500'}`}>
          {description}
        </p>
        {!unlocked && progress > 0 && (<div className="mt-3">
            <Progress value={progress} className="h-2"/>
            <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
          </div>)}
        {unlocked && (<Badge className="mt-2 bg-yellow-100 text-yellow-800 text-xs">
            <Star className="w-3 h-3 mr-1"/>
            Unlocked
          </Badge>)}
      </CardContent>
    </Card>);
}
// Premium Stats Display
export function PremiumStatsDisplay({ stats, isDemo = false }) {
    return (<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (<Card key={index} className="hover-lift transition-all-smooth group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
              {stat.trend && (<Badge className="bg-green-100 text-green-800 text-xs">
                  {stat.trend}
                </Badge>)}
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">
                {isDemo ? '---' : stat.value}
              </div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          </CardContent>
        </Card>))}
    </div>);
}
// Floating Action Button
export function FloatingActionButton({ icon, onClick, tooltip }) {
    return (<Button onClick={onClick} className="
        fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-premium
        bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700
        hover:scale-110 transition-all-smooth z-50
      " title={tooltip}>
      {icon}
    </Button>);
}
