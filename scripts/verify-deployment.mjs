import { resolveCname, resolve4 } from "node:dns/promises";

const origin = process.env.DEPLOYMENT_URL || "https://projects.fncai.org";
const url = new URL(origin);
if (url.protocol !== "https:" || url.pathname !== "/" || url.username || url.password) throw new Error("DEPLOYMENT_URL must be an HTTPS origin.");
const addresses = await resolve4(url.hostname);
if (!addresses.length) throw new Error("The domain has no IPv4 address.");
const cnames = await resolveCname(url.hostname).catch(()=>[]);
const landing = await fetch(origin,{redirect:"manual"});
if (landing.status !== 200) throw new Error(`Public landing returned ${landing.status}.`);
const body = await landing.text();
if (!body.includes("Find work")) throw new Error("The expected IBM landing was not served.");
for (const route of ["/projects","/people","/learning","/admin"]) {
  const response = await fetch(new URL(route,origin),{redirect:"manual"});
  const location = response.headers.get("location");
  if (![302,303,307,308].includes(response.status) || !location || new URL(location,origin).pathname !== "/login") throw new Error(`${route} did not redirect an unauthenticated visitor to login.`);
}
console.log(`DNS, HTTPS fetch, public landing, and anonymous route protection passed for ${url.hostname}. CNAME records found: ${cnames.length}.`);
console.log("This does NOT verify SMTP, authenticated permissions, or the full contribution workflow. Complete docs/ACCEPTANCE.md before declaring deployment ready.");
