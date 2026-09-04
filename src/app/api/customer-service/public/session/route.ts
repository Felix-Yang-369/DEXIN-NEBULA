import { z } from "zod";
import { createCustomerSession, sessionSnapshot, verifyCustomerSession } from "@/features/customer-service/public-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  workspaceCode: z.string().regex(/^[a-z][a-z0-9-]{2,47}$/),
  origin: z.url(),
  pageUrl: z.url().max(1000).optional(),
  existingToken: z.string().max(3000).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "客服会话参数无效" }, { status: 400 });
    if (parsed.data.existingToken) {
      try {
        const verified = await verifyCustomerSession(parsed.data.existingToken, parsed.data.origin);
        const snapshot = await sessionSnapshot(verified);
        if (snapshot.workspace.code === parsed.data.workspaceCode) return Response.json({ token: parsed.data.existingToken, ...snapshot });
      } catch {
        // Expired or revoked sessions are replaced below.
      }
    }
    const created = await createCustomerSession({
      workspaceCode: parsed.data.workspaceCode,
      origin: parsed.data.origin,
      pageUrl: parsed.data.pageUrl,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    const verified = await verifyCustomerSession(created.token, parsed.data.origin);
    return Response.json({ token: created.token, ...(await sessionSnapshot(verified)) });
  } catch (error) {
    console.error("Customer service session failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "德小馨暂时无法建立会话，请稍后重试" }, { status: 503 });
  }
}
