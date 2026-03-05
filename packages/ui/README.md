# @workspace/ui

Shared React component library built on [shadcn/ui](https://ui.shadcn.com) (Radix UI + Tailwind CSS).

## What's included

- **Radix UI primitives** — dialog, dropdown, popover, select, tabs, tooltip, sheet, accordion, and more
- **Data tables** — TanStack React Table integration with sorting, filtering, pagination
- **Charts** — Recharts wrappers for dashboard visualizations
- **Form components** — inputs, selects, checkboxes, switches, with React Hook Form integration
- **Layout** — sidebar, breadcrumb, separator, scroll-area
- **Feedback** — sonner toasts, alerts, badges, skeleton loaders
- **Animation** — motion (Framer Motion) for transitions
- **Icons** — lucide-react icon set

## Usage

Import components from their subpath:

```tsx
import { Button } from "@workspace/ui/components/button"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import { cn } from "@workspace/ui/lib/utils"
```

Global styles are exported from `@workspace/ui/globals.css`.
