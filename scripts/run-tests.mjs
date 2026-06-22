import { startVitest } from "vitest/node";

const context = await startVitest("test", [], {
  watch: false,
  root: process.cwd(),
  config: false,
  environment: "node",
  include: ["electron/**/*.test.ts"]
});

if (!context) process.exitCode = 1;
else await context.close();
