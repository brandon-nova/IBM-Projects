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

test("assignment diagnosis explains an empty legacy search, paginates, and never writes or prints credentials", () => {
  const code = `
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://fictional.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fictional-public-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY='fictional-private-key';
    const ids=['participant','hidden','unconfirmed','revoked'];
    const profiles=ids.map(user_id=>({user_id,hidden_from_people:user_id==='hidden'}));
    const users=[...ids,'missing-profile'].map(id=>({id,email:'PRIVATE-'+id+'@example.com',email_confirmed_at:id==='unconfirmed'?null:'2026-10-23'}));
    for(let i=0;i<100;i++){profiles.push({user_id:'filler-'+i,hidden_from_people:false});users.push({id:'filler-'+i,email:'PRIVATE-filler@example.com',email_confirmed_at:null});}
    const tables={
      profiles,
      approved_emails:ids.map(user_id=>({user_id,active:user_id!=='revoked'})),
      user_roles:profiles.map(p=>({user_id:p.user_id,role:'admin'})),
      projects:[{id:'synthetic-project',approval_status:'approved',visibility:'organization',work_status:'open'}],
      project_members:[{project_id:'synthetic-project',user_id:'participant',membership_status:'active'}],
      project_requests:[{project_id:'synthetic-project',user_id:'hidden',request_type:'invitation',status:'pending'}],
    };
    global.fetch=async(input,init)=>{
      if(init?.method!=='GET')throw new Error('Diagnostic attempted a mutation');
      const url=new URL(input),path=url.pathname;
      const start=path==='/auth/v1/admin/users'?(Number(url.searchParams.get('page'))-1)*100:Number(url.searchParams.get('offset'));
      const all=path==='/auth/v1/admin/users'?users:tables[path.split('/').at(-1)];
      if(!all)throw new Error('Unexpected provider request');
      const rows=all.slice(start,start+100);
      return new Response(JSON.stringify(path==='/auth/v1/admin/users'?{users:rows}:rows),{headers:{'content-type':'application/json'}});
    };
    await import('./scripts/inspect-assignments.mjs');
  `;
  const result=spawnSync(process.execPath,["--input-type=module","--eval",code],{encoding:"utf8",timeout:10000});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Auth accounts: 105\. Profiles: 104\. Administrators: 104/);
  assert.match(result.stdout,/Accounts missing profiles: 1/);
  assert.match(result.stdout,/Active profiles: 3\. Unconfirmed: 1\. Hidden from People: 1/);
  assert.match(result.stdout,/Previous search could return 1; corrected admin search can return 3/);
  assert.match(result.stdout,/previous available results 0; corrected results 3 \(1 already participating, 1 invited\)/);
  for(const secret of ['fictional-private-key','fictional-public-key','PRIVATE-','@example.com'])assert(!result.stdout.includes(secret));
});
