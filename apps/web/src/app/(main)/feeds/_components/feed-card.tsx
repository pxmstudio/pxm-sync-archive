"use client";

import Link from "next/link";
import {
  ExternalLink,
  Package,
  Users,
  CheckCircle,
  Link as LinkIcon,
} from "lucide-react";
import type { Feed } from "@/hooks/use-feeds";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

interface FeedCardProps {
  feed: Feed;
  onSubscribe?: (feed: Feed) => void;
  onViewProducts?: (feed: Feed) => void;
}

export function FeedCard({
  feed,
  onSubscribe,
  onViewProducts,
}: FeedCardProps) {
  const initials = feed.name
    .split(" ")
    .map((word: string) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={feed.logoUrl || undefined} alt={feed.name} className="object-contain object-center" />
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            {feed.isSubscribed ? (
              <Badge
                variant="secondary"
                className="gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                <CheckCircle className="h-3 w-3" />
                Subscribed
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <LinkIcon className="h-3 w-3" />
                Feed
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-lg mt-3">{feed.name}</CardTitle>
        {feed.website && (
          <CardDescription className="flex items-center gap-1 text-xs">
            <ExternalLink className="h-3 w-3" />
            {feed.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {feed.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {feed.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic mb-4">
            No description available
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span>{feed.productCount.toLocaleString()} products</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{feed.subscriptionCount} subscribers</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-2">
          {feed.isSubscribed ? (
            onViewProducts ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onViewProducts(feed)}
              >
                View Products
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                asChild
              >
                <Link href={`/feeds/${feed.id}`}>
                  View Products
                </Link>
              </Button>
            )
          ) : (
            onSubscribe ? (
              <Button
                variant="default"
                className="w-full"
                onClick={() => onSubscribe(feed)}
              >
                Subscribe
              </Button>
            ) : (
              <Button
                variant="default"
                className="w-full"
                asChild
              >
                <Link href={`/feeds/${feed.id}`}>
                  View Details
                </Link>
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
