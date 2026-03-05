"use client";

import { useState, useCallback, useEffect } from "react";
import {
  EVENT_TYPE_CATEGORIES,
  EVENT_TYPE_LABELS,
  type EventType,
  type WebhookSubscription,
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

interface EditWebhookDialogProps {
  webhook: WebhookSubscription | null;
  onClose: () => void;
  onSave: (id: string, data: { url?: string; eventTypes?: string[] }) => Promise<void>;
  isLoading: boolean;
}

export function EditWebhookDialog({
  webhook,
  onClose,
  onSave,
  isLoading,
}: EditWebhookDialogProps) {
  const { t } = useTranslation("settings");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<EventType[]>([]);

  useEffect(() => {
    if (webhook) {
      setUrl(webhook.url);
      setSelectedEvents(webhook.eventTypes);
    }
  }, [webhook]);

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!webhook || !url.trim() || selectedEvents.length === 0) return;

      await onSave(webhook.id, {
        url: url.trim(),
        eventTypes: selectedEvents,
      });
    },
    [webhook, url, selectedEvents, onSave]
  );

  const handleClose = useCallback(() => {
    setUrl("");
    setSelectedEvents([]);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={!!webhook} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("webhooks.editDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("webhooks.editDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-url">{t("webhooks.create.url")}</Label>
              <Input
                id="edit-url"
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
                        id={`edit-category-${category}`}
                        checked={isCategoryChecked(category)}
                        onCheckedChange={(checked) =>
                          handleCategoryToggle(category, checked === true)
                        }
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`edit-category-${category}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {category}
                      </label>
                    </div>
                    <div className="ml-6 space-y-2">
                      {EVENT_TYPE_CATEGORIES[category].map((event) => (
                        <div key={event} className="flex items-center space-x-3">
                          <Checkbox
                            id={`edit-${event}`}
                            checked={selectedEvents.includes(event)}
                            onCheckedChange={(checked) =>
                              handleEventToggle(event, checked === true)
                            }
                            disabled={isLoading}
                          />
                          <label
                            htmlFor={`edit-${event}`}
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t("webhooks.editDialog.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !url.trim() || selectedEvents.length === 0}
            >
              {isLoading ? t("webhooks.editDialog.saving") : t("webhooks.editDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
