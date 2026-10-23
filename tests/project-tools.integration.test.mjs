import {test} from "node:test";
import assert from "node:assert/strict";
import {fixtures} from "./support.ts";

test("hosted Supabase: native boards, external mode, and atomic admin publication",{timeout:180000},async(t) => {
  const f=await fixtures();
  try {
    const admin=await f.actor("board-admin",true),owner=await f.actor("board-owner"),member=await f.actor("board-member"),outsider=await f.actor("board-outsider");
    const [skill]=await f.ok("/rest/v1/skills?active=eq.true&limit=1","GET",undefined,admin.token);
    const input={p_title:`Project tools ${f.runId}`,p_description:"Coordinate useful work with a fictional board.",p_skill_ids:[skill.id],p_estimated_hours:4};
    const denied=async(actor,name,args) => assert((await f.call(`/rest/v1/rpc/${name}`,"POST",args,actor.token)).status>=400,`${name} must reject`);
    let project,privateProject,task;
    await t.test("only admins can create published projects; default ownership and both participants are atomic",async() => {
      await denied(owner,"create_published_project",input);
      await denied(owner,"admin_project_owners",{});
      const anonymous=await f.call("/rest/v1/rpc/create_published_project","POST",input);
      assert(anonymous.status>=400);
      const self=await f.rpc(admin,"create_published_project",input);
      const [selfProject]=await f.ok(`/rest/v1/projects?id=eq.${self}`,"GET",undefined,owner.token);
      assert.equal(selfProject.owner_id,admin.id);assert.equal(selfProject.visibility,"organization");assert.equal(selfProject.approval_status,"approved");assert.equal(selfProject.board_mode,"native");
      project=await f.rpc(admin,"create_published_project",{...input,p_title:`Assigned ${f.runId}`,p_owner_id:owner.id});
      const rows=await f.ok(`/rest/v1/project_members?project_id=eq.${project}`,"GET",undefined,admin.token);
      assert.deepEqual(rows.map((m) => m.user_id).sort(),[admin.id,owner.id].sort());
      const unconfirmed=await f.actor("board-unconfirmed",false,{emailConfirmed:false});
      const revoked=await f.actor("board-revoked");await f.rpc(admin,"manage_access",{p_email:revoked.email,p_active:false});
      for(const actor of [unconfirmed,revoked]) await denied(admin,"create_published_project",{...input,p_title:`Blocked ${f.runId}`,p_owner_id:actor.id});
      assert.equal((await f.ok(`/rest/v1/projects?title=eq.${encodeURIComponent(`Blocked ${f.runId}`)}`,"GET",undefined,admin.token)).length,0);
      const candidates=await f.rpc(admin,"admin_project_owners",{});
      assert(candidates.some((c) => c.user_id===admin.id));
      for(const actor of [unconfirmed,revoked]) assert(!candidates.some((c) => c.user_id===actor.id));
    });
    await t.test("300-character creation limit applies to direct and legacy RPCs; old descriptions remain editable",async() => {
      await denied(admin,"create_published_project",{...input,p_description:"a".repeat(301)});
      await denied(owner,"create_project_with_skills",{...input,p_description:"a".repeat(301)});
      await denied(owner,"create_project",{p_title:input.p_title,p_description:"a".repeat(301),p_skills:[skill.name]});
      privateProject=await f.rpc(owner,"create_project_with_skills",{...input,p_description:"a".repeat(300)});
      const [proposal]=await f.ok(`/rest/v1/projects?id=eq.${privateProject}`,"GET",undefined,owner.token);
      assert.equal(proposal.visibility,"private");assert.equal(proposal.approval_status,"draft");
      await f.rpc(owner,"edit_project_with_skills",{...input,p_project_id:privateProject,p_description:"a".repeat(500)});
      const [edited]=await f.ok(`/rest/v1/projects?id=eq.${privateProject}`,"GET",undefined,owner.token);
      assert.equal(edited.description.length,500);
    });
    const taskInput={p_project_id:project,p_title:"Create a useful artifact",p_description:"Use synthetic data only.",p_assignee_id:owner.id};
    await t.test("workspace users can read published boards; only participants/admins can mutate",async() => {
      task=await f.rpc(owner,"save_project_task",taskInput);
      const visible=await f.ok(`/rest/v1/project_tasks?project_id=eq.${project}`,"GET",undefined,outsider.token);
      assert.equal(visible.length,1);assert.equal(visible[0].assignee_id,owner.id);
      await denied(outsider,"save_project_task",taskInput);
      await denied(outsider,"move_project_task",{p_project_id:project,p_task_id:task,p_status:"done"});
      await denied(admin,"lock_native_board",{p_project_id:project});
      for(const [method,body] of [["POST",{project_id:project,title:"Bypass",created_by:outsider.id,updated_by:outsider.id}],["PATCH",{title:"Bypass"}],["DELETE",undefined]]) {
        assert((await f.call(`/rest/v1/project_tasks?id=eq.${task}`,method,body,owner.token)).status>=400,"direct writes must be denied");
      }
      const privateTask=await f.rpc(owner,"save_project_task",{...taskInput,p_project_id:privateProject});
      assert.deepEqual(await f.ok(`/rest/v1/project_tasks?id=eq.${privateTask}`,"GET",undefined,outsider.token),[]);
      assert((await f.call("/rest/v1/project_tasks","GET")).status>=400);
    });
    await t.test("members create, edit, assign, move and delete cards with persisted positions",async() => {
      const request=await f.rpc(member,"request_join",{p_project_id:project});await f.rpc(owner,"review_join",{p_request_id:request,p_accept:true});
      await f.rpc(member,"save_project_task",{...taskInput,p_task_id:task,p_title:"Updated artifact",p_assignee_id:member.id});
      await denied(member,"save_project_task",{...taskInput,p_task_id:task,p_assignee_id:outsider.id});
      await denied(member,"save_project_task",{...taskInput,p_title:" "});
      await denied(member,"move_project_task",{p_project_id:project,p_task_id:task,p_status:"invalid"});
      const second=await f.rpc(admin,"save_project_task",{...taskInput,p_title:"Second task",p_assignee_id:null});
      await Promise.all([task,second].map((id) => f.rpc(member,"move_project_task",{p_project_id:project,p_task_id:id,p_status:"in_progress"})));
      const moved=await f.ok(`/rest/v1/project_tasks?project_id=eq.${project}&status=eq.in_progress&order=position,id`,"GET",undefined,outsider.token);
      assert.equal(moved.length,2);assert.notEqual(moved[0].position,moved[1].position);
      await f.rpc(owner,"move_project_task",{p_project_id:project,p_task_id:task,p_status:"done"});
      const [card]=await f.ok(`/rest/v1/project_tasks?id=eq.${task}`,"GET",undefined,owner.token);
      assert.equal(card.status,"done");assert.equal(card.title,"Updated artifact");assert.equal(card.assignee_id,member.id);
      await f.rpc(member,"delete_project_task",{p_project_id:project,p_task_id:second});
      assert.deepEqual(await f.ok(`/rest/v1/project_tasks?id=eq.${second}`,"GET",undefined,owner.token),[]);
    });
    await t.test("owner/admin-only external mode preserves every task and blocks native mutations",async() => {
      const settings={p_project_id:project,p_mode:"external",p_url:"https://example.com/board"};
      await denied(member,"set_project_board",settings);
      for(const url of ["javascript:alert(1)","https://user:secret@example.com","https:example.com",""]) await denied(owner,"set_project_board",{...settings,p_url:url});
      const before=await f.ok(`/rest/v1/project_tasks?project_id=eq.${project}&order=id`,"GET",undefined,owner.token);
      await f.rpc(owner,"set_project_board",settings);
      await denied(member,"save_project_task",taskInput);
      await denied(admin,"move_project_task",{p_project_id:project,p_task_id:task,p_status:"todo"});
      await denied(owner,"delete_project_task",{p_project_id:project,p_task_id:task});
      await f.rpc(admin,"set_project_board",{p_project_id:project,p_mode:"native",p_url:null});
      assert.deepEqual(await f.ok(`/rest/v1/project_tasks?project_id=eq.${project}&order=id`,"GET",undefined,owner.token),before);
      const [p]=await f.ok(`/rest/v1/projects?id=eq.${project}`,"GET",undefined,owner.token);assert.equal(p.external_board_url,settings.p_url);
      assert.equal(p.work_status,"open","Done tasks do not manufacture completed contribution credit");
    });
    await t.test("removal, revocation and completion lock mutations without deleting task history",async() => {
      const proof=await f.rpc(member,"submit_deliverable",{p_project_id:project,p_url:"https://example.com/work",p_summary:"Produced a useful synthetic artifact.",p_outcome:""});
      await f.rpc(owner,"review_deliverable",{p_deliverable_id:proof,p_accept:true,p_feedback:"Useful work"});
      await f.rpc(admin,"remove_project_member",{p_project_id:project,p_user_id:member.id});
      await denied(member,"move_project_task",{p_project_id:project,p_task_id:task,p_status:"todo"});
      await f.rpc(admin,"manage_access",{p_email:outsider.email,p_active:false});
      assert.deepEqual(await f.ok(`/rest/v1/project_tasks?project_id=eq.${project}`,"GET",undefined,outsider.token),[]);
      await f.rpc(owner,"complete_project",{p_project_id:project});
      await denied(admin,"save_project_task",taskInput);
      await denied(owner,"move_project_task",{p_project_id:project,p_task_id:task,p_status:"todo"});
      await denied(admin,"delete_project_task",{p_project_id:project,p_task_id:task});
      await denied(owner,"set_project_board",{p_project_id:project,p_mode:"external",p_url:"https://example.com/board"});
      const [preserved]=await f.ok(`/rest/v1/project_tasks?id=eq.${task}`,"GET",undefined,owner.token);assert.equal(preserved.assignee_id,member.id);
    });
  } finally {await f.cleanup();}
});
