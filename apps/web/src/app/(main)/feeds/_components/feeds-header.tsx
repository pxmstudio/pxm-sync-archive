"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { RequestFeedModal } from "./request-feed-modal";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";

export function FeedsBreadcrumb() {
  const { t } = useTranslation("feeds");

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("breadcrumb")}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function FeedsHeader() {
  const { t } = useTranslation("feeds");
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => setRequestModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("requestFeed.button")}
        </Button>
      </div>

      <RequestFeedModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        onSuccess={() => {}}
      />
    </>
  );
}
