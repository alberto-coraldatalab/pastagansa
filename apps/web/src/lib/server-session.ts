import "server-only";
import { cookies } from "next/headers";
import {
  companyMembershipsFor,
  findMembership,
  normalizeApiError,
  selectMembership,
  type IdentityContext,
  type TenantSelection,
} from "./session";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const secure = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function authenticate(
  action: "login" | "register",
  payload: unknown,
) {
  const response = await fetch(`${apiBaseUrl}/v1/identity/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => undefined)) as
    TokenPair | unknown;
  if (!response.ok)
    throw new SessionError(normalizeApiError(body), response.status);
  const tokens = body as TokenPair;
  const context = await requestContext(tokens.accessToken);
  const membership = selectMembership(context);
  if (!membership)
    throw new SessionError("Tu usuario no tiene ninguna empresa activa.", 403);
  await writeSession(tokens, {
    organizationId: membership.organization.id,
    companyId: membership.company.id,
  });
  return membership;
}

export async function currentSession() {
  const session = await resolveSession();
  return {
    user: session.user,
    membership: session.membership,
    memberships: companyMembershipsFor(session.context),
  };
}

export async function changeTenant(selection: TenantSelection) {
  const session = await resolveSession();
  const membership = findMembership(session.context, selection);
  if (!membership)
    throw new SessionError("No tienes acceso a la empresa seleccionada.", 403);
  const store = await cookies();
  writeTenant(store, selection);
  return membership;
}

export async function tenantApiRequest(path: string, init?: RequestInit) {
  const { accessToken, membership } = await resolveSession();
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${accessToken}`,
      "x-organization-id": membership.organization.id,
      "x-company-id": membership.company.id,
    },
    cache: "no-store",
  });
}

async function resolveSession() {
  const store = await cookies();
  let accessToken = store.get("pg_access")?.value;
  const refreshToken = store.get("pg_refresh")?.value;
  const selection = readSelection(store.get("pg_tenant")?.value);
  let context: IdentityContext | undefined;

  if (accessToken) {
    const response = await contextResponse(accessToken);
    if (response.ok) context = (await response.json()) as IdentityContext;
    else if (response.status !== 401)
      throw new SessionError(
        normalizeApiError(await response.json().catch(() => undefined)),
        response.status,
      );
  }

  if (!context && refreshToken) {
    const tokens = await refresh(refreshToken);
    accessToken = tokens.accessToken;
    context = await requestContext(accessToken);
    const membership = selectMembership(context, selection);
    if (!membership)
      throw new SessionError(
        "Tu usuario no tiene ninguna empresa activa.",
        403,
      );
    await writeSession(tokens, {
      organizationId: membership.organization.id,
      companyId: membership.company.id,
    });
  }

  if (!context) throw new SessionError("Tu sesión ha caducado.", 401);
  const membership = selectMembership(context, selection);
  if (!membership)
    throw new SessionError("Tu usuario no tiene ninguna empresa activa.", 403);
  return {
    accessToken,
    context,
    user: { id: context.id, email: context.email },
    membership,
  };
}

export async function logoutSession() {
  const store = await cookies();
  const accessToken = store.get("pg_access")?.value;
  if (accessToken)
    await fetch(`${apiBaseUrl}/v1/identity/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => undefined);
  clearSession(store);
}

async function requestContext(accessToken: string) {
  const response = await contextResponse(accessToken);
  const body = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new SessionError(normalizeApiError(body), response.status);
  return body as IdentityContext;
}

function contextResponse(accessToken: string) {
  return fetch(`${apiBaseUrl}/v1/identity/context`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

async function refresh(refreshToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/identity/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const store = await cookies();
    clearSession(store);
    throw new SessionError("Tu sesión ha caducado.", 401);
  }
  return body as TokenPair;
}

async function writeSession(tokens: TokenPair, tenant: TenantSelection) {
  const store = await cookies();
  store.set("pg_access", tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  store.set("pg_refresh", tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60,
  });
  writeTenant(store, tenant);
}

function writeTenant(
  store: Awaited<ReturnType<typeof cookies>>,
  tenant: TenantSelection,
) {
  store.set("pg_tenant", JSON.stringify(tenant), {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60,
  });
}

function clearSession(store: Awaited<ReturnType<typeof cookies>>) {
  for (const name of ["pg_access", "pg_refresh", "pg_tenant"])
    store.set(name, "", { ...cookieOptions, maxAge: 0 });
}

function readSelection(value?: string): TenantSelection | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<TenantSelection>;
    if (
      typeof parsed.organizationId === "string" &&
      typeof parsed.companyId === "string"
    )
      return parsed as TenantSelection;
  } catch {
    return undefined;
  }
  return undefined;
}

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
