import { NextRequest, NextResponse } from "next/server";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const SIGN_OUT_TIMEOUT_MS = 3_000;

async function signOutCurrentSession() {
  const supabase = await createClient();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }).then(() => undefined),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, SIGN_OUT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function clearProjectAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  const { url } = getSupabasePublicConfig();
  const projectRef = new URL(url).hostname.split(".")[0];
  const authCookieName = `sb-${projectRef}-auth-token`;

  for (const cookie of request.cookies.getAll()) {
    const belongsToCurrentProject =
      cookie.name === authCookieName ||
      cookie.name.startsWith(`${authCookieName}.`) ||
      cookie.name === `${authCookieName}-code-verifier`;

    if (belongsToCurrentProject) {
      response.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
      });
    }
  }
}

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    try {
      await signOutCurrentSession();
    } catch {
      // Cookie cleanup below is the local fallback when Supabase is unavailable.
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);

  if (isSupabaseConfigured()) {
    clearProjectAuthCookies(request, response);
  }

  return response;
}
