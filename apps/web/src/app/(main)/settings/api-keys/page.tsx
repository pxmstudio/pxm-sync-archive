"use client";

import Link from "next/link";
import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { ApiKeysClient } from "./_components/api-keys-client";
import { useTranslation } from "@workspace/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";

export default function ApiKeysPage() {
  const { t } = useTranslation("settings");

  return (
    <AppSidebarInset
      left={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/settings">{t("general.title").split(" ")[0]}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("apiKeys.title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="p-4">
        <ApiKeysClient />
      </div>
    </AppSidebarInset>
  );
}
