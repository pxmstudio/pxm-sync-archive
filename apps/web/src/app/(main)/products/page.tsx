import { Suspense } from "react";
import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { ShopClient } from "./_components/shop-client";
import { ShopBreadcrumb, ShopHeader } from "./_components/shop-header";
import { Skeleton } from "@workspace/ui/components/skeleton";

export const metadata = {
  title: "Shop | PXM Sync",
  description: "Browse all products from your subscribed feeds",
};

function ShopSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 w-full sm:w-[200px]" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <AppSidebarInset left={<ShopBreadcrumb />}>
      <div className="flex-1 space-y-6 p-6">
        <ShopHeader />

        <Suspense fallback={<ShopSkeleton />}>
          <ShopClient />
        </Suspense>
      </div>
    </AppSidebarInset>
  );
}
