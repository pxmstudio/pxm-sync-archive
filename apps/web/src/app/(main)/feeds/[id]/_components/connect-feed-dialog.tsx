"use client";

import { useState } from "react";
import { AlertCircle, Link2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
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
import { Spinner } from "@workspace/ui/components/spinner";

interface ConnectFeedDialogProps {
  feedId: string;
  feedName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ConnectFeedDialog({
  feedId,
  feedName,
  open,
  onOpenChange,
  onSuccess,
}: ConnectFeedDialogProps) {
  const { t } = useTranslation("feeds");
  const { getToken } = useAuth();
  const [feedUrl, setFeedUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedUrl.trim()) {
      setError(t("connect.urlRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await apiClient(`/internal/feeds/${feedId}/verify-public`, {
        method: "POST",
        token,
        body: JSON.stringify({ feedUrl: feedUrl.trim() }),
      });

      onSuccess();
      onOpenChange(false);
      setFeedUrl("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("connect.verificationFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("connect.title")}
          </DialogTitle>
          <DialogDescription>
            {t("connect.description", { name: feedName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedUrl">{t("connect.feedUrlLabel")}</Label>
            <Input
              id="feedUrl"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={feedUrl}
              onChange={(e) => {
                setFeedUrl(e.target.value);
                setError(null);
              }}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {t("connect.feedUrlHint")}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="h-4 w-4 mr-2" />}
              {t("connect.verify")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
