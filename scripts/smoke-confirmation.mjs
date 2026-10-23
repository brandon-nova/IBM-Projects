// Compiled verification/session regression. Every provider request is mocked.
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
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fictional@ibm.com',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600;
const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp})).toString('base64url'),'fictional-signature'].join('.');
let attempts=0,verifyStatus=200,active=true;
global.fetch=async(input)=>{
 const url=new URL(typeof input==='string'?input:input.url ?? String(input));
 if(url.origin==='https://projects.fncai.org')return new Response(null,{status:204}); // Next's internal redirect fetch is also mocked.
 assert.equal(url.origin,new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin,'Real external requests are forbidden');
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','x-supabase-api-version':'2024-01-01'}});
 if(url.pathname==='/auth/v1/verify'){
   attempts++;
   return verifyStatus===200?response({access_token:jwt,refresh_token:'fictional-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}):response({msg:'Fictional failure',code:verifyStatus===403?'otp_expired':'unexpected_failure'},verifyStatus);
 }
 if(url.pathname==='/auth/v1/user')return response(user);
 if(url.pathname==='/rest/v1/rpc/workspace_active')return response(active);
 throw new Error('Unexpected mocked request: '+url.pathname);
};
const keepAlive=setInterval(()=>{},1000);
(async()=>{
 const server=new NextServer({conf:JSON.parse(readFileSync('.next/required-server-files.json','utf8')).config,dir:process.cwd(),dev:false,hostname:'projects.fncai.org',port:443});
 await server.prepare();
 try {
   const handler=server.getRequestHandler();
   async function render(url,headers={},body){
     const chunks=[];
     const {req:request,res}=createRequestResponseMocks({url,method:body?'POST':'GET',headers:{host:'projects.fncai.org','x-forwarded-proto':'https',...headers},resWriter:c=>{chunks.push(Buffer.from(c));return true;}});
     if(body){let sent=false;request._read=function(){if(!sent){sent=true;this.push(body);this.push(null);}};}
     await handler(request,res);await res.headPromise;
     return {status:res.statusCode,headers:res.getHeaders(),body:Buffer.concat(chunks).toString()};
   }
   const page=await render('/auth/confirm?token_hash=fictional-token&type=email');
   assert.equal(page.status,200);assert.equal(attempts,0,'GET must not redeem the token');
   assert.match(page.body,/automatically/);assert.match(page.body,/Verify and sign in/);
   const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
   const actionId=Object.entries(manifest.node).find(([,value])=>value.exportedName==='confirmEmail')[0];
   async function confirm(type='email',cookie='',token='fictional-token'){
     const form=new FormData();form.set('token_hash',token);form.set('type',type);
     const encoded=await encodeReply([{success:false,message:''},form]);
     const request=new Request('https://projects.fncai.org/auth/confirm',{method:'POST',body:encoded});
     const bytes=Buffer.from(await request.arrayBuffer());
     return render('/auth/confirm?token_hash=fictional-token&type='+type,{cookie,'next-action':actionId,origin:'https://projects.fncai.org','content-type':request.headers.get('content-type'),'content-length':String(bytes.length)},bytes);
   }
   const success=await confirm();
   assert.equal(attempts,1);assert.match(String(success.headers['x-action-redirect']),/^https:\/\/projects\.fncai\.org\/\?notice=email-verified;/);
   assert.match(String(success.headers['set-cookie']),/sb-.*-auth-token/,'Successful confirmation must set a session cookie');
   const cookie=[].concat(success.headers['set-cookie']).map(value=>value.split(';')[0]).join('; ');
   assert.match(cookie,/ibm_email_confirmation=/);
   verifyStatus=403;
   const replay=await confirm('email',cookie);
   assert.equal(attempts,1,'Same authenticated account must not redeem a used token again');
   assert.match(String(replay.headers['x-action-redirect']),/notice=email-verified/);
   const unrelated=await confirm('email',cookie,'unrelated-token');
   assert.equal(unrelated.headers['x-action-redirect'],undefined);
   assert.match(unrelated.body,/already been used/);
   active=false;
   const revoked=await confirm('email',cookie);
   assert.equal(revoked.headers['x-action-redirect'],undefined);
   active=true;
   verifyStatus=503;
   const unavailable=await confirm();assert.equal(unavailable.headers['x-action-redirect'],undefined);
   assert.match(unavailable.body,/may already be confirmed/);assert(!unavailable.body.includes('Fictional failure'));
   verifyStatus=403;
   const used=await confirm();assert.equal(used.headers['x-action-redirect'],undefined);assert.match(used.body,/already been used/);
   verifyStatus=200;
   const recovery=await confirm('recovery');assert.match(String(recovery.headers['x-action-redirect']),/\/reset-password;/);
   console.log('PASS: compiled confirmation GET does not redeem; successful POST sets session cookies and redirects to the verified notice; repeats skip redemption only for the same active account; unrelated links and revoked accounts fail closed; network/used-token failures remain inline; recovery redirects to password reset. Mocked Supabase only, no live accounts or emails.');
 } finally {await server.close();clearInterval(keepAlive);}
})().catch(error=>{console.error(error);clearInterval(keepAlive);process.exitCode=1});
