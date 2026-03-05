import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const buttonVariants = cva(
  // Base styles - Apple-like precision
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-out select-none outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary - Solid fill with subtle depth
        default:
          "bg-primary text-primary-foreground shadow-subtle hover:brightness-110 active:brightness-95 active:scale-[0.99]",

        // Secondary - Subtle fill
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70 active:scale-[0.99]",

        // Outline - Clean border
        outline:
          "border border-border bg-background hover:bg-muted active:bg-muted/80 active:scale-[0.99]",

        // Ghost - Minimal, hover reveal
        ghost:
          "hover:bg-muted active:bg-muted/80 active:scale-[0.99]",

        // Destructive - Warning state
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/20 active:scale-[0.99]",

        // Link - Text only
        link:
          "text-primary underline-offset-4 hover:underline",

        // Soft - Tinted background matching primary
        soft:
          "bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/20 active:scale-[0.99]",
      },
      size: {
        default: "h-9 px-4 rounded-lg",
        sm: "h-8 px-3 rounded-md text-xs",
        lg: "h-10 px-5 rounded-lg",
        xl: "h-11 px-6 rounded-xl text-base",
        icon: "size-9 rounded-lg",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
