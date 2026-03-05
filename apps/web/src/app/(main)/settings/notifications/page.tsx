"use client";

import Link from "next/link";
import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { NotificationsSettingsClient } from "./_components/notifications-settings-client";
import { useTranslation } from "@workspace/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";

export default function NotificationsSettingsPage() {
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
              <BreadcrumbPage>{t("notifications.title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="flex-1 space-y-6 p-6">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("notifications.pageTitle")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("notifications.pageSubtitle")}
            </p>
          </div>

          <NotificationsSettingsClient />
      </div>
    </AppSidebarInset>
  );
}
