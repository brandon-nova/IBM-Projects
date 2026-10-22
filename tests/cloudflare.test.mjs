import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudflareSettings, productionOrigin } from "../scripts/cloudflare-settings.mjs";

const configured = {
  NEXT_PUBLIC_APP_URL: productionOrigin,
  NEXT_PUBLIC_SUPABASE_URL: "https://fictional-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictional_test_value",
};
const legacyKey = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

test("Cloudflare deployment refuses localhost origins and incomplete Supabase setup", () => {
  assert.throws(() => cloudflareSettings({ ...configured, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }), /Localhost/);
  assert.throws(() => cloudflareSettings({ NEXT_PUBLIC_APP_URL: productionOrigin }), /Configure Supabase/);
  assert.throws(() => cloudflareSettings({ ...configured, NEXT_PUBLIC_SUPABASE_URL: "" }), /both public Supabase/);
  for (const url of ["http://fictional-project.supabase.co", "https://user:pass@fictional-project.supabase.co", "https://localhost", "https://fictional-project.supabase.co/other"]) {
    assert.throws(() => cloudflareSettings({ ...configured, NEXT_PUBLIC_SUPABASE_URL: url }), /HTTPS origin/);
  }
});

test("public deployment settings accept public keys and reject privileged keys", () => {
  assert.equal(cloudflareSettings(configured).NEXT_PUBLIC_APP_URL, productionOrigin);
  assert.equal(cloudflareSettings({ ...configured, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyKey("anon") }).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, legacyKey("anon"));
  for (const key of ["sb_secret_fictional", legacyKey("service_role"), "malformed-key"]) {
    assert.throws(() => cloudflareSettings({ ...configured, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }), /public value/);
  }
});

test("homepage-only deployment requires explicit opt-in and no partial credentials", () => {
  assert.deepEqual(cloudflareSettings({ NEXT_PUBLIC_APP_URL: productionOrigin, CLOUDFLARE_PUBLIC_PREVIEW: "true" }), {
    NEXT_PUBLIC_APP_URL: productionOrigin, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  });
  assert.throws(() => cloudflareSettings({ ...configured, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", CLOUDFLARE_PUBLIC_PREVIEW: "true" }), /both public Supabase/);
});

test("provisioning credentials cannot become Cloudflare Worker variables", () => {
  const settings = cloudflareSettings({ ...configured, SUPABASE_SERVICE_ROLE_KEY: "never-deploy", BOOTSTRAP_ADMIN_PASSWORD: "never-deploy", CLOUDFLARE_API_TOKEN: "never-deploy" });
  assert.deepEqual(Object.keys(settings).sort(), Object.keys(configured).sort());
});
