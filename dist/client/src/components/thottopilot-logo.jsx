import { cn } from "@/lib/utils";
// Use the actual ThottoPilot logo from public directory
const logoImage = "/thottopilot-logo.png";
export function ThottoPilotLogo({ className, size = "md" }) {
    const sizeClasses = {
        sm: "h-6 w-6",
        md: "h-8 w-8",
        lg: "h-10 w-10",
        xl: "h-12 w-12"
    };
    return (<img src={logoImage} alt="ThottoPilot" className={cn("object-contain", sizeClasses[size], className)}/>);
}
