import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Project ref from Trigger.dev dashboard - replace with your actual project ref
  project: "",

  // Directory containing tasks
  dirs: ["./src/tasks"],

  // Retry configuration
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },

  // Max duration for tasks (1 hour for large syncs)
  maxDuration: 3600,
});
