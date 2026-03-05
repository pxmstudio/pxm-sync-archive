"use client";

import Link from "next/link";
import { useFeedDetail } from "@/hooks/use-feed-detail";
import { useTranslation } from "@workspace/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Skeleton } from "@workspace/ui/components/skeleton";

interface FeedBreadcrumbProps {
  feedId: string;
}

export function FeedBreadcrumb({ feedId }: FeedBreadcrumbProps) {
  const { t } = useTranslation("navigation");
  const { feed, isLoading } = useFeedDetail(feedId);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/feeds">{t("feeds")}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              feed?.name || "Feed Details"
            )}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
