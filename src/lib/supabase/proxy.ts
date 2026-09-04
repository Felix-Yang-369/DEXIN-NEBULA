import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from "./config";
import {
  isFinanceScopeAllowedPath,
  isScopedFinanceUser,
} from "@/lib/auth/access-scope";

const protectedPrefixes = [
  "/dashboard",
  "/approvals",
  "/requests",
  "/announcements",
  "/organization",
  "/employees",
  "/hr",
  "/roles",
  "/finance",
  "/bi",
  "/ai",
  "/inventory",
  "/customers",
  "/quotes",
  "/sales",
  "/suppliers",
  "/purchasing",
  "/products",
  "/oa",
  "/operations",
  "/system",
  "/reports",
  "/knowledge",
  "/notifications",
  "/audit",
  "/search",
  "/help",
  "/account",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const defaultWorkspacePaths: Record<string, string> = {
  dashboard: "/dashboard",
  sales: "/sales",
  inventory: "/inventory",
  finance: "/finance",
  oa: "/oa",
};

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: verifiedToken } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(verifiedToken?.claims.sub);
  const { pathname } = request.nextUrl;
  const needsBootstrap =
    isAuthenticated &&
    (pathname === "/login" || !isFinanceScopeAllowedPath(pathname));
  const { data: bootstrapData } = needsBootstrap
    ? await supabase.rpc("current_app_bootstrap")
    : { data: null };
  const bootstrap = (bootstrapData ?? {}) as {
    employee?: { roleCodes?: string[] };
    workspace?: { defaultWorkspace?: string };
  };

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    const requestedPath = request.nextUrl.searchParams.get("next");
    let destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : null;
    if (!destination) {
      destination =
        defaultWorkspacePaths[
          bootstrap.workspace?.defaultWorkspace ?? "dashboard"
        ] ?? "/dashboard";
    }
    const destinationUrl = new URL(destination, request.url);
    dashboardUrl.pathname = destinationUrl.pathname;
    dashboardUrl.search = "";
    dashboardUrl.search = destinationUrl.search;
    return NextResponse.redirect(dashboardUrl);
  }

  if (isAuthenticated && !isFinanceScopeAllowedPath(pathname)) {
    if (isScopedFinanceUser(bootstrap.employee?.roleCodes ?? [])) {
      const financeUrl = request.nextUrl.clone();
      financeUrl.pathname = "/finance";
      financeUrl.search = "";
      financeUrl.searchParams.set("error", "restricted_access");
      return NextResponse.redirect(financeUrl);
    }
  }

  return response;
}
