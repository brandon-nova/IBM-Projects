import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The application uses dynamic, user-scoped reads. No shared data cache is
// configured for authenticated workspace data.
export default defineCloudflareConfig();
