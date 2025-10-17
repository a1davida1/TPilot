import * as React from "react"
import { cn } from "@/lib/utils"

interface AppleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "elevated" | "interactive"
  padding?: "none" | "sm" | "md" | "lg"
}

const AppleCard = React.forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, variant = "default", padding = "md", children, ...props }, ref) => {
    const variants = {
      default: "bg-card border border-border/50",
      glass: "bg-card/80 backdrop-blur-xl border border-border/30",
      elevated: "bg-card shadow-lg border border-border/20",
      interactive: "bg-card border border-border/50 hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer"
    }

    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl",
          "transition-all duration-300 ease-out",
          variants[variant],
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

AppleCard.displayName = "AppleCard"

const AppleCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
))

AppleCardHeader.displayName = "AppleCardHeader"

const AppleCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  >
    {children}
  </h3>
))

AppleCardTitle.displayName = "AppleCardTitle"

const AppleCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))

AppleCardDescription.displayName = "AppleCardDescription"

const AppleCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-6", className)} {...props} />
))

AppleCardContent.displayName = "AppleCardContent"

const AppleCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-6", className)}
    {...props}
  />
))

AppleCardFooter.displayName = "AppleCardFooter"

export {
  AppleCard,
  AppleCardHeader,
  AppleCardFooter,
  AppleCardTitle,
  AppleCardDescription,
  AppleCardContent,
}
