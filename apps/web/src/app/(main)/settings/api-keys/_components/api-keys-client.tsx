"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Key, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import {
  useApiKeys,
  useRevokeApiKey,
  type ApiKey,
  type ApiKeyCreated,
} from "@/hooks/use-api-keys";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { ApiKeyCreatedDialog } from "./api-key-created-dialog";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";
import { useTranslation, useLocale } from "@workspace/i18n";
import type { TranslationFunction } from "@workspace/i18n";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

function formatDate(dateString: string | null, locale: string, t: TranslationFunction) {
  if (!dateString) return t("apiKeys.time.never");
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateString: string | null, locale: string, t: TranslationFunction) {
  if (!dateString) return t("apiKeys.time.never");
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t("apiKeys.time.today");
  if (diffDays === 1) return t("apiKeys.time.yesterday");
  if (diffDays < 7) return t("apiKeys.time.daysAgo", { count: diffDays });
  if (diffDays < 30) return t("apiKeys.time.weeksAgo", { count: Math.floor(diffDays / 7) });
  return formatDate(dateString, locale, t);
}

/**
 * Render the API Keys management UI for the Settings page.
 *
 * Displays loading and error states, a list of API keys with controls to create and revoke keys,
 * and an empty-state when no keys exist.
 * Fetches the current keys on mount and manages dialogs for key creation, key-created confirmation,
 * and key revocation.
 *
 * @returns A JSX element containing the API Keys management interface.
 */
export function ApiKeysClient() {
  const { t } = useTranslation("settings");
  const { locale } = useLocale();
  const { keys, isLoading: isLoadingKeys, error, fetchKeys } = useApiKeys();
  const { revokeKey, isLoading: isRevoking } = useRevokeApiKey();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleKeyCreated = useCallback(
    (key: ApiKeyCreated) => {
      setCreatedKey(key);
      setCreateDialogOpen(false);
      fetchKeys();
    },
    [fetchKeys]
  );

  const handleRevoke = useCallback(
    async (key: ApiKey) => {
      await revokeKey(key.id);
      setKeyToRevoke(null);
      fetchKeys();
    },
    [revokeKey, fetchKeys]
  );

  if (isLoadingKeys) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive">{error.message}</p>
        <button
          onClick={fetchKeys}
          className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("apiKeys.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("apiKeys.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("apiKeys.description")}
          </p>
          <a
              href="https://sync.pixelmakers.com/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
            >
              {t("apiKeys.viewDocs")}
              <ExternalLink className="h-3 w-3" />
            </a>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("apiKeys.createKey")}
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <Key className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-semibold">{t("apiKeys.noKeys")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("apiKeys.noKeysDescription")}
          </p>
          <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("apiKeys.createKey")}
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("apiKeys.keyName")}</TableHead>
                <TableHead>{t("apiKeys.keyColumn")}</TableHead>
                <TableHead>{t("apiKeys.scopesColumn")}</TableHead>
                <TableHead>{t("apiKeys.lastUsed")}</TableHead>
                <TableHead>{t("apiKeys.createdColumn")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-sm">
                      {key.prefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 2).map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                      {key.scopes.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{key.scopes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(key.lastUsedAt, locale, t)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(key.createdAt, locale, t)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setKeyToRevoke(key)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("apiKeys.revokeKey")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleKeyCreated}
        hasFullAccess={true}
      />

      <ApiKeyCreatedDialog
        apiKey={createdKey}
        onClose={() => setCreatedKey(null)}
      />

      <RevokeApiKeyDialog
        apiKey={keyToRevoke}
        onClose={() => setKeyToRevoke(null)}
        onConfirm={handleRevoke}
        isLoading={isRevoking}
      />
    </div>
  );
}