export type MiniprogramRole = "customer" | "employee" | "admin";

export type MiniprogramSessionUser = {
  id: string;
  displayName: string;
  role: MiniprogramRole;
  employeeId?: string;
  employeeNo?: string;
  organizationId?: string;
  permissions: string[];
};

export type MiniprogramSessionResponse = {
  accessToken: string;
  expiresAt: number;
  user: MiniprogramSessionUser;
};

export type WeChatCodeSession = {
  openid: string;
  unionid?: string;
  session_key: string;
};
