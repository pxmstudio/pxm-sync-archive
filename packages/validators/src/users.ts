import { z } from "zod";
import {
  userId,
  membershipId,
  organizationId,
  email,
  url,
  membershipRole,
} from "./common.js";

// ============================================
// User
// ============================================

export const createUser = z.object({
  externalAuthId: z.string().min(1).max(255),
  email: email,
  name: z.string().max(255).optional(),
  avatarUrl: url.optional(),
});

export type CreateUser = z.infer<typeof createUser>;

export const updateUser = z.object({
  name: z.string().max(255).optional(),
  avatarUrl: url.nullable().optional(),
});

export type UpdateUser = z.infer<typeof updateUser>;

export const user = createUser.extend({
  id: userId,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastSignInAt: z.coerce.date().nullable(),
});

export type User = z.infer<typeof user>;

// ============================================
// Membership
// ============================================

export const createMembership = z.object({
  userId: userId,
  organizationId: organizationId,
  role: membershipRole.default("member"),
});

export type CreateMembership = z.infer<typeof createMembership>;

export const updateMembership = z.object({
  role: membershipRole,
});

export type UpdateMembership = z.infer<typeof updateMembership>;

export const membership = createMembership.extend({
  id: membershipId,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Membership = z.infer<typeof membership>;

// ============================================
// Invite User
// ============================================

export const inviteUser = z.object({
  email: email,
  role: membershipRole.default("member"),
});

export type InviteUser = z.infer<typeof inviteUser>;
