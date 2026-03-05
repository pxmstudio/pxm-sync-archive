"use client";

import { useState } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import {
  Users,
  Mail,
  Plus,
  Clock,
  X,
  AlertCircle,
  MoreVertical,
  UserMinus,
  Shield,
  User,
} from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";

export function TeamSettingsClient() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { user } = useUser();
  const { organization, memberships, invitations, isLoaded } = useOrganization({
    memberships: { pageSize: 50 },
    invitations: { pageSize: 20 },
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"org:admin" | "org:member">("org:member");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleInvite = async () => {
    if (!organization || !email) return;

    setIsInviting(true);
    setError(null);

    try {
      await organization.inviteMember({
        emailAddress: email,
        role,
      });
      setEmail("");
      invitations?.revalidate?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("team.failedToSend")
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!organization) return;

    try {
      const invitation = invitations?.data?.find((i) => i.id === invitationId);
      await invitation?.revoke();
      invitations?.revalidate?.();
    } catch {
      // Silently fail revoke
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;

    setIsRemoving(true);
    try {
      const membership = memberships?.data?.find(
        (m) => m.id === removingMember.id
      );
      await membership?.destroy();
      memberships?.revalidate?.();
      setRemovingMember(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("team.failedToRemove")
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateRole = async (
    membershipId: string,
    newRole: "org:admin" | "org:member"
  ) => {
    try {
      const membership = memberships?.data?.find((m) => m.id === membershipId);
      await membership?.update({ role: newRole });
      memberships?.revalidate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("team.failedToUpdateRole"));
    }
  };

  const pendingInvitations =
    invitations?.data?.filter((i) => i.status === "pending") || [];
  const members = memberships?.data || [];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t("team.inviteTeamMembers")}</CardTitle>
              <CardDescription>
                {t("team.sendEmailInvitations")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1"
            />
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "org:admin" | "org:member")}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org:member">{t("team.roles.member")}</SelectItem>
                <SelectItem value="org:admin">{t("team.roles.admin")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleInvite}
              disabled={isInviting || !email || !isLoaded}
            >
              {isInviting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("team.inviteMember")}
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}

          {/* Pending invitations */}
          {pendingInvitations.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                {t("team.pendingInvitations")} ({pendingInvitations.length})
              </p>
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {invitation.emailAddress}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {invitation.role?.replace("org:", "")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {t("team.pending")}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(invitation.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t("team.members")}</CardTitle>
              <CardDescription>
                {t("team.membersCount", { count: members.length })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("team.noMembersYet")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((membership) => {
                const isCurrentUser =
                  membership.publicUserData?.userId === user?.id;
                const isAdmin = membership.role === "org:admin";

                return (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {isAdmin ? (
                          <Shield className="h-5 w-5 text-primary" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          {membership.publicUserData?.firstName}{" "}
                          {membership.publicUserData?.lastName}
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">
                              {t("team.you")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {membership.publicUserData?.identifier}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isAdmin ? "default" : "outline"}>
                        {isAdmin ? t("team.roles.admin") : t("team.roles.member")}
                      </Badge>
                      {!isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateRole(
                                  membership.id,
                                  isAdmin ? "org:member" : "org:admin"
                                )
                              }
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              {isAdmin ? t("team.demoteToMember") : t("team.promoteToAdmin")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                setRemovingMember({
                                  id: membership.id,
                                  name: `${membership.publicUserData?.firstName || ""} ${membership.publicUserData?.lastName || ""}`.trim() ||
                                    membership.publicUserData?.identifier ||
                                    "this member",
                                })
                              }
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              {t("team.removeFromTeam")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.removingMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.confirmRemove", { name: removingMember?.name || "" })} {t("team.willLoseAccess")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {t("team.removing")}
                </>
              ) : (
                t("team.remove")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
