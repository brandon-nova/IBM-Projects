import { test, expect } from "@playwright/test";
import { fixtures } from "../support";

test("opening a verification link signs in automatically and keeps the session after reload", async ({ browser }) => {
  const f = await fixtures();
  const context = await browser.newContext();
  try {
    const actor = await f.actor("browser-verification",false,{emailConfirmed:false});
    // Generate a real one-time token without sending email to fictional addresses.
    const link = await f.ok<{hashed_token:string}>("/auth/v1/admin/generate_link","POST",{
      type:"signup",email:actor.email,password:actor.password,
    },f.service);
    const path = `/auth/confirm?token_hash=${encodeURIComponent(link.hashed_token)}&type=email`;
    const preview = await context.request.get(path);
    expect(preview.ok()).toBe(true);
    const before = await f.ok<{email_confirmed_at:string|null}>(`/auth/v1/admin/users/${actor.id}`,"GET",undefined,f.service);
    expect(before.email_confirmed_at).toBeFalsy();

    const page = await context.newPage();
    await page.goto(path);
    await expect(page).toHaveURL(/\/\?notice=email-verified$/);
    await expect(page.getByRole("status")).toHaveText("Success! Email verified.");
    await expect(page.getByRole("heading",{name:"What do you want to work on?",exact:true})).toBeVisible();
    const after = await f.ok<{email_confirmed_at:string|null}>(`/auth/v1/admin/users/${actor.id}`,"GET",undefined,f.service);
    expect(after.email_confirmed_at).toBeTruthy();
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects$/);
    await page.reload();
    await expect(page).toHaveURL(/\/projects$/);
    // The provider token is now consumed. Reopening it should use this browser's
    // receipt only after authenticating the same active, confirmed account.
    await page.goto(path);
    await expect(page).toHaveURL(/\/\?notice=email-verified$/);
    await expect(page.getByRole("status")).toHaveText("Success! Email verified.");
    await page.goto("/auth/confirm?token_hash=unrelated-invalid-token&type=email");
    await expect(page.getByRole("alert")).toContainText("already been used");
  } finally {
    await context.close();
    await f.cleanup();
  }
});
