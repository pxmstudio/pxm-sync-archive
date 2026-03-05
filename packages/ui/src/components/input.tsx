import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const inputVariants = cva(
  // Base styles - Clean, minimal Apple aesthetic
  "w-full min-w-0 bg-transparent text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  {
    variants: {
      variant: {
        // Default - Subtle border that strengthens on focus
        default:
          "border border-input rounded-lg hover:border-border/80 focus:border-ring focus:ring-1 focus:ring-ring/10",

        // Filled - Background fill instead of border
        filled:
          "bg-muted/50 rounded-lg border border-transparent hover:bg-muted/70 focus:bg-background focus:border-ring focus:ring-1 focus:ring-ring/10",

        // Ghost - Minimal, no border until focus
        ghost:
          "border border-transparent rounded-lg hover:bg-muted/50 focus:bg-muted/30 focus:border-ring focus:ring-1 focus:ring-ring/10",

        // Underline - Just bottom border
        underline:
          "border-b border-input rounded-none px-0 hover:border-foreground/30 focus:border-ring",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Input({
  className,
  variant,
  size,
  type,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
