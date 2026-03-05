import { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { CartProvider } from "./cart-provider";
import { QuickOrderProvider } from "./quick-order-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { I18nProvider } from "@workspace/i18n";
import { Toaster } from "sonner";
import { CheckIcon, XIcon, AlertTriangleIcon, InfoIcon, Loader2Icon } from "lucide-react";

/**
 * Wraps application UI with the top-level provider hierarchy and renders global UI primitives.
 *
 * @param children - The React node(s) to be wrapped by the providers
 * @returns A React element that wraps `children` with QueryProvider, ThemeProvider, I18nProvider, CartProvider, and QuickOrderProvider, and renders the global CartDrawer and Toaster components
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
      //   disableTransitionOnChange
      >
        <I18nProvider>
          <CartProvider>
            <QuickOrderProvider>
              {children}
            <CartDrawer />
            <Toaster
              position="bottom-right"
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
                },
              }}
              icons={{
                success: (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <CheckIcon className="size-3 text-white" strokeWidth={3} />
                  </div>
                ),
                info: (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#146EF5]">
                    <InfoIcon className="size-3 text-white" strokeWidth={3} />
                  </div>
                ),
                warning: (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500">
                    <AlertTriangleIcon className="size-3 text-white" strokeWidth={3} />
                  </div>
                ),
                error: (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500">
                    <XIcon className="size-3 text-white" strokeWidth={3} />
                  </div>
                ),
                loading: (
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                ),
              }}
            />
            </QuickOrderProvider>
          </CartProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryProvider>
    </NuqsAdapter>
  );
}