import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { ActivityClient } from "./_components/activity-client";
import { ActivityBreadcrumb } from "./_components/activity-header";

export const metadata = {
  title: "Activity | PXM Sync",
  description: "Track your store sync history and monitor product synchronization status",
};

export default function ActivityPage() {
  return (
    <AppSidebarInset left={<ActivityBreadcrumb />}>
      <div className="p-4">
        <ActivityClient />
      </div>
    </AppSidebarInset>
  );
}
