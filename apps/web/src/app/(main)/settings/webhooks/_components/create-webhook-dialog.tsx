"use client";

import { useState, useCallback } from "react";
import {
  useCreateWebhook,
  EVENT_TYPE_CATEGORIES,
  EVENT_TYPE_LABELS,
  type EventType,
  type WebhookSubscriptionCreated,
} from "@/hooks/use-webhooks";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (webhook: WebhookSubscriptionCreated) => void;
}

export function CreateWebhookDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWebhookDialogProps) {
  const { t } = useTranslation("settings");
  const { createWebhook, isLoading, error } = useCreateWebhook();
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<EventType[]>([]);

  const handleEventToggle = useCallback((event: EventType, checked: boolean) => {
    setSelectedEvents((prev) =>
      checked ? [...prev, event] : prev.filter((e) => e !== event)
    );
  }, []);

  const handleCategoryToggle = useCallback((category: keyof typeof EVENT_TYPE_CATEGORIES, checked: boolean) => {
    const events = EVENT_TYPE_CATEGORIES[category];
    setSelectedEvents((prev) => {
      if (checked) {
        const newEvents = new Set([...prev, ...events]);
        return Array.from(newEvents);
      } else {
        return prev.filter((e) => !events.includes(e));
      }
    });
  }, []);

  const isCategoryChecked = useCallback((category: keyof typeof EVENT_TYPE_CATEGORIES) => {
    const events = EVENT_TYPE_CATEGORIES[category];
    return events.every((e) => selectedEvents.includes(e));
  }, [selectedEvents]);

  const isCategoryIndeterminate = useCallback((category: keyof typeof EVENT_TYPE_CATEGORIES) => {
    const events = EVENT_TYPE_CATEGORIES[category];
    const checkedCount = events.filter((e) => selectedEvents.includes(e)).length;
    return checkedCount > 0 && checkedCount < events.length;
  }, [selectedEvents]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!url.trim() || selectedEvents.length === 0) return;

      try {
        const webhook = await createWebhook({
          url: url.trim(),
          eventTypes: selectedEvents,
        });
        onCreated(webhook);
        setUrl("");
        setSelectedEvents([]);
      } catch {
        // Error is handled by the hook
      }
    },
    [url, selectedEvents, createWebhook, onCreated]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setUrl("");
        setSelectedEvents([]);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("webhooks.create.title")}</DialogTitle>
            <DialogDescription>
              {t("webhooks.create.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">{t("webhooks.create.url")}</Label>
              <Input
                id="url"
                type="url"
                placeholder={t("webhooks.create.urlPlaceholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("webhooks.create.events")}</Label>
              <div className="space-y-4 rounded-md border p-3 max-h-64 overflow-y-auto">
                {(Object.keys(EVENT_TYPE_CATEGORIES) as (keyof typeof EVENT_TYPE_CATEGORIES)[]).map((category) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`category-${category}`}
                        checked={isCategoryChecked(category)}
                        data-indeterminate={isCategoryIndeterminate(category)}
                        onCheckedChange={(checked) =>
                          handleCategoryToggle(category, checked === true)
                        }
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`category-${category}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {category}
                      </label>
                    </div>
                    <div className="ml-6 space-y-2">
                      {EVENT_TYPE_CATEGORIES[category].map((event) => (
                        <div key={event} className="flex items-center space-x-3">
                          <Checkbox
                            id={event}
                            checked={selectedEvents.includes(event)}
                            onCheckedChange={(checked) =>
                              handleEventToggle(event, checked === true)
                            }
                            disabled={isLoading}
                          />
                          <label
                            htmlFor={event}
                            className="text-sm text-muted-foreground cursor-pointer"
                          >
                            {EVENT_TYPE_LABELS[event]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {t("webhooks.create.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !url.trim() || selectedEvents.length === 0}
            >
              {isLoading ? t("webhooks.create.creating") : t("webhooks.createWebhook")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
