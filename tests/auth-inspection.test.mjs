import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Exercise the CLI through its real HTTP helper, with every request mocked.
test("account inspection distinguishes missing, confirmed, and unconfirmed users without writes or secret output", () => {
  for (const scenario of ["missing", "confirmed", "unconfirmed", "revoked"]) {
    const code = `
      process.env.NEXT_PUBLIC_SUPABASE_URL='https://fictional.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fictional-public-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY='fictional-private-key';
      process.argv[2]='fictional@ibm.com';
      const scenario=${JSON.stringify(scenario)};
      const user={id:'fictional-user',email:'fictional@ibm.com',email_confirmed_at:scenario==='confirmed'?'2026-10-22T00:00:00Z':null};
      global.fetch=async(input,init)=>{
        if(init?.method!=='GET')throw new Error('Diagnostic attempted a mutation');
        const path=new URL(input).pathname;
        const body=path==='/auth/v1/admin/users'?{users:scenario==='missing'?[]:[user]}:
          path==='/rest/v1/profiles'?[{user_id:user.id}]:
          path==='/rest/v1/approved_emails'?[{user_id:user.id,active:scenario!=='revoked'}]:null;
        if(!body)throw new Error('Unexpected provider request');
        return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
      };
      await import('./scripts/inspect-auth.mjs');
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert(!result.stdout.includes("fictional-private-key"));
    assert(!result.stdout.includes("fictional-public-key"));
    assert(!result.stdout.includes("fictional@ibm.com"));
    if (scenario === "missing") assert.match(result.stdout, /Resend cannot create an account/);
    if (scenario === "confirmed") assert.match(result.stdout, /already confirmed/);
    if (scenario === "unconfirmed") assert.match(result.stdout, /not confirmed/);
    if (scenario === "revoked") assert.match(result.stdout, /missing, revoked, or not bound/);
  }
});
