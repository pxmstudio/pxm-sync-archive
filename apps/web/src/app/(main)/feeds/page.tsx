import { Suspense } from "react";
import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { FeedsClient } from "./_components/feeds-client";
import { FeedsBreadcrumb, FeedsHeader } from "./_components/feeds-header";
import { Spinner } from "@workspace/ui/components/spinner";

export const metadata = {
  title: "Feed Library | PXM Sync",
  description: "Browse and subscribe to product feeds for your store",
};

export default function FeedsPage() {
  return (
    <AppSidebarInset
      left={<FeedsBreadcrumb />}
    >
      <div className="flex-1 space-y-6 p-6">
        <FeedsHeader />

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          }
        >
          <FeedsClient />
        </Suspense>
      </div>
    </AppSidebarInset>
  );
}
