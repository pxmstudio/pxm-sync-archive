import { AppSidebar } from "@/components/navigation/app-sidebar";
import { LayoutGuard } from "@/components/layout-guard";
import { SidebarProvider } from "@workspace/ui/components/sidebar";

/**
 * Wraps page content with layout guard and sidebar context, rendering the application sidebar alongside the provided children.
 *
 * @param children - The page content to render next to the application sidebar.
 * @returns A React element that composes `LayoutGuard` > `SidebarProvider` > `AppSidebar` and the given `children`.
 */
export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LayoutGuard>
      <SidebarProvider>
        <AppSidebar />
        {children}
      </SidebarProvider>
    </LayoutGuard>
  );
}