"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Bell,
  RefreshCw,
  AlertTriangle,
  PackagePlus,
  Plug,
  Calendar,
  CalendarDays,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useTranslation } from "@workspace/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";

interface NotificationSettings {
  syncCompleted: boolean;
  syncFailed: boolean;
  newProducts: boolean;
  integrationIssues: boolean;
  weeklyDigest: boolean;
  monthlyDigest: boolean;
}

const defaultSettings: NotificationSettings = {
  syncCompleted: false,
  syncFailed: true,
  newProducts: true,
  integrationIssues: true,
  weeklyDigest: false,
  monthlyDigest: false,
};

/**
 * Render the notifications settings UI for viewing and managing an organization's notification preferences.
 *
 * Loads the current notification settings on mount, allows toggling individual preferences with optimistic updates
 * and server-side persistence, and enables digest options only for users on the Growth or Scale tiers.
 *
 * @returns A React element rendering the notifications settings interface
 */
export function NotificationsSettingsClient() {
  const { t } = useTranslation("settings");
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof NotificationSettings | null>(null);

  // All users have full access to email notifications (billing removed)
  const hasEmailNotifications = true;

  const fetchSettings = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const data = await apiClient<{ notifications: NotificationSettings }>(
        "/internal/organizations/me/notifications",
        { token }
      );
      setSettings({ ...defaultSettings, ...data.notifications });
    } catch {
      // Use defaults on error
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    // Block digest settings if user doesn't have email notifications
    if ((key === "weeklyDigest" || key === "monthlyDigest") && !hasEmailNotifications) {
      return;
    }

    setSavingKey(key);
    const previousValue = settings[key];

    // Optimistic update
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await apiClient("/internal/organizations/me/notifications", {
        method: "PATCH",
        token,
        body: JSON.stringify({ [key]: value }),
      });

      toast.success(t("notifications.preferenceSaved"));
    } catch {
      // Revert on error
      setSettings((prev) => ({ ...prev, [key]: previousValue }));
      toast.error(t("notifications.failedToSave"));
    } finally {
      setSavingKey(null);
    }
  };

  const notificationOptions = useMemo(
    () => [
      {
        key: "syncCompleted" as const,
        label: t("notifications.syncCompleted"),
        description: t("notifications.syncCompletedDesc"),
        icon: RefreshCw,
      },
      {
        key: "syncFailed" as const,
        label: t("notifications.syncFailed"),
        description: t("notifications.syncFailedDesc"),
        icon: AlertTriangle,
      },
      {
        key: "newProducts" as const,
        label: t("notifications.newProducts"),
        description: t("notifications.newProductsDesc"),
        icon: PackagePlus,
      },
      {
        key: "integrationIssues" as const,
        label: t("notifications.integrationIssues"),
        description: t("notifications.integrationIssuesDesc"),
        icon: Plug,
      },
    ],
    [t]
  );

  const digestOptions = useMemo(
    () => [
      {
        key: "weeklyDigest" as const,
        label: t("notifications.weeklyDigest"),
        description: t("notifications.weeklyDigestDesc"),
        icon: Calendar,
      },
      {
        key: "monthlyDigest" as const,
        label: t("notifications.monthlyDigest"),
        description: t("notifications.monthlyDigestDesc"),
        icon: CalendarDays,
      },
    ],
    [t]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Email Notifications Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Digest Reports Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t("notifications.emailNotifications")}</CardTitle>
              <CardDescription>
                {t("notifications.chooseNotifications")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationOptions.map((option) => {
            const Icon = option.icon;
            const isSaving = savingKey === option.key;

            return (
              <div
                key={option.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Label htmlFor={option.key} className="flex flex-col items-start gap-1 cursor-pointer text-left">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {option.description}
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    id={option.key}
                    checked={settings[option.key]}
                    onCheckedChange={(checked) =>
                      updateSetting(option.key, checked)
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Digest Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{t("notifications.digestReports")}</CardTitle>
              <CardDescription>
                {t("notifications.digestReportsDesc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {digestOptions.map((option) => {
            const Icon = option.icon;
            const isSaving = savingKey === option.key;

            return (
              <div
                key={option.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Label
                    htmlFor={option.key}
                    className="flex flex-col items-start gap-1 text-left cursor-pointer"
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {option.description}
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    id={option.key}
                    checked={settings[option.key]}
                    onCheckedChange={(checked) =>
                      updateSetting(option.key, checked)
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}