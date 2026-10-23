// Compiled Next.js regression checks with every provider request mocked.
// No port binding, live credentials, database mutations, or emails.
import {createRequire} from 'node:module';
const req=createRequire(import.meta.url);
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
try { Object.assign(process.env,Object.fromEntries(Object.entries(parseEnv(readFileSync('.env.production','utf8'))).filter(([key])=>key.startsWith('NEXT_PUBLIC_')))); } catch {}
process.env.NODE_ENV='production';
const NextServer=req('next/dist/server/next-server').default;
const {createRequestResponseMocks}=req('next/dist/server/lib/mock-request');
const {encodeReply}=req('next/dist/compiled/react-server-dom-webpack/client.node');
const uid='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444',rid='55555555-5555-4555-8555-555555555555';
const stamp='2026-01-01T00:00:00Z';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'fictional@ibm.com',email_confirmed_at:stamp,app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:stamp};
const profile={user_id:uid,display_name:'Fictional Tester',bio:'Fictional profile.',hidden_from_people:false,created_at:stamp,updated_at:stamp};
const project={id:pid,creator_id:uid,owner_id:uid,title:'Fictional useful project',description:'A synthetic reporting opportunity with useful deliverables.',estimated_hours:4,visibility:'organization',approval_status:'approved',work_status:'open',completed_by:null,completed_at:null,created_at:stamp,updated_at:stamp};
const skill={id:sid,name:'Python',active:true,created_at:stamp};
const invitation={id:rid,project_id:pid,user_id:uid,request_type:'invitation',status:'pending',reviewed_by:null,invited_by:other,suggestion_kind:'training',reason:'Practice Python using fictional inputs.',last_invited_at:stamp,responded_at:null,canceled_by:null,created_at:stamp,updated_at:stamp};
let participating=false,admin=false,suggested=false,failure=true;
const calls=[];
global.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url ?? String(input));
 assert.equal(url.origin,new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin,'Real external requests are forbidden');
 calls.push(url.pathname);
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','x-supabase-api-version':'2024-01-01'}});
 if(url.pathname==='/auth/v1/user')return response(user);
 if(url.pathname==='/auth/v1/signup')return failure?response({code:'unexpected_failure',msg:'Fictional SMTP failure'},500):response({...user,email_confirmed_at:null});
 if(url.pathname==='/rest/v1/rpc/pending_project_suggestions')return response(suggested?[rid]:[]);
 if(url.pathname==='/rest/v1/rpc/assignment_candidates')return response([{user_id:uid,display_name:profile.display_name,existing_ids:[sid],learning_ids:[],available_hours:3},{user_id:other,display_name:'Fictional Candidate',existing_ids:[sid],learning_ids:[sid],available_hours:3}]);
 if(url.pathname.startsWith('/rest/v1/rpc/'))return response(true);
 const accept=new Headers(init?.headers ?? (typeof input==='object'?input.headers:undefined)).get('accept')||'';
 const table=url.pathname.split('/').at(-1);
 if(table==='profiles')return response(accept.includes('object')?profile:[profile,{...profile,user_id:other,display_name:'Fictional Candidate'}]);
 if(table==='user_roles')return response(accept.includes('object')?{user_id:uid,role:admin?'admin':'member',updated_at:stamp}:[{user_id:uid,role:admin?'admin':'member',updated_at:stamp}]);
 if(table==='project_members'){
  const rows=participating?[{user_id:uid,project_id:pid,membership_status:'active',created_at:stamp}]:[];
  if(init?.method==='HEAD')return new Response(null,{status:200,headers:{'content-range':`*/${rows.length}`}});
  return response(rows);
 }
 const tables={skills:[skill],projects:[project],project_skills:[{project_id:pid,skill_id:sid}],user_skills:[{user_id:uid,skill_id:sid,type:'learning'}],user_availability:[{user_id:uid,available_hours:3}],project_requests:suggested?[invitation]:[],project_links:[{id:rid,project_id:pid,label:'Fictional board',url:'https://example.com/board',created_by:uid,updated_by:uid,created_at:stamp,updated_at:stamp}]};
 if(url.pathname.startsWith('/rest/v1/'))return response(tables[table]??[]);
 throw new Error('Unexpected mocked provider request');
};
const keepAlive=setTimeout(()=>{console.error('Compiled smoke timeout');process.exitCode=1;},20000);
(async()=>{
 const server=new NextServer({conf:JSON.parse(readFileSync('.next/required-server-files.json','utf8')).config,dir:process.cwd(),dev:false,hostname:'projects.fncai.org',port:443});
 await server.prepare();
 try {
  const handler=server.getRequestHandler();
  async function render(url,headers={},body){
   const chunks=[];const {req:request,res}=createRequestResponseMocks({url,method:body?'POST':'GET',headers:{host:'projects.fncai.org','x-forwarded-proto':'https',...headers},resWriter:c=>{chunks.push(Buffer.from(c));return true;}});
   if(body){let sent=false;request._read=function(){if(!sent){sent=true;this.push(body);this.push(null);}};}
   await handler(request,res);await res.headPromise;return {status:res.statusCode,headers:res.getHeaders(),body:Buffer.concat(chunks).toString()};
  }
  const publicPage=await render('/');assert.equal(publicPage.status,200);
  for(const text of ['Explore projects','Fictional examples','Search projects by skill or interest','Sign up'])assert(publicPage.body.includes(text));
  assert(!publicPage.body.includes('Soverflow'));assert.equal(calls.length,0,'Public homepage must not fetch workspace data');
  const signupPage=await render('/login?mode=signup');assert.equal(signupPage.status,200);assert.match(signupPage.body,/name="confirm_password"/);
  for(const route of ['/projects','/admin']){const result=await render(route);assert([200,307].includes(result.status));assert.match(String(result.headers.location??result.body),/\/login/);}
  const exp=Math.floor(Date.now()/1000)+3600;
  const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',exp})).toString('base64url'),'fictional-signature'].join('.');
  const session={access_token:jwt,refresh_token:'fictional-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user};
  const cookieName=`sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const headers={cookie:`${cookieName}=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`};
  const newcomer=await render('/?notice=email-verified',headers);assert.equal(newcomer.status,200);for(const text of ['What do you want to work on','Browse projects','Success! Email verified.'])assert(newcomer.body.includes(text));
  suggested=true;
  const suggestions=await render('/',headers);assert.equal(suggestions.status,200);for(const text of ['Suggested for you','Learning opportunity','View details','Accept','Decline'])assert(suggestions.body.includes(text));
  participating=true;
  const member=await render('/',headers);assert.equal(member.status,200);for(const text of ['Your skills and contributions','Grow your skills','Find and manage opportunities','Dark mode','Sign out?'])assert(member.body.includes(text));
  const projects=await render('/projects?my=1&q=Python',headers);assert.equal(projects.status,200);for(const text of ['All projects','Clear filters','Create a project','name="my"'])assert(projects.body.includes(text));
  const editProfile=await render(`/people/${uid}?edit=1`,headers);assert.equal(editProfile.status,200);for(const text of ['role="combobox"','Want to learn / interests','360','Request a skill'])assert(editProfile.body.includes(text));assert(!editProfile.body.includes('Separate skills with commas'));
  admin=true;
  for(const route of [`/projects/${pid}`,`/projects/${pid}/edit`,'/projects/new','/admin?tab=skills','/admin?tab=access',`/admin?tab=assignments&project=${pid}`]){
   const result=await render(route,headers);assert.equal(result.status,200,route);
   if(route===`/projects/${pid}`)for(const text of ['Fictional board','Edit project','Manage team and invitations'])assert(result.body.includes(text));
   if(route.includes('tab=assignments'))for(const text of ['Auto-Assign','Train','Invite selected','Pending invitations','Already participating','Name, email or skill'])assert(result.body.includes(text));
  }
  participating=false;
  const pendingTeam=await render(`/admin?tab=assignments&project=${pid}`,headers);
  assert.equal(pendingTeam.status,200);assert(pendingTeam.body.includes('Invitation pending'),'Pending invitees must remain visible in search');
  const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
  const signupId=Object.entries(manifest.node).find(([,v])=>v.exportedName==='signup')[0];
  const form=new FormData();for(const [key,value]of Object.entries({display_name:'Fictional Tester',email:'fictional@ibm.com',password:'fictional-long-password',confirm_password:'fictional-long-password'}))form.set(key,value);
  const encoded=await encodeReply([{success:false,message:''},form]);
  const request=new Request('https://projects.fncai.org/login',{method:'POST',body:encoded});const bytes=Buffer.from(await request.arrayBuffer());
  const post=()=>render('/login?mode=signup',{'next-action':signupId,origin:'https://projects.fncai.org','content-type':request.headers.get('content-type'),'content-length':String(bytes.length)},bytes);
  const failed=await post();assert.equal(failed.status,200);assert.match(failed.body,/Account setup or email delivery failed/);assert(!failed.body.includes('Fictional SMTP failure'));
  failure=false;const successful=await post();assert.equal(successful.status,200);assert.match(successful.body,/Check your inbox and spam folder/);
  console.log('PASS: compiled public/authenticated homes, suggestions, signup, filters, catalog profile/project forms, links, admin tabs, and invitation controls render. Protected routes redirect signed-out users. All provider requests mocked; no database, browser, delivery, or live deployment acceptance claimed.');
 } finally {await server.close();clearTimeout(keepAlive);}
})().catch(error=>{console.error(error);clearTimeout(keepAlive);process.exitCode=1;});
