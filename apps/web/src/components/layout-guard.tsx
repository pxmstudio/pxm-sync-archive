"use client";

import { useEffect } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useBootstrap } from "@/hooks/use-bootstrap";
import { FullScreenLoader } from "@workspace/ui/components/full-screen-loader";

interface LayoutGuardProps {
  children: React.ReactNode;
}

/**
 * Enforces app-level authentication, organization selection, and bootstrap-data guards before rendering children.
 */
export function LayoutGuard({ children }: LayoutGuardProps) {
  const { organization, isLoaded: isOrgLoaded } = useOrganization();

  const {
    isLoading,
    isAuthLoaded,
    isSignedIn,
  } = useBootstrap();

  // Handle redirects
  useEffect(() => {
    // Wait for auth to load
    if (!isAuthLoaded) return;

    // Redirect to sign-in if not authenticated
    if (!isSignedIn) {
      window.location.href = "/app/sign-in";
      return;
    }

    // Wait for org to load
    if (!isOrgLoaded) return;

    // Redirect to create organization if no org selected
    if (!organization?.id) {
      window.location.href = "/app/create-organization";
      return;
    }
  }, [
    isAuthLoaded,
    isSignedIn,
    isOrgLoaded,
    organization?.id,
  ]);

  // Single loading state for all initial checks
  if (!isAuthLoaded || !isOrgLoaded || isLoading) {
    return <FullScreenLoader />;
  }

  // Not signed in - show loader while redirecting
  if (!isSignedIn) {
    return <FullScreenLoader />;
  }

  // No organization - show loader while redirecting
  if (!organization?.id) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
