import { test } from "node:test";
import assert from "node:assert/strict";
import { authFailure } from "../src/lib/auth-feedback.ts";

test("auth failures identify delivery limits and setup failures without logging sensitive data", (t) => {
  const events: string[] = [];
  t.mock.method(console, "error", (message: string) => events.push(message));
  const result = authFailure("signup", { code: "unexpected_failure", status: 500, message: "SMTP password secret; email person@example.com; token_hash=private" });
  assert.equal(result.success, false);
  assert.match(result.message, /email delivery failed/);
  const event = JSON.parse(events[0]);
  assert.equal(event.event, "auth_failure");
  assert.equal(event.code, "unexpected_failure");
  assert.equal(event.status, 500);
  assert(result.message.includes(event.reference));
  assert(!JSON.stringify({ result, events }).includes("person@example.com"));
  assert(!JSON.stringify({ result, events }).includes("token_hash"));
  assert(!JSON.stringify({ result, events }).includes("secret"));
  assert.match(authFailure("resend", { code: "over_email_send_rate_limit", status: 429 }).message, /Wait a few minutes/);
  assert.match(authFailure("signup", { status: 500 }).message, /email delivery failed/);
  assert.match(authFailure("resend", { status: 0 }).message, /couldn’t reach the account service/);
});

test("unknown errors and duplicate accounts use generic feedback without account enumeration", (t) => {
  const events: string[] = [];
  t.mock.method(console, "error", (message: string) => events.push(message));
  for (const error of [null, new Error("private SMTP message"), { code: "user_already_exists", status: 422 }, { code: "private_token", status: "secret" }]) {
    const result = authFailure("signup", error);
    assert.match(result.message, /If you already registered/);
    assert.equal(JSON.parse(events.at(-1)!).code, "unknown");
    assert(!JSON.stringify({ result, events }).includes("private"));
  }
  assert.match(authFailure("recovery", new Error("private")).message, /couldn’t request the email/);
});
