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
      const authUserId = verifiedToken?.claims.sub;
      const { data: employee } = await supabase.from("employees").select("id").eq("auth_user_id", authUserId).eq("status", "active").maybeSingle();
      const { data: preference } = employee
        ? await supabase.from("workspace_preferences").select("default_workspace").eq("employee_id", employee.id).maybeSingle()
        : { data: null };
      destination = defaultWorkspacePaths[preference?.default_workspace ?? "dashboard"] ?? "/dashboard";
    }
    const destinationUrl = new URL(destination, request.url);
    dashboardUrl.pathname = destinationUrl.pathname;
    dashboardUrl.search = "";
    dashboardUrl.search = destinationUrl.search;
    return NextResponse.redirect(dashboardUrl);
  }

  if (isAuthenticated && !isFinanceScopeAllowedPath(pathname)) {
    const authUserId = verifiedToken?.claims.sub;
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle();

    if (employee) {
      const { data: roleRows } = await supabase
        .from("employee_roles")
        .select("roles(code)")
        .eq("employee_id", employee.id);
      const roleCodes = (roleRows ?? [])
        .map((row) => {
          const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
          return role?.code;
        })
        .filter((code): code is string => Boolean(code));

      if (isScopedFinanceUser(roleCodes)) {
        const financeUrl = request.nextUrl.clone();
        financeUrl.pathname = "/finance";
        financeUrl.search = "";
        financeUrl.searchParams.set("error", "restricted_access");
        return NextResponse.redirect(financeUrl);
      }
    }
  }

  return response;
}
