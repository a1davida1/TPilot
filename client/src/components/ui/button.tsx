import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 tracking-tight text-shadow shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary via-accent to-accent-purple text-primary-foreground font-bold shadow-primary/25 hover:shadow-primary/40 hover:from-primary-600 hover:via-accent hover:to-accent-purple",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive text-destructive-foreground font-bold shadow-destructive/25 hover:shadow-destructive/40",
        outline:
          "border-2 border-primary/30 bg-background/80 backdrop-blur text-primary font-semibold hover:bg-primary/5 hover:border-primary/40 dark:border-primary/50 dark:text-primary dark:hover:bg-primary/10",
        secondary:
          "bg-gradient-to-r from-secondary to-muted text-secondary-foreground font-semibold border border-border hover:from-secondary/80 hover:to-muted/80 dark:from-secondary dark:to-muted dark:text-secondary-foreground",
        ghost: "text-primary font-semibold hover:bg-accent/50 hover:text-primary dark:text-primary dark:hover:bg-accent/20",
        link: "text-primary font-semibold underline-offset-4 hover:underline hover:text-primary-600 dark:text-primary",
      },
      size: {
        default: "h-11 px-6 py-3 text-base",
        sm: "h-11 px-4 py-2 text-sm", // Changed from h-9 to h-11 for 44px touch target
        lg: "h-14 px-8 py-4 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }