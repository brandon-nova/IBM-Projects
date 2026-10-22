import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile?.(".env.test");
export default defineConfig({
  testDir:"./tests/e2e",
  fullyParallel:false,
  workers:1,
  retries:process.env.CI ? 1 : 0,
  reporter:[["list"],["html",{open:"never"}]],
  use:{baseURL:process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer:{command:"npm run dev -- --hostname 127.0.0.1",url:process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",reuseExistingServer:!process.env.CI,timeout:120000},
});
