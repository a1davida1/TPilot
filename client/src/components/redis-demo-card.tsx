/**
 * Redis-Inspired Design Demo
 * Shows off the new Redis color scheme
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Sparkles, TrendingUp } from 'lucide-react';

export function RedisDemoCard() {
  return (
    <div className="space-y-6">
      {/* Hero Section - Redis Style */}
      <Card className="bg-redis-dark border-redis-slate overflow-hidden relative">
        <div className="absolute inset-0 bg-redis-gradient opacity-10" />
        <CardHeader className="relative z-10">
          <CardTitle className="text-3xl font-bold text-white">
            <span className="text-redis-gradient">Redis-Inspired</span> Design
          </CardTitle>
          <p className="text-gray-300 mt-2">
            Stolen from the best. Fire gradient with dark backgrounds.
          </p>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          <div className="flex gap-3">
            <Button className="bg-redis-gradient hover:opacity-90 text-white border-0">
              <Zap className="mr-2 h-4 w-4" />
              Get Started
            </Button>
            <Button variant="outline" className="border-redis-orange text-redis-orange hover:bg-redis-orange/10">
              Learn More
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Badge className="bg-redis-red/20 text-redis-orange border-redis-orange/30">
              <Sparkles className="h-3 w-3 mr-1" />
              Fast
            </Badge>
            <Badge className="bg-redis-red/20 text-redis-orange border-redis-orange/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              Scalable
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-redis-navy border-redis-slate hover:border-redis-orange transition-colors">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-redis-gradient rounded-lg mb-4 flex items-center justify-center">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Lightning Fast</h3>
            <p className="text-gray-400 text-sm">
              Sub-millisecond response times powered by in-memory storage
            </p>
          </CardContent>
        </Card>

        <Card className="bg-redis-navy border-redis-slate hover:border-redis-orange transition-colors">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-redis-gradient rounded-lg mb-4 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Rich Features</h3>
            <p className="text-gray-400 text-sm">
              Strings, hashes, lists, sets, and more data structures
            </p>
          </CardContent>
        </Card>

        <Card className="bg-redis-navy border-redis-slate hover:border-redis-orange transition-colors">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-redis-gradient rounded-lg mb-4 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Battle Tested</h3>
            <p className="text-gray-400 text-sm">
              Trusted by millions of developers worldwide
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
