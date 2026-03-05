import type { Metadata } from "next";
import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { FeedDetailClient } from "./_components/feed-detail-client";
import { FeedBreadcrumb } from "./_components/feed-breadcrumb";

export const metadata: Metadata = {
  title: "Feed Details | PXM Sync",
  description: "View feed details, products, and manage your subscription",
};

interface FeedDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function FeedDetailPage({ params }: FeedDetailPageProps) {
  const { id } = await params;

  return (
    <AppSidebarInset
      left={<FeedBreadcrumb feedId={id} />}
    >
      <div className="flex-1 p-6">
        <FeedDetailClient feedId={id} />
      </div>
    </AppSidebarInset>
  );
}
