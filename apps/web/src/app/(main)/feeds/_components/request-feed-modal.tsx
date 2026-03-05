"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useFeedSourceRequest } from "@/hooks/use-feed-sources";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
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
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";

interface RequestFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RequestFeedModal({
  open,
  onOpenChange,
  onSuccess,
}: RequestFeedModalProps) {
  const [feedName, setFeedName] = useState("");
  const [feedWebsite, setFeedWebsite] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [credentialsProvided, setCredentialsProvided] = useState(false);
  const [success, setSuccess] = useState(false);

  const { requestNewFeedSource, isSubmitting, error, clearError } =
    useFeedSourceRequest();

  const resetForm = () => {
    setFeedName("");
    setFeedWebsite("");
    setFeedUrl("");
    setNotes("");
    setCredentialsProvided(false);
    setSuccess(false);
    clearError();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    try {
      await requestNewFeedSource({
        feedName,
        feedWebsite: feedWebsite || undefined,
        feedUrl: feedUrl || undefined,
        notes: notes || undefined,
        credentialsProvided,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleOpenChange(false);
      }, 2000);
    } catch {
      // Error is handled by the hook
    }
  };

  const isValid = feedName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request a New Feed</DialogTitle>
          <DialogDescription>
            Can&apos;t find a feed in the Feed Library? Submit a request
            and we&apos;ll work on adding it. Feeds with more requests get
            prioritized.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Request Submitted!</p>
            <p className="text-sm text-muted-foreground mt-1">
              We&apos;ll review your request and work on adding this feed to
              the Feed Library.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="feed-name">
                  Feed Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="feed-name"
                  placeholder="e.g., Acme Wholesale"
                  value={feedName}
                  onChange={(e) => setFeedName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feed-website">Website (optional)</Label>
                <Input
                  id="feed-website"
                  placeholder="https://example.com"
                  value={feedWebsite}
                  onChange={(e) => setFeedWebsite(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feed-url">Feed URL (optional)</Label>
                <Input
                  id="feed-url"
                  placeholder="https://example.com/feed.xml"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If you know the URL of their product feed, it helps us set things
                  up faster.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information that might be helpful..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="credentials-provided"
                  checked={credentialsProvided}
                  onCheckedChange={(checked) =>
                    setCredentialsProvided(checked === true)
                  }
                />
                <label
                  htmlFor="credentials-provided"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  I can provide login credentials for their portal
                </label>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
