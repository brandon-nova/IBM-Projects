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
      const signup = await f.call("/auth/v1/signup","POST",{email:`unapproved-${f.runId}@soverflow.example`,password:contributor.password});
      assert.ok(signup.status >= 400);
      const write = await f.call("/rest/v1/approved_emails","POST",{email:`other-${f.runId}@soverflow.example`});
      assert.ok(write.status >= 400);
      const role = await f.ok(`/rest/v1/user_roles?user_id=eq.${owner.id}`,"GET",undefined,owner.token);
      assert.equal(role[0].role,"member","client-supplied admin metadata must be ignored");
      await denied(owner,"set_user_role",{p_user_id:owner.id,p_role:"admin"});
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
      await denied(contributor,"submit_deliverable",{p_project_id:project,p_url:"javascript:alert(1)",p_summary:"Executable URLs must be rejected by the database.",p_outcome:""});
      submission = await f.rpc(contributor,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/test-work",p_summary:"Implemented a useful fictional reporting script.",p_outcome:"Synthetic result; no measured savings claimed."});
      await denied(contributor,"review_deliverable",{p_deliverable_id:submission,p_accept:true,p_feedback:""});
      await denied(admin,"review_deliverable",{p_deliverable_id:submission,p_accept:true,p_feedback:""});
      await f.rpc(owner,"review_deliverable",{p_deliverable_id:submission,p_accept:false,p_feedback:"Add clear instructions."});
      const updated = await f.rpc(contributor,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/test-work",p_summary:"Implemented the script and added clear instructions.",p_outcome:"Synthetic useful result."});
      assert.equal(updated,submission,"one submission per contributor");
      await f.rpc(owner,"review_deliverable",{p_deliverable_id:submission,p_accept:true,p_feedback:"Useful work, confirmed."});
      const before = await f.ok(`/rest/v1/project_deliverables?id=eq.${submission}`,"GET",undefined,contributor.token);
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
