import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const badgeVariants = cva(
  // Base styles - Refined, pill-shaped
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-medium transition-colors [&>svg]:size-3 [&>svg]:pointer-events-none shrink-0",
  {
    variants: {
      variant: {
        // Default - Primary colored
        default: "bg-primary text-primary-foreground",

        // Secondary - Neutral gray
        secondary: "bg-muted text-muted-foreground",

        // Outline - Border only
        outline: "border border-border text-foreground",

        // Soft variants - Tinted backgrounds
        soft: "bg-primary/10 text-primary",

        // Status variants - Subtle, refined colors
        success: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        warning: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
        error: "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300",
        info: "bg-primary/10 text-primary",

        // Destructive
        destructive: "bg-destructive/15 text-destructive",

        // Ghost
        ghost: "text-muted-foreground",
      },
      size: {
        default: "h-6 px-2.5 rounded-full",
        sm: "h-5 px-2 text-[11px] rounded-full",
        lg: "h-7 px-3 text-sm rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  dot?: boolean
}

function Badge({
  className,
  variant,
  size,
  asChild = false,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "success" && "bg-emerald-600 dark:bg-emerald-400",
            variant === "warning" && "bg-amber-600 dark:bg-amber-400",
            variant === "error" && "bg-red-600 dark:bg-red-400",
            variant === "info" && "bg-primary",
            variant === "default" && "bg-primary-foreground",
            variant === "secondary" && "bg-muted-foreground",
            variant === "destructive" && "bg-destructive",
            (!variant || variant === "outline" || variant === "soft" || variant === "ghost") && "bg-current"
          )}
        />
      )}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
