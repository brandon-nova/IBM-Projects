import { test } from "node:test";
import assert from "node:assert/strict";
import { provision } from "../scripts/supabase.mjs";

const config = { url: "https://fictional.supabase.co", key: "public-test-key", service: "private-test-key" };
const user = { id: "11111111-1111-4111-8111-111111111111", email: "fictional@ibm.com", email_confirmed_at: "2026-10-22T00:00:00Z" };
function mockProvider(t, { existing = true, failure = false, wrongResult = false } = {}) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const path = new URL(input).pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, method: init.method, body, prefer: init.headers.Prefer, authorization: init.headers.Authorization });
    if (path === "/auth/v1/admin/users" && init.method === "GET") return Response.json({ users: existing ? [user] : [] });
    if (path === "/auth/v1/admin/users" && init.method === "POST") return Response.json(user);
    if (path === "/rest/v1/approved_emails") return Response.json([]);
    if (path === "/rest/v1/rpc/provision_workspace_records") return failure
      ? Response.json({ message: "Access was revoked." }, { status: 403 })
      : Response.json(wrongResult ? "different-user" : user.id);
    throw new Error("Unexpected provisioning request");
  });
  return calls;
}

test("existing accounts receive transactional record repair without password or profile updates", async (t) => {
  const calls = mockProvider(t);
  assert.equal((await provision(config, user.email, "Fictional Admin", "unused-password", { admin: true })).id, user.id);
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ["GET", "/auth/v1/admin/users"], ["POST", "/rest/v1/rpc/provision_workspace_records"],
  ]);
  assert.deepEqual(calls[1].body, { p_user_id: user.id, p_display_name: "Fictional Admin", p_admin: true });
  assert.equal(calls[1].authorization, `Bearer ${config.service}`);
  assert(!JSON.stringify(calls).includes("unused-password"));
});

test("new accounts preserve existing allowlist decisions and get member repair by default", async (t) => {
  const calls = mockProvider(t, { existing: false });
  await provision(config, user.email, "Fictional Member", "new-test-password");
  const allowlist = calls.find((call) => call.path === "/rest/v1/approved_emails");
  assert.deepEqual(allowlist.body, { email: user.email });
  assert.match(allowlist.prefer, /resolution=ignore-duplicates/);
  assert.equal(calls.at(-1).body.p_admin, false);
  assert.equal(calls.find((call) => call.method === "POST" && call.path === "/auth/v1/admin/users").body.email_confirm, true);
});

test("revoked access or an incorrect repair result fails provisioning rather than reporting success", async (t) => {
  for (const options of [{ failure: true }, { wrongResult: true }]) {
    const calls = mockProvider(t, options);
    await assert.rejects(provision(config, user.email, "Fictional Admin", "unused", { admin: true }), /Workspace provisioning failed/);
    assert(!calls.some((call) => call.method === "PATCH" || call.path === "/rest/v1/approved_emails"));
    t.mock.restoreAll();
  }
});
