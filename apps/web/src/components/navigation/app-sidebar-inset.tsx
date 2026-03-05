import { ReactNode } from "react";
import { SidebarInset, SidebarTrigger } from "@workspace/ui/components/sidebar";

export function AppSidebarInset({
  children,
  left,
  right,
}: {
  children: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b">
        <div className="flex items-center gap-2 px-4 justify-between w-full">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/50" />
            {left}
          </div>
          {right && (
            <div className="flex items-center gap-2">
              {right}
            </div>
          )}
        </div>
      </header>
      {children}
    </SidebarInset>
  );
}
