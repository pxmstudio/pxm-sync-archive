"use client";

import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightLeft, ChevronsUpDown, Plus } from "lucide-react";

import { useTranslation } from "@workspace/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { Skeleton } from "@workspace/ui/components/skeleton";

const SUPPLIER_APP_URL = process.env.NEXT_PUBLIC_SUPPLIER_APP_URL || "https://b2b.pixelmakers.com/supplier";

export function OrganizationSwitcher() {
  const { t } = useTranslation("navigation");
  const { isMobile } = useSidebar();
  const { organization, isLoaded } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-4 w-24" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!organization) {
    return null;
  }

  const initials = organization.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Check if organization has the other role (for cross-app navigation)
  const roles = (organization.publicMetadata?.roles as string[]) || [];
  const hasSupplierRole = roles.includes("supplier");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {organization.imageUrl ? (
                  <Image
                    src={organization.imageUrl}
                    alt={organization.name}
                    width={32}
                    height={32}
                    className="size-8 rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold">{initials}</span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{organization.name}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("organizations")}
            </DropdownMenuLabel>
            {userMemberships.data?.map((membership) => {
              const org = membership.organization;
              const orgInitials = org.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => setActive?.({ organization: org.id })}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    {org.imageUrl ? (
                      <Image
                        src={org.imageUrl}
                        alt={org.name}
                        width={24}
                        height={24}
                        className="size-6 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-xs">{orgInitials}</span>
                    )}
                  </div>
                  {org.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href="/create-organization">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  {t("createOrganization")}
                </div>
              </Link>
            </DropdownMenuItem>
            {hasSupplierRole && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" asChild>
                  <a href={SUPPLIER_APP_URL}>
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                      <ArrowRightLeft className="size-4" />
                    </div>
                    <div className="text-muted-foreground font-medium">
                      {t("switchToSupplierPortal")}
                    </div>
                  </a>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
