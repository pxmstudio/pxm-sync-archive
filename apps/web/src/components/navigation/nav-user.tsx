"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import {
  BadgeCheck,
  ChevronsUpDown,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import { useLocale, useTranslation, LOCALE_NAMES, LOCALES, type Locale } from "@workspace/i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";

/**
 * Render the user avatar trigger and dropdown menu containing account links, theme controls, locale selector, and sign-out.
 *
 * The displayed user name, email, avatar, and initials are derived from the authenticated user. If the user lacks access, an "Upgrade to Pro" item is shown. Theme selection updates the UI theme; changing the locale updates the application locale. The sign-out item redirects to the root URL.
 *
 * @returns A JSX element rendering the avatar button and its associated dropdown menu with account, billing, theme, locale, and sign-out controls.
 */
export function NavUser() {
  const { isMobile } = useSidebar();
  const { setTheme } = useTheme();
  const { user } = useUser();
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation("common");

  const name = user?.fullName ?? user?.firstName ?? t("userMenu.user");
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const avatar = user?.imageUrl ?? "";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <a href="https://account.pixelmakers.com/profile" target="_blank" rel="noopener noreferrer">
                  <BadgeCheck />
                  {t("userMenu.account")}
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun />
                {t("userMenu.light")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon />
                {t("userMenu.dark")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {LOCALE_NAMES[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DropdownMenuSeparator />
            <SignOutButton redirectUrl="https://pixelmakers.com">
              <DropdownMenuItem>
                <LogOut />
                {t("userMenu.logOut")}
              </DropdownMenuItem>
            </SignOutButton>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}