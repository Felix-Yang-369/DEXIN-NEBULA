import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildSessionUser,
  createOpaqueToken,
  hashOpaqueToken,
} from "./auth";
import { getMiniprogramConfig } from "./config";
import type {
  MiniprogramSessionResponse,
  MiniprogramSessionUser,
  WeChatCodeSession,
} from "./types";

type IdentityRow = {
  id: string;
  app_id: string;
  open_id: string;
  union_id: string | null;
  employee_id: string | null;
  display_name: string;
  status: "active" | "blocked";
};

async function resolveIdentity(codeSession: WeChatCodeSession) {
  const admin = createAdminClient();
  const { appId } = getMiniprogramConfig();
  const identityColumns =
    "id, app_id, open_id, union_id, employee_id, display_name, status";

  const { data: openIdIdentity, error: openIdError } = await admin
    .from("miniprogram_identities")
    .select(identityColumns)
    .eq("app_id", appId)
    .eq("open_id", codeSession.openid)
    .maybeSingle();
  if (openIdError) throw openIdError;

  let identity = openIdIdentity as IdentityRow | null;
  if (!identity && codeSession.unionid) {
    const { data: unionIdentity, error: unionError } = await admin
      .from("miniprogram_identities")
      .select(identityColumns)
      .eq("app_id", appId)
      .eq("union_id", codeSession.unionid)
      .maybeSingle();
    if (unionError) throw unionError;
    identity = unionIdentity as IdentityRow | null;
  }

  if (identity) {
    const { data, error } = await admin
      .from("miniprogram_identities")
      .update({
        open_id: codeSession.openid,
        union_id: codeSession.unionid ?? identity.union_id,
        last_login_at: new Date().toISOString(),
      })
      .eq("id", identity.id)
      .select(identityColumns)
      .single();
    if (error) throw error;
    return data as IdentityRow;
  }

  const { data, error } = await admin
    .from("miniprogram_identities")
    .insert({
      app_id: appId,
      open_id: codeSession.openid,
      union_id: codeSession.unionid ?? null,
      last_login_at: new Date().toISOString(),
    })
    .select(identityColumns)
    .single();
  if (error) throw error;
  return data as IdentityRow;
}

async function sessionUserForIdentity(
  identity: IdentityRow,
): Promise<MiniprogramSessionUser> {
  if (identity.status !== "active") throw new Error("IDENTITY_BLOCKED");
  if (!identity.employee_id) {
    return buildSessionUser({
      identityId: identity.id,
      displayName: identity.display_name,
    });
  }

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, employee_no, organization_id, name, status")
    .eq("id", identity.employee_id)
    .maybeSingle();
  if (employeeError) throw employeeError;
  if (!employee || employee.status !== "active") {
    throw new Error("EMPLOYEE_INACTIVE");
  }

  const { data: roleRows, error: roleError } = await admin
    .from("employee_roles")
    .select("roles(code)")
    .eq("employee_id", employee.id);
  if (roleError) throw roleError;
  const roleCodes = (roleRows ?? [])
    .map((row) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return role?.code;
    })
    .filter((code): code is string => Boolean(code));

  return buildSessionUser({
    identityId: identity.id,
    displayName: identity.display_name,
    employee: {
      id: employee.id,
      employeeNo: employee.employee_no,
      organizationId: employee.organization_id,
      name: employee.name,
    },
    roleCodes,
  });
}

export async function createMiniprogramSession(
  codeSession: WeChatCodeSession,
  metadata: Record<string, string>,
): Promise<MiniprogramSessionResponse> {
  const identity = await resolveIdentity(codeSession);
  const user = await sessionUserForIdentity(identity);
  const token = createOpaqueToken();
  const { sessionTtlHours } = getMiniprogramConfig();
  const expiresAt = Date.now() + sessionTtlHours * 60 * 60 * 1000;
  const admin = createAdminClient();
  const { error } = await admin.from("miniprogram_sessions").insert({
    identity_id: identity.id,
    token_hash: hashOpaqueToken(token),
    expires_at: new Date(expiresAt).toISOString(),
    metadata,
  });
  if (error) throw error;

  return { accessToken: token, expiresAt, user };
}

export async function getMiniprogramSession(
  token: string,
): Promise<MiniprogramSessionResponse | null> {
  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("miniprogram_sessions")
    .select("id, identity_id, expires_at, revoked_at")
    .eq("token_hash", hashOpaqueToken(token))
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (
    !session
    || session.revoked_at
    || new Date(session.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const { data: identity, error: identityError } = await admin
    .from("miniprogram_identities")
    .select("id, app_id, open_id, union_id, employee_id, display_name, status")
    .eq("id", session.identity_id)
    .maybeSingle();
  if (identityError) throw identityError;
  if (!identity) return null;

  const user = await sessionUserForIdentity(identity as IdentityRow);
  await admin
    .from("miniprogram_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);

  return {
    accessToken: token,
    expiresAt: new Date(session.expires_at).getTime(),
    user,
  };
}

export async function revokeMiniprogramSession(token: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("miniprogram_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashOpaqueToken(token))
    .is("revoked_at", null);
  if (error) throw error;
}
