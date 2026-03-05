"use client";

import { useTranslation } from "@workspace/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb";

export function ShopBreadcrumb() {
  const { t } = useTranslation("shop");

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

export function ShopHeader() {
  const { t } = useTranslation("shop");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
    </div>
  );
}
