"use client";

import { Globe, Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSyncSettingsContext } from "./context";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Switch } from "@workspace/ui/components/switch";

/**
 * Render a card UI to configure sales channel publication settings for a feed.
 *
 * Renders an override toggle that switches between global and per-feed publication behavior,
 * displays current global defaults when not overriding, and — when overriding — provides
 * radio options for using integration defaults, custom channels, or disabling publishing.
 * When custom channels are selected, a refreshable selectable list of available sales channels
 * is shown and changes update the sync settings context.
 *
 * @returns A React element containing controls to view and edit global vs. per‑feed sales channel publication settings, including override toggle, mode selection, and channel selection list.
 */
export function SalesChannelsCard() {
  const {
    publicationOverride,
    setPublicationOverride,
    usePublicationsOverride,
    setUsePublicationsOverride,
    availablePublications,
    isLoadingPublications,
    fetchPublications,
    globalSyncSettings,
    setIsDirty,
  } = useSyncSettingsContext();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Sales Channels
              {usePublicationsOverride && (
                <Badge variant="secondary" className="ml-2">Override</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Choose where synced products are published in your Shopify store
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Override Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Override Global Settings</Label>
            <p className="text-sm text-muted-foreground">
              {usePublicationsOverride
                ? "Using custom sales channels for this feed"
                : "Using global sales channel settings"}
              {!usePublicationsOverride && (
                <Link
                  href="/sync"
                  className="ml-1 text-primary hover:underline"
                >
                  Edit global settings
                </Link>
              )}
            </p>
          </div>
          <Switch
            checked={usePublicationsOverride}
            onCheckedChange={(checked) => {
              setUsePublicationsOverride(checked);
              if (!checked) {
                if (globalSyncSettings?.defaultPublications) {
                  const globalPubs = globalSyncSettings.defaultPublications;
                  setPublicationOverride({
                    mode: globalPubs.mode === "all" ? "default" : globalPubs.mode === "none" ? "none" : "override",
                    publicationIds: globalPubs.publicationIds || [],
                  });
                } else {
                  setPublicationOverride(null);
                }
              }
              setIsDirty(true);
            }}
          />
        </div>

        {/* Show global settings info when not overriding */}
        {!usePublicationsOverride && globalSyncSettings?.defaultPublications && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <strong>Global setting:</strong>{" "}
                {globalSyncSettings.defaultPublications.mode === "all" && "Publish to all channels"}
                {globalSyncSettings.defaultPublications.mode === "none" && "Don't publish to any channel"}
                {globalSyncSettings.defaultPublications.mode === "selected" && (
                  <span>
                    Publish to {globalSyncSettings.defaultPublications.publicationIds?.length || 0} selected channels
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!usePublicationsOverride && !globalSyncSettings?.defaultPublications && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                No global sales channel settings configured. Using integration defaults.
              </div>
            </div>
          </div>
        )}

        {/* Only show editing when using override */}
        {usePublicationsOverride && (
          <>
            <RadioGroup
              value={publicationOverride?.mode || "default"}
              onValueChange={(value: "default" | "override" | "none") => {
                setPublicationOverride((prev) => ({
                  mode: value,
                  publicationIds: prev?.publicationIds || [],
                }));
              }}
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="default" id="pub-default" />
                <Label htmlFor="pub-default" className="flex-1 cursor-pointer">
                  <div className="font-medium">Use integration defaults</div>
                  <p className="text-sm text-muted-foreground">
                    Publish to channels configured in your Shopify integration
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="override" id="pub-override" />
                <Label htmlFor="pub-override" className="flex-1 cursor-pointer">
                  <div className="font-medium">Custom channels for this feed</div>
                  <p className="text-sm text-muted-foreground">
                    Choose specific channels for products from this feed
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="none" id="pub-none" />
                <Label htmlFor="pub-none" className="flex-1 cursor-pointer">
                  <div className="font-medium">Don&apos;t publish</div>
                  <p className="text-sm text-muted-foreground">
                    Products are created but not visible on any channel
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {publicationOverride?.mode === "override" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Select channels</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPublications}
                    disabled={isLoadingPublications}
                  >
                    {isLoadingPublications ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>
                {availablePublications.length === 0 ? (
                  <div className="text-center py-4">
                    {isLoadingPublications ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading sales channels...
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No sales channels found. Click &quot;Refresh&quot; to try again.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availablePublications.map((pub) => (
                      <div
                        key={pub.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border"
                      >
                        <Checkbox
                          id={pub.id}
                          checked={publicationOverride.publicationIds?.includes(pub.id)}
                          onCheckedChange={(checked) => {
                            setPublicationOverride((prev) => {
                              const currentIds = prev?.publicationIds || [];
                              const newIds = checked
                                ? [...currentIds, pub.id]
                                : currentIds.filter((id) => id !== pub.id);
                              return { ...prev!, publicationIds: newIds };
                            });
                          }}
                        />
                        <Label htmlFor={pub.id} className="flex-1 cursor-pointer">
                          <div className="font-medium">{pub.name}</div>
                          {pub.appTitle && (
                            <p className="text-xs text-muted-foreground">{pub.appTitle}</p>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}