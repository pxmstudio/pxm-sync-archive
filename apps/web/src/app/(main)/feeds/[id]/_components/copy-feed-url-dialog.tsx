"use client";

import { useState, useCallback, useEffect } from "react";
import { Copy, Check, Plus, Key, FileText, FileCode } from "lucide-react";
import { useApiKeys, useCreateApiKey, type ApiKeyCreated } from "@/hooks/use-api-keys";
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
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";

interface CopyFeedUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedId: string;
  feedName: string;
}

type Format = "csv" | "xml";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://sync.pixelmakers.com/api";

export function CopyFeedUrlDialog({
  open,
  onOpenChange,
  feedId,
  feedName,
}: CopyFeedUrlDialogProps) {
  const { keys, isLoading: isLoadingKeys, fetchKeys } = useApiKeys();
  const { createKey, isLoading: isCreatingKey } = useCreateApiKey();

  const [format, setFormat] = useState<Format>("csv");
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Filter keys that have catalog:read permission
  const catalogKeys = keys.filter((key) => key.scopes.includes("catalog:read"));

  // Fetch keys when dialog opens
  useEffect(() => {
    if (open) {
      fetchKeys();
      // Reset state
      setFormat("csv");
      setSelectedKeyId("");
      setShowCreateKey(false);
      setNewKeyName("");
      setCreatedKey(null);
      setCopied(false);
      setGeneratedUrl(null);
    }
  }, [open, fetchKeys]);

  // Auto-select first key if available
  useEffect(() => {
    const firstKey = catalogKeys[0];
    if (firstKey && !selectedKeyId && !createdKey) {
      setSelectedKeyId(firstKey.id);
    }
  }, [catalogKeys, selectedKeyId, createdKey]);

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return;

    try {
      const key = await createKey({
        name: newKeyName.trim(),
        scopes: ["catalog:read"],
      });
      setCreatedKey(key);
      setShowCreateKey(false);
      setNewKeyName("");
      // Refresh keys list
      fetchKeys();
    } catch {
      // Error handled by hook
    }
  }, [newKeyName, createKey, fetchKeys]);

  const handleGenerateUrl = useCallback(() => {
    const apiKey = createdKey?.key;
    if (!apiKey) return;

    const url = `${API_BASE_URL}/v1/catalog?feedId=${feedId}&format=${format}&apiKey=${apiKey}`;
    setGeneratedUrl(url);
  }, [createdKey, feedId, format]);

  const handleCopyUrl = useCallback(async () => {
    if (!generatedUrl) return;

    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [generatedUrl]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setFormat("csv");
        setSelectedKeyId("");
        setShowCreateKey(false);
        setNewKeyName("");
        setCreatedKey(null);
        setCopied(false);
        setGeneratedUrl(null);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  const hasExistingKeys = catalogKeys.length > 0;
  const canGenerateUrl = createdKey?.key;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy Feed URL</DialogTitle>
          <DialogDescription>
            Generate a feed URL to import {feedName}&apos;s catalog into your system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as Format)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="csv"
                  id="csv"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="csv"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileText className="mb-3 h-6 w-6" />
                  <span className="font-medium">CSV</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Spreadsheet format
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="xml"
                  id="xml"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="xml"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileCode className="mb-3 h-6 w-6" />
                  <span className="font-medium">XML</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Structured data
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* API Key Selection */}
          <div className="space-y-3">
            <Label>API Key</Label>
            {isLoadingKeys ? (
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            ) : createdKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{createdKey.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {createdKey.prefix}...
                    </p>
                  </div>
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs text-muted-foreground">
                  This key has been created with catalog read permissions.
                </p>
              </div>
            ) : hasExistingKeys && !showCreateKey ? (
              <div className="space-y-3">
                <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an API key" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogKeys.map((key) => (
                      <SelectItem key={key.id} value={key.id}>
                        <div className="flex items-center gap-2">
                          <Key className="h-3 w-3" />
                          <span>{key.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">
                            ({key.prefix}...)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Note: You&apos;ll need to enter the full API key manually since we don&apos;t store it.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateKey(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Key Instead
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {!hasExistingKeys && (
                  <p className="text-sm text-muted-foreground">
                    You don&apos;t have any API keys with catalog permissions. Create one to generate a feed URL.
                  </p>
                )}
                <div className="space-y-2">
                  <Input
                    placeholder="Key name (e.g., Catalog Feed Key)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    disabled={isCreatingKey}
                  />
                  <div className="flex gap-2">
                    {hasExistingKeys && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateKey(false)}
                        disabled={isCreatingKey}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={handleCreateKey}
                      disabled={isCreatingKey || !newKeyName.trim()}
                      className="flex-1"
                    >
                      {isCreatingKey ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4 mr-2" />
                          Create Key
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generated URL */}
          {generatedUrl && (
            <div className="space-y-2">
              <Label>Feed URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted p-3 text-xs font-mono break-all select-all">
                  {generatedUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this URL to import the catalog. The URL includes your API key for authentication.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {generatedUrl ? "Done" : "Cancel"}
          </Button>
          {!generatedUrl && (
            <Button
              type="button"
              onClick={handleGenerateUrl}
              disabled={!canGenerateUrl}
            >
              Generate URL
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
