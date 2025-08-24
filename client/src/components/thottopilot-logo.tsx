import { cn } from "@/lib/utils";

interface ThottoPilotLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThottoPilotLogo({ className, size = "md" }: ThottoPilotLogoProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Modern gradient logo design */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-lg opacity-90">
        <div className="absolute inset-0.5 bg-white rounded-md flex items-center justify-center">
          <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent font-bold text-xs leading-none">
            TP
          </div>
        </div>
      </div>
      
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-lg blur-sm opacity-30 -z-10"></div>
    </div>
  );
}