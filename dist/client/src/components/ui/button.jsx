import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 tracking-tight text-shadow shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0", {
    variants: {
        variant: {
            default: "bg-gradient-to-r from-pink-500 via-rose-400 to-pink-600 text-white font-bold shadow-pink-500/25 hover:shadow-pink-500/40 hover:from-pink-600 hover:via-rose-500 hover:to-pink-700",
            destructive: "bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-red-500/25 hover:shadow-red-500/40",
            outline: "border-2 border-pink-300 bg-background/80 backdrop-blur text-pink-700 font-semibold hover:bg-pink-50 hover:border-pink-400 dark:border-pink-500 dark:text-pink-300 dark:hover:bg-pink-950/20",
            secondary: "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 font-semibold border border-purple-200 hover:from-purple-200 hover:to-pink-200 dark:from-purple-900/20 dark:to-pink-900/20 dark:text-purple-300",
            ghost: "text-pink-600 font-semibold hover:bg-pink-100/50 hover:text-pink-700 dark:text-pink-400 dark:hover:bg-pink-950/20",
            link: "text-pink-600 font-semibold underline-offset-4 hover:underline hover:text-pink-700 dark:text-pink-400",
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
});
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}/>);
});
Button.displayName = "Button";
export { Button, buttonVariants };
