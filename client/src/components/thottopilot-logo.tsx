import { cn } from "@/lib/utils";
import logoImage from "@assets/ChatGPT Image Aug 8, 2025, 07_52_23 AM_1754881852507.png";

interface ThottoPilotLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function ThottoPilotLogo({ className, size = "md" }: ThottoPilotLogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-10 w-10",
    xl: "h-12 w-12"
  };

  return (
    <img 
      src={logoImage} 
      alt="ThottoPilot"
      className={cn("object-contain", sizeClasses[size], className)}
    />
  );
}