const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function isSupabaseAdminConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

export function getSupabasePublicConfig() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase 尚未配置，请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。",
    );
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}

export function getSupabaseAdminConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase 管理端尚未配置，请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。",
    );
  }

  return {
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
  };
}
