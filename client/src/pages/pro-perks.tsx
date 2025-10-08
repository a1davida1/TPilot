import { ProPerks } from "@/components/pro-perks";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles } from "lucide-react";

export default function ProPerksPage() {
  const { user, isLoading } = useAuth();
  const isPro = user?.tier === "pro" || user?.tier === "premium";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-primary-50/60 to-primary-100/40 dark:from-background dark:via-primary-900/40 dark:to-primary-950/40">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-[hsl(var(--accent-rose)/0.12)] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-yellow)/0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent-rose)/0.08),transparent_55%)]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10">
        <header className="mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-4 py-2 text-primary-600 dark:text-primary-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold tracking-wide uppercase">Signature T-Perks</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 dark:from-primary-400 dark:via-accent-rose dark:to-primary-500 bg-clip-text text-transparent">
            The T-Perks Vault
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Curated partner programs, studio gear, and revenue plays crafted exclusively for ThottoPilot creators. Every T-Perk spells out the baseline offer and the upgrade we negotiate so you can focus on building income, not hunting deals.
          </p>
        </header>

        {!isLoading && !isPro && (
          <div className="mb-8">
            <div className="rounded-2xl border border-primary-200/40 bg-primary-50/60 p-6 backdrop-blur md:p-8 dark:border-primary-900/30 dark:bg-primary-950/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-200">
                    <Gift className="h-3 w-3" />
                    T-Perks Exclusive
                  </div>
                  <h2 className="text-2xl font-semibold text-primary-800 dark:text-primary-100">
                    Unlock the full T-Perks roster
                  </h2>
                  <p className="text-sm text-primary-700/80 dark:text-primary-100/80">
                    Join ThottoPilot Pro to access the complete vault of partner deals, launch playbooks, and negotiated creator bonuses.
                  </p>
                </div>
                <Button asChild className="bg-gradient-to-r from-primary-500 to-accent-rose text-white shadow-lg">
                  <Link href="/settings">
                    Unlock T-Perks Access
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        <ProPerks userTier={isPro ? "pro" : "guest"} />
      </div>
    </div>
  );
}
