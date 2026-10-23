import { test } from "node:test";
import assert from "node:assert/strict";
import { rankCandidates } from "../src/lib/assignment-matching.ts";
import { editsProject,managesProject,acceptsInvitations } from "../src/lib/project-permissions.ts";
import { profileSchema,projectSchema,projectCreateSchema,projectLinkSchema,boardSettingsSchema,taskSchema,taskStatusSchema } from "../src/lib/validation.ts";
import type { Candidate,Project } from "../src/lib/database.types.ts";
import { projectViewUrl } from "../src/lib/project-filters.ts";
const ids=Array.from({length:21},(_,i) => `00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
test("project view switches retain filters and clear keeps only the selected view",() => {
  const params={q:"Python & SQL",status:"open",my:"1",learn:"1",unknown:"discard"};
  assert.equal(projectViewUrl(params,true),"/projects?my=1&q=Python+%26+SQL&status=open&learn=1");
  assert.equal(projectViewUrl(params,true,true),"/projects?my=1");
  assert.equal(projectViewUrl(params,false,true),"/projects");
  assert(!projectViewUrl(params,false).includes("my="));
});
function candidate(id:string,existing:string[],learning:string[],hours:number|null=4,name=id):Candidate {return {user_id:id,display_name:name,existing_ids:existing,learning_ids:learning,available_hours:hours};}
test("contribution ranking favors existing matches and excludes unrelated capacity",() => {
  const rows=[candidate("learning",[],[ids[0]],168),candidate("existing",[ids[0]],[],null),candidate("irrelevant",[],[],168)];
  const result=rankCandidates(rows,[ids[0]],"contribution");
  assert.deepEqual(result.map((c) => [c.user_id,c.score]),[["existing",3],["learning",1]]);
  assert.deepEqual(rows[0].existing_ids,[],"input must remain unchanged");
});
test("training requires learning matches and excludes previous recipients and members",() => {
  const rows=[candidate("expert",[ids[0]],[]),candidate("student",[],[ids[0],ids[0]]),candidate("blocked",[ids[0]],[ids[0]])];
  assert.deepEqual(rankCandidates(rows,[ids[0]],"training",new Set(["blocked"])).map((c) => [c.user_id,c.score]),[["student",3]]);
});
test("ranking ties use weekly availability then stable name and ID",() => {
  const rows=[candidate("z",[ids[0]],[],null,"Zed"),candidate("b",[ids[0]],[],5,"Alex"),candidate("a",[ids[0]],[],5,"Alex"),candidate("c",[ids[0]],[],0,"Aaron")];
  assert.deepEqual(rankCandidates(rows,[ids[0]],"contribution").map((c) => c.user_id),["a","b","c","z"]);
});
const profile={display_name:"Fictional user",bio:"",existing_skills:ids.slice(0,20),learning_skills:ids.slice(0,6),available_hours:"0"};
test("profile limits accept 360 Unicode characters, twenty skills, and six interests",() => {
  assert(profileSchema.safeParse({...profile,bio:"😀".repeat(360)}).success);
  assert(!profileSchema.safeParse({...profile,bio:"😀".repeat(361)}).success);
  assert(!profileSchema.safeParse({...profile,learning_skills:ids.slice(0,7)}).success);
  assert(!profileSchema.safeParse({...profile,existing_skills:ids}).success);
  assert(!profileSchema.safeParse({...profile,existing_skills:["arbitrary free text"]}).success);
});
test("project skill validation uses catalog UUIDs and deduplicates selection",() => {
  const project={title:"Useful project",description:"Create a useful result.",skills:[ids[0],ids[0]],estimated_hours:"3"};
  assert.deepEqual(projectSchema.parse(project).skills,[ids[0]]);
  assert(!projectSchema.safeParse({...project,skills:[]}).success);
  assert(!projectSchema.safeParse({...project,skills:["Python"]}).success);
});
test("new project descriptions stop at 300 characters without blocking edits of older descriptions",() => {
  const project={title:"Useful project",description:"a".repeat(300),skills:[ids[0]],estimated_hours:"3"};
  assert(projectCreateSchema.safeParse(project).success);
  assert(!projectCreateSchema.safeParse({...project,description:"a".repeat(301)}).success);
  assert(projectCreateSchema.safeParse({...project,description:"😀".repeat(300)}).success);
  assert(projectSchema.safeParse({...project,description:"a".repeat(1000)}).success);
});
test("external boards require safe links; native mode can restore a saved board without a URL",() => {
  assert(boardSettingsSchema.safeParse({mode:"native",url:""}).success);
  assert(boardSettingsSchema.safeParse({mode:"external",url:"https://example.com/board"}).success);
  for(const url of ["","javascript:alert(1)","https://user:secret@example.com","https:example.com"]) assert(!boardSettingsSchema.safeParse({mode:"external",url}).success);
  assert(!boardSettingsSchema.safeParse({mode:"unknown",url:""}).success);
});
test("tasks accept an unassigned card and restrict status and assignee input",() => {
  assert(taskSchema.safeParse({title:"Useful task",description:"",assignee_id:""}).success);
  assert(taskSchema.safeParse({title:"Useful task",description:"Details",assignee_id:ids[0]}).success);
  assert(!taskSchema.safeParse({title:" ",description:"",assignee_id:""}).success);
  assert(!taskSchema.safeParse({title:"Useful task",description:"a".repeat(2001),assignee_id:""}).success);
  assert(!taskSchema.safeParse({title:"Useful task",description:"",assignee_id:"someone"}).success);
  assert(!taskStatusSchema.safeParse("completed").success);
});
test("links require a label and a safe HTTP URL",() => {
  assert.equal(projectLinkSchema.parse({label:" Board ",url:"https://example.com"}).url,"https://example.com/");
  for(const url of ["javascript:alert(1)","https://user:pass@example.com","https://example.com:99999"]) assert(!projectLinkSchema.safeParse({label:"Board",url}).success);
  assert(!projectLinkSchema.safeParse({label:"",url:"https://example.com"}).success);
});
test("owner, proposer, and admin controls agree while completed edits stay locked",() => {
  const project={owner_id:null,creator_id:"creator",work_status:"open",approval_status:"draft",visibility:"private"} as Project;
  assert(editsProject(project,{id:"creator",role:"member"}));
  assert(!editsProject(project,{id:"outsider",role:"member"}));
  assert(editsProject(project,{id:"admin",role:"admin"}));
  assert(!managesProject(project,{id:"creator",role:"member"}));
  assert(managesProject({...project,owner_id:"owner"},{id:"owner",role:"member"}));
  assert(!editsProject({...project,work_status:"completed"},{id:"admin",role:"admin"}));
  assert(!acceptsInvitations(project));
  assert(acceptsInvitations({...project,owner_id:"owner",approval_status:"approved",visibility:"organization"}));
});
