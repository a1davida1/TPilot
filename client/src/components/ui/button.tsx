import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 tracking-tight text-shadow shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-orange-500 via-amber-400 to-red-500 text-white font-bold shadow-orange-500/25 hover:shadow-orange-500/40 hover:from-orange-600 hover:via-amber-500 hover:to-red-500",
        destructive:
          "bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-red-500/25 hover:shadow-red-500/40",
        outline:
          "border-2 border-orange-300 bg-background/80 backdrop-blur text-orange-700 font-semibold hover:bg-orange-50 hover:border-orange-400 dark:border-orange-500 dark:text-orange-300 dark:hover:bg-orange-950/20",
        secondary:
          "bg-gradient-to-r from-amber-100 to-orange-100 text-orange-800 font-semibold border border-orange-200 hover:from-amber-200 hover:to-orange-200 dark:from-orange-900/20 dark:to-red-900/20 dark:text-orange-300",
        ghost: "text-orange-600 font-semibold hover:bg-orange-100/50 hover:text-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20",
        link: "text-orange-600 font-semibold underline-offset-4 hover:underline hover:text-orange-700 dark:text-orange-400",
      },
      size: {
        default: "h-11 px-6 py-3 text-base",
        sm: "h-9 px-4 py-2 text-sm",
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