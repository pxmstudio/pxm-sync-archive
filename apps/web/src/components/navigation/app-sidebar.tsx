"use client";

import * as React from "react";
import {
  ChartAreaIcon,
  RefreshCw,
  Settings2,
  Rss,
  LifeBuoyIcon,
  ActivityIcon,
  Store,
} from "lucide-react";

import { NavMain } from "@/components/navigation/nav-main";
import { NavUser } from "@/components/navigation/nav-user";
import { OrganizationSwitcher } from "@/components/navigation/organization-switcher";
import { useTranslation } from "@workspace/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation("navigation");

  const data = {
    navMain: [
      {
        title: t("dashboard"),
        url: "/",
        icon: ChartAreaIcon,
        isActive: true,
      },
      {
        title: t("feeds"),
        url: "/feeds",
        icon: Rss,
      },
      {
        title: t("shop"),
        url: "/products",
        icon: Store,
      },
      {
        title: t("sync"),
        url: "/sync",
        icon: RefreshCw,
      },
      {
        title: t("activity"),
        url: "/activity",
        icon: ActivityIcon,
      },
      {
        title: t("settings"),
        url: "#",
        icon: Settings2,
        items: [
          {
            title: t("organization"),
            url: "https://account.pixelmakers.com/organization",
            newTab: true,
          },
          {
            title: t("integrations"),
            url: "/settings/integrations",
          },
          {
            title: t("notifications"),
            url: "/settings/notifications",
          },
          {
            title: t("apiKeys"),
            url: "/settings/api-keys",
          },
          {
            title: t("webhooks"),
            url: "/settings/webhooks",
          },
        ],
      },
    ],
    navSecondary: [
      {
        title: t("support"),
        url: "mailto:support@pixelmakers.com",
        icon: LifeBuoyIcon,
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavMain items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
