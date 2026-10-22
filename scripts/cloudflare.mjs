import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cloudflareSettings } from "./cloudflare-settings.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];
if (!["build", "preview", "deploy"].includes(command)) throw new Error("Use npm run cf:build, cf:preview, or cf:deploy.");

const publicVars = cloudflareSettings(process.env);
const executable = (name) => resolve(root, "node_modules", ".bin", name);
for (const binary of ["opennextjs-cloudflare", "wrangler"]) {
  if (!existsSync(executable(binary))) throw new Error("Cloudflare tools are not installed. Run npm run cf:setup, then retry. This installs the adapter and updates package.json/package-lock.json.");
}

// Only these three public settings reach the Worker config. Provisioning
// credentials in a developer's environment never become Worker bindings.
const config = JSON.parse(readFileSync(resolve(root, "wrangler.jsonc"), "utf8"));
config.vars = { ...config.vars, ...publicVars };
const deployConfig = resolve(root, "wrangler.deploy.json");
writeFileSync(deployConfig, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });

function run(binary, args) {
  const result = spawnSync(executable(binary), args, {
    cwd: root, stdio: "inherit", env: { ...process.env, ...publicVars },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!publicVars.NEXT_PUBLIC_SUPABASE_URL) {
  console.log("Public preview: the IBM landing is available; workspace sign-in and data remain unavailable until Supabase is configured.");
}
run("opennextjs-cloudflare", ["build"]);
if (command === "preview") run("wrangler", ["dev", "--config", deployConfig]);
if (command === "deploy") {
  run("wrangler", ["deploy", "--config", deployConfig]);
  console.log("Cloudflare upload finished. Run npm run cf:verify and the authenticated acceptance checklist before declaring the application ready.");
}
