import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("targeted reset verifies the personal admin before deletion and preserves linked work and revocations", () => {
  for (const scenario of ["success", "linked-work", "linked-links", "linked-skills", "linked-events", "linked-tasks", "admin-not-ready", "already-absent", "revoked", "wrong-project"]) {
    const source = `
      const scenario=${JSON.stringify(scenario)};
      process.env.NEXT_PUBLIC_SUPABASE_URL=scenario==='wrong-project'?'https://other.supabase.co':'https://hatvbfuznerrprpuccpj.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-public';
      process.env.SUPABASE_SERVICE_ROLE_KEY='test-private';
      process.env.BOOTSTRAP_ADMIN_EMAIL='btongnova@gmail.com';
      process.env.BOOTSTRAP_ADMIN_PASSWORD='test-password-never-print';
      const admin={id:'personal-id',email:'btongnova@gmail.com',email_confirmed_at:'2026-10-22T00:00:00Z'};
      const target={id:'ibm-test-id',email:'nova@ibm.com',email_confirmed_at:'2026-10-22T00:00:00Z'};
      let deleted=scenario==='already-absent';
      let verifiedRole=false;let verifiedAccess=false;let deletions=0;let mutations=0;
      process.on('beforeExit',()=>console.log('RESULT '+JSON.stringify({deletions,mutations})));
      global.fetch=async(input,init)=>{
        const url=new URL(input);const path=url.pathname;const method=init.method;
        if(method!=='GET')mutations++;
        if(path==='/auth/v1/admin/users'&&method==='GET')return Response.json({users:deleted?[admin]:[admin,target]});
        if(path==='/rest/v1/rpc/provision_workspace_records')return Response.json(admin.id);
        if(path==='/rest/v1/profiles')return Response.json(url.searchParams.get('user_id')==='eq.personal-id'?[{user_id:admin.id}]:[]);
        if(path==='/rest/v1/user_roles'){verifiedRole=true;return Response.json([{role:scenario==='admin-not-ready'?'member':'admin'}]);}
        if(path==='/rest/v1/approved_emails'){
          if(method!=='GET')throw new Error('Allowlist should not be rewritten for existing accounts');
          if(url.searchParams.get('email')==='eq.btongnova@gmail.com'){verifiedAccess=true;return Response.json([{active:true,user_id:admin.id}]);}
          return Response.json([{active:scenario!=='revoked',user_id:deleted?null:target.id}]);
        }
        if(['/rest/v1/projects','/rest/v1/project_members','/rest/v1/project_requests','/rest/v1/project_deliverables','/rest/v1/project_links','/rest/v1/skill_requests','/rest/v1/project_request_events','/rest/v1/project_tasks'].includes(path))return Response.json(((scenario==='linked-work'&&path.endsWith('/project_deliverables'))||(scenario==='linked-links'&&path.endsWith('/project_links'))||(scenario==='linked-skills'&&path.endsWith('/skill_requests'))||(scenario==='linked-events'&&path.endsWith('/project_request_events'))||(scenario==='linked-tasks'&&path.endsWith('/project_tasks')))?[{id:'accepted-evidence'}]:[]);
        if(path==='/auth/v1/admin/users/ibm-test-id'&&method==='DELETE'){
          if(!verifiedRole||!verifiedAccess||scenario==='admin-not-ready'||scenario==='linked-work')throw new Error('Unsafe deletion');
          deletions++;deleted=true;return Response.json({});
        }
        throw new Error('Unexpected request '+method+' '+path);
      };
      await import('./scripts/reset-test-account.mjs');
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], { encoding: "utf8", timeout: 10000 });
    const summary = JSON.parse(result.stdout.split("\n").find((line) => line.startsWith("RESULT ")).slice(7));
    assert(!`${result.stdout}${result.stderr}`.includes("test-password-never-print"));
    assert(!`${result.stdout}${result.stderr}`.includes("test-private"));
    const blocked = ["linked-work", "linked-links", "linked-skills", "linked-events", "linked-tasks", "admin-not-ready", "wrong-project"].includes(scenario);
    assert.equal(result.status, blocked ? 1 : 0, result.stderr);
    assert.equal(summary.deletions, ["success", "revoked"].includes(scenario) ? 1 : 0);
    if (scenario === "wrong-project") assert.equal(summary.mutations, 0);
    if (scenario === "revoked") assert.match(result.stdout, /explicitly revoked/);
    if (scenario === "success") assert.match(result.stdout, /Personal administrator retained/);
  }
});
