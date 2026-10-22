import { test } from "node:test";
import assert from "node:assert/strict";
import { readEmailConfirmation, redeemEmailConfirmation } from "../src/lib/email-confirmation.ts";

type Auth = Parameters<typeof redeemEmailConfirmation>[0];
function authStub() {
  const calls: unknown[] = [];
  const auth: Auth = {
    async verifyOtp(input) { calls.push(input); return { error: null }; },
    async exchangeCodeForSession(code) { calls.push(code); return { error: null, data: { redirectType: null } }; },
  };
  return { auth, calls };
}

test("email callbacks parse token hashes and PKCE codes without redeeming them", () => {
  assert.deepEqual(readEmailConfirmation({ token_hash: "fictional-token", type: "email" }), { kind: "token", tokenHash: "fictional-token", type: "email" });
  assert.deepEqual(readEmailConfirmation({ code: "fictional-code" }), { kind: "code", code: "fictional-code" });
  for (const params of [
    {}, { token_hash: "fictional-token" }, { token_hash: ["one", "two"], type: "email" },
    { token_hash: "", type: "email" }, { token_hash: "has spaces", type: "email" },
    { token_hash: "fictional-token", type: "invite" }, { code: "one", token_hash: "two", type: "email" },
    { code: "one", type: "recovery" }, { code: ["one", "two"] }, { code: "x".repeat(2049) },
    { token_hash: "fictional-token", type: "email", error_code: "otp_expired" },
  ]) assert.equal(readEmailConfirmation(params), null);
});

test("confirmation and recovery redeem only the supplied token and choose fixed destinations", async () => {
  for (const type of ["email", "signup", "recovery"] as const) {
    const { auth, calls } = authStub();
    const result = await redeemEmailConfirmation(auth, { kind: "token", tokenHash: "fictional-token", type });
    assert.deepEqual(calls, [{ token_hash: "fictional-token", type }]);
    assert.equal(result, type === "recovery" ? "/reset-password" : "/");
  }
});

test("PKCE exchanges the code and uses the provider's recovery flow", async () => {
  const { auth, calls } = authStub();
  assert.equal(await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" }), "/");
  assert.deepEqual(calls, ["fictional-code"]);
  auth.exchangeCodeForSession = async () => ({ error: null, data: { redirectType: "recovery" } });
  assert.equal(await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" }), "/reset-password");
  auth.exchangeCodeForSession = async () => ({ error: null, data: { redirectType: "https://evil.example" } });
  assert.equal(await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" }), "/");
});

test("used or invalid tokens fail closed and PKCE failures give browser guidance", async () => {
  const { auth } = authStub();
  auth.verifyOtp = async () => ({ error: { status: 403 } });
  auth.exchangeCodeForSession = async () => ({ error: { status: 400 }, data: { redirectType: null } });
  assert.equal(await redeemEmailConfirmation(auth, { kind: "token", tokenHash: "used-token", type: "email" }), "/login?notice=expired");
  assert.equal(await redeemEmailConfirmation(auth, { kind: "code", code: "wrong-browser-code" }), "/login?notice=email-browser");
});

test("provider outages do not tell people their email link has expired", async () => {
  const { auth } = authStub();
  for (const status of [0, 503]) {
    auth.verifyOtp = async () => ({ error: { status } });
    assert.equal(await redeemEmailConfirmation(auth, { kind: "token", tokenHash: "fictional-token", type: "email" }), "/login?notice=email-unavailable");
  }
  auth.exchangeCodeForSession = async () => { throw new Error("Fictional network failure"); };
  assert.equal(await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" }), "/login?notice=email-unavailable");
});
