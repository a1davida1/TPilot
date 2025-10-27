import { MobileOptimization } from "@/components/mobile-optimization";
import { ImageGallery } from "@/components/image-gallery";
import { coreNavigationItems } from "@/lib/navigation";

export default function GalleryPage() {
  return (
    <MobileOptimization navigationItems={coreNavigationItems}>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-primary-50/60 to-primary-100/50 dark:from-background dark:via-primary-900/40 dark:to-primary-950/40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-[hsl(var(--accent-yellow)/0.12)] opacity-60"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-pink)/0.12),transparent_55%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent-yellow)/0.08),transparent_55%)]"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="mb-8 space-y-2">
            <h1 className="bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 bg-clip-text text-4xl font-bold text-transparent drop-shadow-sm dark:from-primary-400 dark:via-accent-rose dark:to-primary-500">
              Media Gallery
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Upload, organize, and protect your images. Apply advanced protection to prevent reverse searches.
            </p>
          </div>
          <ImageGallery />
        </div>
      </div>
    </MobileOptimization>
  );
}
