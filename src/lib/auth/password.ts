export const PASSWORD_RECOVERY_COOKIE = "dexin-password-recovery";
export const PASSWORD_MIN_LENGTH = 12;

export function safePasswordReturnPath(value: string | null | undefined) {
  return value === "/reset-password" ? value : "/reset-password";
}

export function passwordPolicyError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `新密码至少需要 ${PASSWORD_MIN_LENGTH} 位。`;
  }

  const categoryCount = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (categoryCount < 3) {
    return "新密码需至少包含大写字母、小写字母、数字、符号中的三类。";
  }

  return null;
}

export function passwordConfirmationError(
  password: string,
  confirmation: string,
) {
  return password === confirmation ? null : "两次输入的新密码不一致。";
}

export function getPasswordRecoveryRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) {
    throw new Error("未配置 NEXT_PUBLIC_APP_URL。");
  }

  const appUrl = new URL(configuredUrl);
  if (!['http:', 'https:'].includes(appUrl.protocol)) {
    throw new Error("NEXT_PUBLIC_APP_URL 必须是 HTTP(S) 地址。");
  }

  const redirectUrl = new URL("/auth/confirm", appUrl.origin);
  redirectUrl.searchParams.set("next", "/reset-password");
  return redirectUrl.toString();
}
