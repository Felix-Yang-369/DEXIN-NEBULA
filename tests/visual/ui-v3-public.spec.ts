import { expect, test } from "@playwright/test";

test("登录页遵循 UI V3 固定浅色视觉基线", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/login?lang=zh");
  await expect(page).toHaveTitle(/登录.*德馨星云/);
  await expect(page.getByRole("heading", { name: "登录德馨星云" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录德馨星云" })).toBeVisible();

  const layout = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    hasContent: document.body.innerText.trim().length > 0,
    hasErrorOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
    hasHorizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  expect(layout.background).toBe("rgb(245, 247, 249)");
  expect(layout.hasContent).toBe(true);
  expect(layout.hasErrorOverlay).toBe(false);
  expect(layout.hasHorizontalOverflow).toBe(false);

  await page.getByLabel("企业邮箱").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("登录密码")).toBeFocused();

  await expect(page).toHaveScreenshot("login.png", { fullPage: true });
});
