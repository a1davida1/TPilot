import { ImageShield } from "@/components/image-shield";
import { useAuth } from "@/hooks/useAuth";
export default function ImageShieldPage() {
    const { user } = useAuth();
    const baseTier = user?.tier || 'free';
    // Map tiers for ImageShield component compatibility
    const getUserTier = () => {
        if (baseTier === 'admin')
            return 'premium';
        if (baseTier === 'guest')
            return 'basic';
        return baseTier;
    };
    const userTier = getUserTier();
    const isGuestMode = !user;
    return (<div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950">
      <div className="container mx-auto p-4 max-w-6xl">
        <ImageShield isGuestMode={isGuestMode} userTier={userTier}/>
      </div>
    </div>);
}
