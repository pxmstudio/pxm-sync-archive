import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { SyncClient } from "./_components/sync-client";
import { SyncBreadcrumb } from "./_components/sync-header";
import { SyncHelpSheet } from "./_components/sync-help-sheet";

export const metadata = {
  title: "Sync | PXM Sync",
  description: "Configure product synchronization settings for your store",
};

export default function SyncPage() {
  return (
    <AppSidebarInset left={<SyncBreadcrumb />} right={<SyncHelpSheet />}>
      <div className="p-4">
        <SyncClient />
      </div>
    </AppSidebarInset>
  );
}
