"use client"

import {
  CheckIcon,
  InfoIcon,
  Loader2Icon,
  XIcon,
  AlertTriangleIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast w-full rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg border bg-background text-foreground",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors",
          cancelButton:
            "bg-muted text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors",
          closeButton:
            "absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        },
      }}
      icons={{
        success: (
          <div data-icon className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <CheckIcon className="size-3 text-white" strokeWidth={3} />
          </div>
        ),
        info: (
          <div data-icon className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#146EF5]">
            <InfoIcon className="size-3 text-white" strokeWidth={3} />
          </div>
        ),
        warning: (
          <div data-icon className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500">
            <AlertTriangleIcon className="size-3 text-white" strokeWidth={3} />
          </div>
        ),
        error: (
          <div data-icon className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500">
            <XIcon className="size-3 text-white" strokeWidth={3} />
          </div>
        ),
        loading: (
          <div data-icon className="flex size-5 shrink-0 items-center justify-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ),
      }}
      {...props}
    />
  )
}

export { Toaster }
