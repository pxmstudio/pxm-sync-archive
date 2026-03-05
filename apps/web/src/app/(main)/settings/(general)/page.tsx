"use client";

import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset";
import { GeneralSettingsClient } from "./_components/general-settings-client";
import { useTranslation } from "@workspace/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb";

function GeneralSettingsBreadcrumb() {
  const { t } = useTranslation("settings");
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("general.title")}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function GeneralSettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <AppSidebarInset left={<GeneralSettingsBreadcrumb />}>
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("general.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("general.subtitle")}
          </p>
        </div>

        <GeneralSettingsClient />
      </div>
    </AppSidebarInset>
  );
}
