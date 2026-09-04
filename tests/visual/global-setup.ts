import { chromium, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";

export default async function globalSetup(config: FullConfig) {
  if (process.env.PLAYWRIGHT_AUTH_STATE) return;
  const email = process.env.VISUAL_TEST_EMAIL;
  const password = process.env.VISUAL_TEST_PASSWORD;
  if (!email || !password) {
    if (process.env.CI) throw new Error("CI 视觉回归需要 VISUAL_TEST_EMAIL 和 VISUAL_TEST_PASSWORD，或 PLAYWRIGHT_AUTH_STATE。");
    return;
  }
  const baseURL = config.projects[0]?.use.baseURL as string;
  await mkdir(".auth", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login?next=/dashboard`);
  await page.getByLabel("企业邮箱").fill(email);
  await page.getByLabel("登录密码").fill(password);
  await page.getByRole("button", { name: "登录德馨星云" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await page.context().storageState({ path: ".auth/employee.json" });
  await browser.close();
}
