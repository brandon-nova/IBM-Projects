import { settings, provision, request, rpc, signIn } from "./supabase.mjs";
const config = settings();
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) throw new Error("Set a unique DEMO_PASSWORD of at least 12 characters. No default demo password is provided.");
const local = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(config.url).hostname);
if (!local && process.env.ALLOW_REMOTE_DEMO_SEED !== "true") throw new Error("Hosted demo seeding requires ALLOW_REMOTE_DEMO_SEED=true. Use fictional data only.");

const names = ["Morgan Vale", "Alex Rowan", "Jamie Brooks", "Sam Ellis", "Taylor Quinn", "Casey Rivers"];
const emails = ["admin", "alex", "jamie", "sam", "taylor", "casey"].map((s) => `${s}@ibm-projects.example`);
const users = [];
for (let i=0;i<names.length;i++) users.push(await provision(config, emails[i], names[i], password, { admin: i === 0 }));
const tokens = [];
for (const email of emails) tokens.push(await signIn(config,email,password));
const skills = [
  ["SQL, Automation", "AI"], ["Python, SQL", "React"], ["Design, Documentation", "Python"],
  ["React, TypeScript", "AI"], ["SQL, Data engineering", "Design"], ["Documentation", "Python, AI"],
];
for (let i=0;i<users.length;i++) await rpc(config,tokens[i],"save_profile",{
  p_display_name:names[i],p_bio:"Fictional demo teammate. Curious about small projects with useful outcomes.",
  p_existing_skills:skills[i][0].split(", "),p_learning_skills:skills[i][1].split(", "),p_available_hours:i===5?3:5,
});

const fixtures = [
  { id:"11111111-1111-4111-8111-111111111111", title:"Automate Weekly Reporting", creator:1,owner:1,approval:"approved",work:"open",skills:["Python","SQL","Automation"],description:"Synthetic opportunity: turn a fictional weekly spreadsheet into a repeatable report. Deliver a small script and clear instructions.",hours:6 },
  { id:"22222222-2222-4222-8222-222222222222", title:"Build an AI Agent Prototype", creator:3,owner:null,approval:"pending",work:"open",skills:["AI","Python"],description:"Synthetic proposal: explore a tiny agent that organizes sample public information. Use invented inputs and document what worked.",hours:8 },
  { id:"33333333-3333-4333-8333-333333333333", title:"Create an Internal Analytics Dashboard",creator:4,owner:4,approval:"approved",work:"in_progress",skills:["SQL","Design","Web development"],description:"Synthetic opportunity: make a simple dashboard using fabricated operational data. Help someone understand one process at a glance.",hours:10 },
  { id:"44444444-4444-4444-8444-444444444444",title:"Improve Documentation Search",creator:2,owner:2,approval:"pending",work:"open",skills:["Documentation","Design"],description:"Synthetic proposal: make a fictional documentation collection easier to find your way around. Deliver a tested navigation outline.",hours:4 },
  { id:"55555555-5555-4555-8555-555555555555",title:"Develop a Python Data Validator",creator:1,owner:null,approval:"draft",work:"open",skills:["Python","Data engineering"],description:"Private synthetic draft: validate example CSV files and explain errors in plain language. Start with three useful checks.",hours:5 },
  { id:"66666666-6666-4666-8666-666666666666",title:"Build a Small Web Application",creator:3,owner:3,approval:"approved",work:"completed",skills:["React","TypeScript","Web development"],description:"Completed synthetic example: a small web interface for organizing fictional workshop ideas. Demo evidence is illustrative, not actual IBM work.",hours:8 },
];
const catalog = await request(config,"/rest/v1/skills?select=id,name",undefined,"GET");
for (const f of fixtures) {
  const existing = await request(config,`/rest/v1/projects?id=eq.${f.id}&select=id`,undefined,"GET");
  if (existing.length) continue; // Never overwrite work or accepted evidence on repeat runs.
  await request(config,"/rest/v1/projects",{
    id:f.id,title:f.title,description:f.description,creator_id:users[f.creator].id,owner_id:f.owner===null?null:users[f.owner].id,
    estimated_hours:f.hours,visibility:f.approval==="approved"?"organization":"private",approval_status:f.approval,
  });
  const participantIds = new Set([users[f.creator].id,...(f.owner===null?[]:[users[f.owner].id])]);
  if (f.work==="completed") participantIds.add(users[2].id);
  for (const uid of participantIds) await request(config,"/rest/v1/project_members",{project_id:f.id,user_id:uid});
  for (const skill of f.skills) {
    const tag = catalog.find((s)=>s.name===skill);
    if (!tag) throw new Error("Apply supabase/seed.sql before the demo seed.");
    await request(config,"/rest/v1/project_skills",{project_id:f.id,skill_id:tag.id});
  }
  if (f.work==="in_progress") await rpc(config,tokens[f.owner],"start_project",{p_project_id:f.id});
  if (f.work==="completed") {
    const submission = await rpc(config,tokens[2],"submit_deliverable",{p_project_id:f.id,p_url:"https://example.com/fictional-workshop-demo",p_summary:"Fictional demo evidence: created a sample workshop idea interface and instructions.",p_outcome:"Illustrative outcome only. No real IBM work or measured savings are claimed."});
    await rpc(config,tokens[f.owner],"review_deliverable",{p_deliverable_id:submission,p_accept:true,p_feedback:"Synthetic owner acceptance for demonstration only."});
    await rpc(config,tokens[f.owner],"complete_project",{p_project_id:f.id});
  }
}
console.log("Synthetic demo seeded: one admin, five employees, six projects. casey@ibm-projects.example has zero project memberships. Existing projects and accepted evidence were preserved.");
