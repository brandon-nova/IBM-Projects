import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtures } from "./support.ts";

test("real Supabase: access, RLS, ownership, contribution verification, and completion", { timeout:120000 }, async (t) => {
  const f = await fixtures();
  try {
    const admin = await f.actor("admin",true);
    const owner = await f.actor("owner");
    const contributor = await f.actor("contributor");
    const outsider = await f.actor("outsider");
    const denied = async (actor,name,args) => {
      const result = await f.call(`/rest/v1/rpc/${name}`,"POST",args,actor.token);
      assert.ok(result.status >= 400, `${name} must reject an unauthorized or invalid action`);
    };
    await t.test("direct signup and anonymous writes cannot bypass the access list", async () => {
      const signup = await f.call("/auth/v1/signup","POST",{email:`unapproved-${f.runId}@ibm-projects.example`,password:contributor.password});
      assert.ok(signup.status >= 400);
      const write = await f.call("/rest/v1/approved_emails","POST",{email:`other-${f.runId}@ibm-projects.example`});
      assert.ok(write.status >= 400);
      for (const table of ["profiles","projects","project_deliverables"]) {
        const read = await f.call(`/rest/v1/${table}?select=*&limit=1`);
        assert.ok(read.status >= 400,`anonymous ${table} reads must be denied`);
      }
      const role = await f.ok(`/rest/v1/user_roles?user_id=eq.${owner.id}`,"GET",undefined,owner.token);
      assert.equal(role[0].role,"member","client-supplied admin metadata must be ignored");
      await denied(owner,"set_user_role",{p_user_id:owner.id,p_role:"admin"});
      await denied(owner,"ensure_skill",{p_name:"Unauthorized internal helper"});
    });
    await t.test("IBM auto-approval requires verification, grants only member access, and preserves revocations", async () => {
      const employee = await f.actor("ibm-unconfirmed", false, { email:`test-${f.runId}@ibm.com`, preapprove:false, emailConfirmed:false });
      const [approval] = await f.ok(`/rest/v1/approved_emails?email=eq.${encodeURIComponent(employee.email)}`,"GET",undefined,f.service);
      assert.equal(approval.user_id,employee.id);
      assert.equal(approval.active,true);
      const [role] = await f.ok(`/rest/v1/user_roles?user_id=eq.${employee.id}`,"GET",undefined,f.service);
      assert.equal(role.role,"member","signup metadata cannot grant an admin role");
      const unverified = await f.call("/auth/v1/token?grant_type=password","POST",{email:employee.email,password:employee.password});
      assert.ok(unverified.status >= 400,"unconfirmed users must not sign in");
      // Admin confirmation is test setup; it sends no mail and never changes
      // the production requirement to confirm possession of the email address.
      await f.ok(`/auth/v1/admin/users/${employee.id}`,"PUT",{email_confirm:true},f.service);
      const session = await f.ok("/auth/v1/token?grant_type=password","POST",{email:employee.email,password:employee.password});
      employee.token = session.access_token;
      assert.equal(await f.rpc(employee,"workspace_active",{}),true);
      await f.rpc(admin,"manage_access",{p_email:employee.email,p_active:false});
      assert.equal(await f.rpc(employee,"workspace_active",{}),false,"domain approval cannot override a revoked session");

      const blockedEmail = `revoked-${f.runId}@ibm.com`;
      await f.rpc(admin,"manage_access",{p_email:blockedEmail,p_active:false});
      try {
        const blocked = await f.call("/auth/v1/admin/users","POST",{email:blockedEmail,password:employee.password,email_confirm:true},f.service);
        if (blocked.data?.id) await f.ok(`/auth/v1/admin/users/${blocked.data.id}`,"DELETE",undefined,f.service);
        assert.ok(blocked.status >= 400,"automatic approval must never reactivate an explicit revocation");
        const [record] = await f.ok(`/rest/v1/approved_emails?email=eq.${encodeURIComponent(blockedEmail)}`,"GET",undefined,f.service);
        assert.equal(record.active,false);
      } finally {
        await f.ok(`/rest/v1/approved_emails?email=eq.${encodeURIComponent(blockedEmail)}`,"DELETE",undefined,f.service);
      }
      for (const domain of ["ibm.com.example","dept.ibm.com","notibm.example"]) {
        const rejected = await f.call("/auth/v1/admin/users","POST",{email:`test-${f.runId}@${domain}`,password:employee.password,email_confirm:true},f.service);
        if (rejected.data?.id) {
          await f.ok(`/auth/v1/admin/users/${rejected.data.id}`,"DELETE",undefined,f.service);
          await f.ok(`/rest/v1/approved_emails?email=eq.${encodeURIComponent(`test-${f.runId}@${domain}`)}`,"DELETE",undefined,f.service);
        }
        assert.ok(rejected.status >= 400,`${domain} must not receive automatic approval`);
      }
    });
    await t.test("service-only record repair restores legacy accounts and preserves revocations", async () => {
      const legacy = await f.actor("legacy-repair");
      const args = {p_user_id:legacy.id,p_display_name:"Repaired fictional member",p_admin:false};
      const anonymous = await f.call("/rest/v1/rpc/provision_workspace_records","POST",args);
      assert.ok(anonymous.status >= 400);
      await denied(owner,"provision_workspace_records",args);
      await denied(admin,"provision_workspace_records",{...args,p_admin:true});
      // This fixture owns no projects; emulate a login created before app tables.
      await f.ok(`/rest/v1/profiles?user_id=eq.${legacy.id}`,"DELETE",undefined,f.service);
      await f.ok(`/rest/v1/approved_emails?email=eq.${encodeURIComponent(legacy.email)}`,"DELETE",undefined,f.service);
      for (let attempt=0;attempt<2;attempt++) {
        assert.equal(await f.ok("/rest/v1/rpc/provision_workspace_records","POST",args,f.service),legacy.id);
      }
      assert.equal(await f.rpc(legacy,"workspace_active",{}),true);
      const [profile] = await f.ok(`/rest/v1/profiles?user_id=eq.${legacy.id}`,"GET",undefined,f.service);
      assert.equal(profile.display_name,args.p_display_name);
      await f.ok(`/rest/v1/profiles?user_id=eq.${legacy.id}`,"PATCH",{bio:"Keep existing fictional profile details"},f.service);
      await f.ok("/rest/v1/rpc/provision_workspace_records","POST",{...args,p_admin:true},f.service);
      await f.ok("/rest/v1/rpc/provision_workspace_records","POST",{...args,p_display_name:"Do not replace name"},f.service);
      const [preserved] = await f.ok(`/rest/v1/profiles?user_id=eq.${legacy.id}`,"GET",undefined,f.service);
      assert.equal(preserved.display_name,args.p_display_name);
      assert.equal(preserved.bio,"Keep existing fictional profile details");
      const [role] = await f.ok(`/rest/v1/user_roles?user_id=eq.${legacy.id}`,"GET",undefined,f.service);
      assert.equal(role.role,"admin","member provisioning must not downgrade an existing administrator");
      await f.rpc(admin,"manage_access",{p_email:legacy.email,p_active:false});
      const revoked = await f.call("/rest/v1/rpc/provision_workspace_records","POST",args,f.service);
      assert.ok(revoked.status >= 400);
      assert.equal(await f.rpc(legacy,"workspace_active",{}),false);
      const unconfirmed = await f.actor("repair-unconfirmed",false,{emailConfirmed:false});
      const rejected = await f.call("/rest/v1/rpc/provision_workspace_records","POST",{...args,p_user_id:unconfirmed.id},f.service);
      assert.ok(rejected.status >= 400,"repair must not bypass email confirmation");
    });
    await t.test("directory visibility is optional, self-only, and restricted to active admins", async () => {
      const directoryAdmin = await f.actor("directory-admin",true);
      const profilePath = `/rest/v1/profiles?user_id=eq.${directoryAdmin.id}`;
      const args = {p_hidden:true};
      const [initial] = await f.ok(profilePath,"GET",undefined,owner.token);
      assert.equal(initial.hidden_from_people,false);
      const anonymous = await f.call("/rest/v1/rpc/set_directory_visibility","POST",args);
      assert.ok(anonymous.status >= 400);
      await denied(owner,"set_directory_visibility",args);
      await denied(directoryAdmin,"set_directory_visibility",{p_hidden:null});
      const direct = await f.call(profilePath,"PATCH",{hidden_from_people:true},directoryAdmin.token);
      assert.ok(direct.status >= 400,"direct writes must not bypass the admin-only operation");
      const forged = await f.call("/rest/v1/rpc/set_directory_visibility","POST",{...args,p_user_id:owner.id},directoryAdmin.token);
      assert.ok(forged.status >= 400,"the operation accepts no target user");
      assert.equal(await f.rpc(directoryAdmin,"set_directory_visibility",args),directoryAdmin.id);
      const [hidden] = await f.ok(profilePath,"GET",undefined,owner.token);
      assert.equal(hidden.hidden_from_people,true);
      assert.equal(hidden.display_name,initial.display_name,"project attribution must remain available");
      const directory = await f.ok("/rest/v1/profiles?hidden_from_people=eq.false","GET",undefined,owner.token);
      assert.ok(!directory.some((p) => p.user_id === directoryAdmin.id));
      assert.equal(await f.rpc(directoryAdmin,"workspace_active",{}),true);
      await f.rpc(directoryAdmin,"set_directory_visibility",{p_hidden:false});
      const [shown] = await f.ok(profilePath,"GET",undefined,owner.token);
      assert.equal(shown.hidden_from_people,false);
      await f.rpc(directoryAdmin,"set_directory_visibility",args);
      await f.rpc(admin,"manage_access",{p_email:directoryAdmin.email,p_active:false});
      await denied(directoryAdmin,"set_directory_visibility",{p_hidden:false});
      await f.rpc(admin,"manage_access",{p_email:directoryAdmin.email,p_active:true});
      await f.rpc(admin,"set_user_role",{p_user_id:directoryAdmin.id,p_role:"member"});
      const [demoted] = await f.ok(profilePath,"GET",undefined,owner.token);
      assert.equal(demoted.hidden_from_people,false,"former admins return to the member directory");
      await denied(directoryAdmin,"set_directory_visibility",args);
    });
    const project = await f.rpc(owner,"create_project",{p_title:`Core workflow ${f.runId}`,p_description:"Build a useful result using fictional test inputs.",p_skills:["Python"],p_estimated_hours:3});
    await t.test("private projects and relationships remain inaccessible by known ID", async () => {
      for (const [table,key] of [["projects","id"],["project_members","project_id"],["project_skills","project_id"]]) {
        const rows = await f.ok(`/rest/v1/${table}?${key}=eq.${project}`,"GET",undefined,outsider.token);
        assert.equal(rows.length,0,table);
      }
      await denied(outsider,"edit_project",{p_project_id:project,p_title:"Unauthorized edit",p_description:"An outsider must never modify an unassigned draft.",p_skills:["SQL"],p_estimated_hours:null});
      await denied(outsider,"request_publication",{p_project_id:project});
      await denied(outsider,"assign_owner",{p_project_id:project,p_owner_id:outsider.id});
      const direct = await f.call(`/rest/v1/projects?id=eq.${project}`,"PATCH",{owner_id:outsider.id,visibility:"organization",approval_status:"approved"},owner.token);
      assert.ok(direct.status >= 400);
    });
    await f.rpc(owner,"request_publication",{p_project_id:project});
    await t.test("publication requires both administrator approval and an owner", async () => {
      await denied(owner,"review_publication",{p_project_id:project,p_approve:true});
      await denied(admin,"review_publication",{p_project_id:project,p_approve:true});
      await f.rpc(admin,"assign_owner",{p_project_id:project,p_owner_id:owner.id});
      await f.rpc(admin,"review_publication",{p_project_id:project,p_approve:true});
      const rows = await f.ok(`/rest/v1/projects?id=eq.${project}`,"GET",undefined,contributor.token);
      assert.equal(rows[0].visibility,"organization");
      await f.rpc(owner,"edit_project",{p_project_id:project,p_title:`Core workflow ${f.runId}`,p_description:"Updated description remains published after owner edits.",p_skills:["Python"],p_estimated_hours:4});
      const edited = await f.ok(`/rest/v1/projects?id=eq.${project}`,"GET",undefined,contributor.token);
      assert.equal(edited[0].approval_status,"approved");
    });
    const join = await f.rpc(contributor,"request_join",{p_project_id:project});
    await t.test("join requests are unique and only owners accept them", async () => {
      assert.equal(await f.rpc(contributor,"request_join",{p_project_id:project}),join);
      const before = await f.ok(`/rest/v1/project_members?project_id=eq.${project}&user_id=eq.${contributor.id}`,"GET",undefined,contributor.token);
      assert.equal(before.length,0);
      await denied(admin,"review_join",{p_request_id:join,p_accept:true});
      await denied(outsider,"review_join",{p_request_id:join,p_accept:true});
      await f.rpc(owner,"review_join",{p_request_id:join,p_accept:true});
      const members = await f.ok(`/rest/v1/project_members?project_id=eq.${project}&user_id=eq.${contributor.id}`,"GET",undefined,contributor.token);
      assert.equal(members.length,1);
      await denied(owner,"review_join",{p_request_id:join,p_accept:true});
    });
    let submission;
    await t.test("submission ownership, URL validation, requested changes, and acceptance", async () => {
      await denied(owner,"complete_project",{p_project_id:project});
      await denied(outsider,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/work",p_summary:"I am not a participant in this project.",p_outcome:""});
      for (const url of ["javascript:alert(1)","https:example.com","https://?missing-host","https://user:pass@example.com/work","https://example.com:99999/work","https://[:::]/work","https://example.com\\work"]) {
        await denied(contributor,"submit_deliverable",{p_project_id:project,p_url:url,p_summary:"Invalid URLs must be rejected by the database.",p_outcome:""});
      }
      submission = await f.rpc(contributor,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/test-work",p_summary:"Implemented a useful fictional reporting script.",p_outcome:"Synthetic result; no measured savings claimed."});
      await denied(contributor,"review_deliverable",{p_deliverable_id:submission,p_accept:true,p_feedback:""});
      await denied(admin,"review_deliverable",{p_deliverable_id:submission,p_accept:true,p_feedback:""});
      await f.rpc(owner,"review_deliverable",{p_deliverable_id:submission,p_accept:false,p_feedback:"Add clear instructions."});
      const updated = await f.rpc(contributor,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/test-work",p_summary:"Implemented the script and added clear instructions.",p_outcome:"Synthetic useful result."});
      assert.equal(updated,submission,"one submission per contributor");
      const [edit,review] = await Promise.all([
        f.call("/rest/v1/rpc/submit_deliverable","POST",{p_project_id:project,p_url:"https://example.com/test-work",p_summary:"Implemented the script, instructions, and a final example.",p_outcome:"Synthetic useful result."},contributor.token),
        f.call("/rest/v1/rpc/review_deliverable","POST",{p_deliverable_id:submission,p_accept:true,p_feedback:"Useful work, confirmed."},owner.token),
      ]);
      assert.equal(review.status,200,"owner acceptance must commit despite a concurrent author edit");
      if (edit.status !== 200) {
        assert.equal(edit.status,400);
        assert.match(edit.data.message,/Accepted contributions cannot be changed/);
      }
      const before = await f.ok(`/rest/v1/project_deliverables?id=eq.${submission}`,"GET",undefined,contributor.token);
      assert.equal(before[0].status,"accepted");
      assert.equal(before[0].reviewed_by,owner.id);
      assert.equal(before[0].summary,edit.status === 200 ? "Implemented the script, instructions, and a final example." : "Implemented the script and added clear instructions.");
      await denied(contributor,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/changed",p_summary:"Accepted submissions must be immutable.",p_outcome:""});
      await denied(owner,"review_deliverable",{p_deliverable_id:submission,p_accept:false,p_feedback:"Attempt to overwrite acceptance."});
      const after = await f.ok(`/rest/v1/project_deliverables?id=eq.${submission}`,"GET",undefined,contributor.token);
      assert.deepEqual(after,before);
    });
    await t.test("ownership reassignment preserves accepted attribution and former membership", async () => {
      await f.rpc(admin,"assign_owner",{p_project_id:project,p_owner_id:outsider.id});
      const result = await f.ok(`/rest/v1/project_deliverables?id=eq.${submission}`,"GET",undefined,outsider.token);
      assert.equal(result[0].reviewed_by,owner.id);
      const members = await f.ok(`/rest/v1/project_members?project_id=eq.${project}&user_id=eq.${owner.id}`,"GET",undefined,outsider.token);
      assert.equal(members[0].membership_status,"active");
      await denied(owner,"complete_project",{p_project_id:project});
      await f.rpc(outsider,"complete_project",{p_project_id:project});
    });
    await t.test("completion credits accepted contributors and closes participation and submissions", async () => {
      const [p] = await f.ok(`/rest/v1/projects?id=eq.${project}`,"GET",undefined,contributor.token);
      const d = await f.ok(`/rest/v1/project_deliverables?project_id=eq.${project}&status=eq.accepted`,"GET",undefined,contributor.token);
      assert.equal(p.work_status,"completed");
      assert.equal(p.completed_by,outsider.id);
      assert.deepEqual(d.map((v)=>v.contributor_id),[contributor.id]);
      await denied(admin,"request_join",{p_project_id:project});
      await denied(owner,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/late",p_summary:"No submissions after completion.",p_outcome:""});
      await denied(outsider,"edit_project",{p_project_id:project,p_title:"Changed after completion",p_description:"Completed project evidence must be preserved.",p_skills:["Python"],p_estimated_hours:3});
    });
    await t.test("private completed evidence cannot leak through a contributor profile query", async () => {
      const privateProject = await f.rpc(owner,"create_project",{p_title:`Private evidence ${f.runId}`,p_description:"This private work must remain inaccessible to other users.",p_skills:["SQL"],p_estimated_hours:1});
      await f.rpc(admin,"assign_owner",{p_project_id:privateProject,p_owner_id:owner.id});
      const proof = await f.rpc(owner,"submit_deliverable",{p_project_id:privateProject,p_url:"https://example.com/private",p_summary:"Private synthetic work with accepted evidence.",p_outcome:""});
      await f.rpc(owner,"review_deliverable",{p_deliverable_id:proof,p_accept:true,p_feedback:""});
      await f.rpc(owner,"complete_project",{p_project_id:privateProject});
      const rows = await f.ok(`/rest/v1/project_deliverables?contributor_id=eq.${owner.id}&status=eq.accepted`,"GET",undefined,contributor.token);
      assert.equal(rows.length,0);
    });
    await t.test("revocation invalidates existing sessions at the database boundary", async () => {
      await f.rpc(admin,"manage_access",{p_email:contributor.email,p_active:false});
      assert.equal(await f.rpc(contributor,"workspace_active",{}),false);
      const rows = await f.ok("/rest/v1/profiles?select=user_id","GET",undefined,contributor.token);
      assert.equal(rows.length,0);
      await denied(contributor,"create_project",{p_title:"Stale session",p_description:"A revoked JWT must not retain workspace permissions.",p_skills:["Python"],p_estimated_hours:1});
    });
  } finally { await f.cleanup(); }
});
