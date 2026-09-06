import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { resolveRole, type Role } from "@/lib/roles";

export async function getCurrentRole(): Promise<Role> {
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  return resolveRole(user.publicMetadata as { role?: string }, email);
}
