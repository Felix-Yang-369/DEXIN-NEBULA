import { expect, test } from "@playwright/test";

const authState = process.env.PLAYWRIGHT_AUTH_STATE ?? (process.env.VISUAL_TEST_EMAIL && process.env.VISUAL_TEST_PASSWORD ? ".auth/employee.json" : undefined);

test.describe("登录后关键模块视觉回归", () => {
  test.skip(!authState, "设置 PLAYWRIGHT_AUTH_STATE 后运行登录态关键页面基线");
  test.use({ storageState: authState });

  for (const route of [
    "/dashboard",
    "/finance",
    "/inventory",
    "/customers",
    "/documents",
    "/sales",
    "/approvals",
    "/system",
    "/ai",
    "/customer-service",
    "/mobile",
  ]) {
    test(`${route} 使用统一应用外壳`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.locator('[data-ui-system="v3"]')).toBeVisible();
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(245, 247, 249)",
      );
      await expect(page).toHaveScreenshot(`${route.slice(1)}.png`, {
        fullPage: true,
      });
    });
  }
});
