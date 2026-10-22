import { Resolver } from "node:dns/promises";

async function verify() {
  const origin = process.env.DEPLOYMENT_URL || "https://projects.fncai.org";
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.username || url.password || url.search || url.hash) throw new Error("DEPLOYMENT_URL must be an HTTPS origin.");

  // Either address family is sufficient. Bound DNS checks so a resolver
  // outage does not leave deployment verification hanging indefinitely.
  const dns = new Resolver({ timeout: 5000, tries: 1 });
  const results = await Promise.allSettled([dns.resolve4(url.hostname), dns.resolve6(url.hostname)]);
  const addresses = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!addresses.length) {
    const details = results.map((result, index) => `${index === 0 ? "A" : "AAAA"}: ${result.status === "rejected" ? result.reason.code : "no addresses"}`).join(", ");
    throw new Error(
      `DNS lookup failed for ${url.hostname} (${details}).\n` +
      "If you just deployed, wait a few minutes and rerun npm run cf:verify.\n" +
      `If it persists, check Workers & Pages → ibm-projects → Settings → Domains & Routes for ${url.hostname}, and check the domain's DNS record in Cloudflare.\n` +
      `Compare your local DNS with: dig @1.1.1.1 ${url.hostname}\n` +
      "The HTTPS/application checks have not run; DNS failure does not establish an application failure."
    );
  }

  const landing = await fetch(origin,{redirect:"manual",signal:AbortSignal.timeout(15000)});
  if (landing.status !== 200) throw new Error(`Public landing returned ${landing.status}.`);
  const body = await landing.text();
  if (!body.includes("Find work") || !body.includes("IBM home")) throw new Error("The expected IBM landing was not served.");
  for (const route of ["/projects","/people","/learning","/admin"]) {
    const response = await fetch(new URL(route,origin),{redirect:"manual",signal:AbortSignal.timeout(15000)});
    const location = response.headers.get("location");
    const target = location ? new URL(location,origin) : null;
    if (![302,303,307,308].includes(response.status) || !target || target.origin !== url.origin || target.pathname !== "/login") throw new Error(`${route} did not redirect an unauthenticated visitor to login.`);
  }
  console.log(`DNS, HTTPS fetch, public landing, and anonymous route protection passed for ${url.hostname}.`);
  console.log("This does NOT verify SMTP, authenticated permissions, or the full contribution workflow. Complete docs/ACCEPTANCE.md before declaring deployment ready.");
}

verify().catch((error) => {
  console.error(`Deployment verification failed: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ""}`);
  process.exitCode = 1;
});
