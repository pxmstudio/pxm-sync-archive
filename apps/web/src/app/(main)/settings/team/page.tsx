"use client";

import Link from "next/link";
import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { TeamSettingsClient } from "./_components/team-settings-client";
import { useTranslation } from "@workspace/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";

export default function TeamSettingsPage() {
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
              <BreadcrumbPage>{t("team.title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="flex-1 space-y-6 p-6">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("team.title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("team.subtitle")}
            </p>
          </div>

          <TeamSettingsClient />
      </div>
    </AppSidebarInset>
  );
}
