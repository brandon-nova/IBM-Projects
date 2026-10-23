import { test, expect } from "@playwright/test";

test("public homepage is focused, responsive, and routes to protected challenges", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find work worth doing.");
  await expect(page.getByRole("link", { name: "IBM home" })).toBeVisible();
  await expect(page.getByText("Fictional examples", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search challenges by skill or interest" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: "Explore challenges", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Post a challenge", exact: true })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/home-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/home-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Explore challenges", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?notice=access/);
  await page.goto("/");
  await page.getByRole("link", { name: "Post a challenge", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?notice=access/);
});

test("signup shows validation before submitting and provides verification and recovery routes", async ({ page }) => {
  await page.goto("/login?mode=signup");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Your request hasn’t been sent");
  await expect(page.getByLabel("Your name", { exact: true })).toBeFocused();
  await page.getByLabel("Your name", { exact: true }).fill("Fictional Tester");
  await page.getByLabel("Work email", { exact: true }).fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.", { exact: true })).toBeVisible();
  await expect(page.getByText("Use at least 12 characters.", { exact: true })).toBeVisible();
  await page.getByLabel("Work email", { exact: true }).fill("fictional@ibm.com");
  await page.getByLabel("Password", { exact: true }).fill("fictional-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("different-password-123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Passwords do not match.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm password", { exact: true })).toBeFocused();
  await page.getByRole("link", { name: "Resend verification email", exact: true }).click();
  await expect(page.getByRole("button", { name: "Send verification email", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in", exact: true }).click();
  await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await expect(page.getByRole("button", { name: "Send reset link", exact: true })).toBeVisible();
});
