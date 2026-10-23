import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmationFailure, confirmationFingerprint, matchesConfirmationReceipt, readEmailConfirmation, redeemEmailConfirmation } from "../src/lib/email-confirmation.ts";

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
    assert.equal(result.destination, type === "recovery" ? "/reset-password" : "/");
  }
});

test("PKCE exchanges the code and uses the provider's recovery flow", async () => {
  const { auth, calls } = authStub();
  assert.equal((await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" })).destination, "/");
  assert.deepEqual(calls, ["fictional-code"]);
  auth.exchangeCodeForSession = async () => ({ error: null, data: { redirectType: "recovery" } });
  assert.equal((await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" })).destination, "/reset-password");
  auth.exchangeCodeForSession = async () => ({ error: null, data: { redirectType: "https://evil.example" } });
  assert.equal((await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" })).destination, "/");
});

test("used or invalid tokens fail closed and PKCE failures give browser guidance", async () => {
  const { auth } = authStub();
  auth.verifyOtp = async () => ({ error: { status: 403 } });
  auth.exchangeCodeForSession = async () => ({ error: { status: 400 }, data: { redirectType: null } });
  assert.equal((await redeemEmailConfirmation(auth, { kind: "token", tokenHash: "used-token", type: "email" })).destination, "/login?notice=expired");
  assert.equal((await redeemEmailConfirmation(auth, { kind: "code", code: "wrong-browser-code" })).destination, "/login?notice=email-browser");
});

test("provider outages do not tell people their email link has expired", async () => {
  const { auth } = authStub();
  for (const status of [0, 503]) {
    auth.verifyOtp = async () => ({ error: { status } });
    assert.equal((await redeemEmailConfirmation(auth, { kind: "token", tokenHash: "fictional-token", type: "email" })).destination, "/login?notice=email-unavailable");
  }
  auth.exchangeCodeForSession = async () => { throw new Error("Fictional network failure"); };
  assert.equal((await redeemEmailConfirmation(auth, { kind: "code", code: "fictional-code" })).destination, "/login?notice=email-unavailable");
});

test("confirmation failures distinguish used links from uncertain network outcomes", () => {
  const unavailable = confirmationFailure("/login?notice=email-unavailable");
  assert.match(unavailable,/may already be confirmed/);
  assert.match(unavailable,/Try signing in/);
  assert.doesNotMatch(unavailable,/expired/);
  assert.match(confirmationFailure("/login?notice=expired"),/already been used/);
  assert.match(confirmationFailure("/login?notice=email-browser"),/browser where you signed up/);
  assert.match(confirmationFailure("/login?notice=email-link"),/incomplete/);
});

test("repeat-link hints match only the same link and confirmed account", async () => {
  const link = { kind:"token",tokenHash:"fictional-token",type:"email" } as const;
  const fingerprint = await confirmationFingerprint(link);
  assert.equal(fingerprint.length,64);
  assert.notEqual(fingerprint,await confirmationFingerprint({...link,tokenHash:"another-token"}));
  assert.notEqual(fingerprint,await confirmationFingerprint({...link,type:"recovery"}));
  const user = {id:"fictional-user",email_confirmed_at:"2026-10-22T00:00:00Z"};
  const receipt = JSON.stringify({fingerprint,userId:user.id});
  assert.equal(matchesConfirmationReceipt(receipt,fingerprint,user),true);
  assert.equal(matchesConfirmationReceipt(receipt,"different-link",user),false);
  assert.equal(matchesConfirmationReceipt(receipt,fingerprint,{...user,id:"other-user"}),false);
  assert.equal(matchesConfirmationReceipt(receipt,fingerprint,{...user,email_confirmed_at:null}),false);
  assert.equal(matchesConfirmationReceipt(receipt,fingerprint,null),false);
  for (const invalid of [undefined,"broken JSON","null","x".repeat(257)]) {
    assert.equal(matchesConfirmationReceipt(invalid,fingerprint,user),false);
  }
});

test("only successful provider responses expose a verified identity for the repeat-link hint", async () => {
  const {auth} = authStub();
  auth.verifyOtp = async () => ({error:null,data:{user:{id:"fictional-user"}}});
  const link = {kind:"token",tokenHash:"fictional-token",type:"email"} as const;
  assert.deepEqual(await redeemEmailConfirmation(auth,link),{destination:"/",verifiedUserId:"fictional-user"});
  auth.verifyOtp = async () => ({error:{status:403},data:{user:{id:"untrusted-user"}}});
  assert.deepEqual(await redeemEmailConfirmation(auth,link),{destination:"/login?notice=expired"});
});
