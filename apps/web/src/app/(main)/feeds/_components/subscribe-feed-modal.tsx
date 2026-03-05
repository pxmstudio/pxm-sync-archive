"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Link as LinkIcon, Key } from "lucide-react";
import type { FeedSource } from "@/hooks/use-feed-sources";
import { useFeedSourceSubscribe } from "@/hooks/use-feed-sources";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

interface SubscribeFeedModalProps {
  feedSource: FeedSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type AuthType = "basic" | "api_key" | "bearer" | "query_param";

export function SubscribeFeedModal({
  feedSource,
  open,
  onOpenChange,
  onSuccess,
}: SubscribeFeedModalProps) {
  const [activeTab, setActiveTab] = useState<"public" | "authenticated">("public");
  const [feedUrl, setFeedUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("basic");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [paramName, setParamName] = useState("");
  const [paramValue, setParamValue] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    verifyPublicFeed,
    verifyAuthenticatedFeed,
    isVerifying,
    verifyError,
    clearError,
  } = useFeedSourceSubscribe();

  const resetForm = () => {
    setFeedUrl("");
    setAuthType("basic");
    setUsername("");
    setPassword("");
    setHeaderName("");
    setHeaderValue("");
    setParamName("");
    setParamValue("");
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
    if (!feedSource) return;

    try {
      if (activeTab === "public") {
        await verifyPublicFeed(feedSource.id, feedUrl);
      } else {
        const credentials: {
          type: AuthType;
          username?: string;
          password?: string;
          headerName?: string;
          headerValue?: string;
          paramName?: string;
          paramValue?: string;
        } = { type: authType };

        switch (authType) {
          case "basic":
            credentials.username = username;
            credentials.password = password;
            break;
          case "api_key":
          case "bearer":
            credentials.headerName = headerName;
            credentials.headerValue = headerValue;
            break;
          case "query_param":
            credentials.paramName = paramName;
            credentials.paramValue = paramValue;
            break;
        }

        await verifyAuthenticatedFeed(feedSource.id, feedUrl, credentials);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleOpenChange(false);
      }, 1500);
    } catch {
      // Error is handled by the hook
    }
  };

  const isValid = feedUrl.trim().length > 0;

  if (!feedSource) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Subscribe to {feedSource.name}</DialogTitle>
          <DialogDescription>
            To access products from this feed, you need to verify that you have
            access to their product feed. Choose the verification method below.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Successfully Subscribed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              You can now browse products from {feedSource.name}
            </p>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "public" | "authenticated")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="public" className="gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Public Feed
                </TabsTrigger>
                <TabsTrigger value="authenticated" className="gap-2">
                  <Key className="h-4 w-4" />
                  Authenticated
                </TabsTrigger>
              </TabsList>

              <TabsContent value="public" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="public-feed-url">Feed URL</Label>
                  <Input
                    id="public-feed-url"
                    placeholder="https://example.com/feed.xml"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the exact URL of the product feed that was
                    provided to you.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="authenticated" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-feed-url">Feed URL</Label>
                  <Input
                    id="auth-feed-url"
                    placeholder="https://example.com/api/products"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="query_param">Query Parameter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {authType === "basic" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {(authType === "api_key" || authType === "bearer") && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="header-name">Header Name</Label>
                      <Input
                        id="header-name"
                        placeholder={
                          authType === "api_key" ? "X-API-Key" : "Authorization"
                        }
                        value={headerName}
                        onChange={(e) => setHeaderName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="header-value">
                        {authType === "api_key" ? "API Key" : "Token"}
                      </Label>
                      <Input
                        id="header-value"
                        type="password"
                        value={headerValue}
                        onChange={(e) => setHeaderValue(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {authType === "query_param" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="param-name">Parameter Name</Label>
                      <Input
                        id="param-name"
                        placeholder="api_key"
                        value={paramName}
                        onChange={(e) => setParamName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="param-value">Parameter Value</Label>
                      <Input
                        id="param-value"
                        type="password"
                        value={paramValue}
                        onChange={(e) => setParamValue(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>

            {verifyError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{verifyError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || isVerifying}>
                {isVerifying ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Subscribe"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
