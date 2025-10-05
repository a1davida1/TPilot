import React, { Suspense } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Quote, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThottoPilotLogo } from "@/components/thottopilot-logo";
import { useMetrics, useMetricsSuspense } from "@/hooks/use-metrics";

const numberFormatter = new Intl.NumberFormat("en-US");

const featureHighlights = [
  {
    title: "AI Caption Studio",
    description: "Spin up platform-ready captions with safety checks and audience targeting baked in.",
    icon: Sparkles,
    benefit: "Personalized in seconds",
  },
  {
    title: "Protection Guardrails",
    description: "Apply watermarking, fingerprinting, and takedown-ready tracking to every asset automatically.",
    icon: ShieldCheck,
    benefit: "Keep every drop secure",
  },
  {
    title: "Revenue Intelligence",
    description: "Monitor conversions, fan migrations, and campaign lift with real analytics not vanity metrics.",
    icon: BarChart3,
    benefit: "Decisions backed by data",
  },
];

const testimonialCards = [
  {
    quote:
      "We moved our caption workflow into ThottoPilot and cut publishing time by 70%. The analytics call out exactly where to double down.",
    name: "Mia, Content Collective Lead",
    badge: "OnlyFans Creator",
  },
  {
    quote:
      "Active subscription tracking is finally real. I can see upgrades right after campaigns go live and pause what isn't working.",
    name: "Luca, Growth Manager",
    badge: "Multi-platform Studio",
  },
  {
    quote:
      "The protection presets save us every week. Auto-watermarking plus takedown evidence means we ship content fast without leaks.",
    name: "Harper, Operations",
    badge: "Agency Partner",
  },
];

function HeroMetricsFallback() {
  return (
    <div
      className="grid gap-4 pt-10 sm:grid-cols-3"
      data-testid="hero-metric-fallback"
      aria-live="polite"
    >
      {[0, 1, 2].map((index) => (
        <Card key={index} className="border-dashed">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="h-10 w-24 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted/70 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HeroMetrics() {
  const metrics = useMetricsSuspense();

  return (
    <div className="grid gap-4 pt-10 sm:grid-cols-3" role="list">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tight" data-testid="hero-metric-creators">
              {numberFormatter.format(metrics.creators)}
            </CardTitle>
            <CardDescription>Creators scaling their drops</CardDescription>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tight" data-testid="hero-metric-posts">
              {numberFormatter.format(metrics.posts)}
            </CardTitle>
            <CardDescription>AI posts launched on-platform</CardDescription>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tight" data-testid="hero-metric-active">
                {numberFormatter.format(metrics.activeSubscriptions)}
              </CardTitle>
              <CardDescription>
                Active memberships · Retention {metrics.engagement}%
              </CardDescription>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeroMetricsSection() {
  const { isError, error } = useMetrics();

  if (isError) {
    const message = (error?.userMessage || error?.message || "Unable to load metrics").trim();
    return (
      <Card className="mt-10 border-destructive/40 bg-destructive/5 text-destructive">
        <CardContent className="flex items-center gap-3 p-6">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
          <p className="text-sm font-semibold">{message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Suspense fallback={<HeroMetricsFallback />}>
      <HeroMetrics />
    </Suspense>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-purple-50 py-16 text-foreground dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6">
        <section className="text-center sm:text-left">
          <div className="mb-8 flex justify-center sm:justify-start">
            <ThottoPilotLogo size="xl" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-semibold shadow-sm">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Live production metrics
            </Badge>
            <span className="text-muted-foreground">Updated continuously</span>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl md:text-6xl">
            Turn every drop into a revenue engine with a workflow that protects, promotes, and measures.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            ThottoPilot unifies AI captioning, media protection, and real analytics into one creator-first cockpit.
            Launch faster, stay compliant, and know exactly which campaigns convert.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-stretch">
            <Button size="lg" className="w-full sm:w-auto">
              Start free trial
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <Zap className="mr-2 h-5 w-5" aria-hidden="true" />
              See automated workflows
            </Button>
          </div>
          <HeroMetricsSection />
        </section>

        <section className="space-y-10" aria-labelledby="features-heading">
          <div className="text-center sm:text-left">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Why teams ship with us
            </Badge>
            <h2 id="features-heading" className="mt-4 text-3xl font-bold sm:text-4xl">
              Ship smart content with enterprise guardrails
            </h2>
            <p className="mt-3 text-muted-foreground sm:max-w-3xl">
              Every tool is wired into a single analytics core so you can move from ideation to monetization without juggling tabs or risking leaks.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featureHighlights.map((feature) => (
              <Card key={feature.title} className="h-full border-border/70 bg-background/90 shadow-lg">
                <CardHeader className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    <feature.icon className="h-4 w-4" aria-hidden="true" />
                    {feature.benefit}
                  </div>
                  <CardTitle className="text-2xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-10" aria-labelledby="testimonials-heading">
          <div className="text-center sm:text-left">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Proof from the floor
            </Badge>
            <h2 id="testimonials-heading" className="mt-4 text-3xl font-bold sm:text-4xl">
              Teams trust ThottoPilot when revenue is on the line
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonialCards.map((testimonial) => (
              <Card key={testimonial.name} className="h-full border-border/70 bg-background/90 shadow-lg">
                <CardHeader className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Quote className="h-5 w-5" aria-hidden="true" />
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {testimonial.badge}
                    </Badge>
                  </div>
                  <CardDescription className="text-base leading-relaxed text-foreground">
                    {testimonial.quote}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    {testimonial.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border/70 bg-background/95 p-10 text-center shadow-xl">
          <div className="mx-auto max-w-3xl space-y-6">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Built for scale
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Connect strategy, operations, and monetization in one launchpad
            </h2>
            <p className="text-muted-foreground">
              No more stitched together spreadsheets. Import your catalog, activate protection presets, and watch the analytics roll in.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="w-full sm:w-auto">
                Launch my workspace
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Book a strategy session
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}