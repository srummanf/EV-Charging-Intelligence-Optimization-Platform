import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal self-contained server bundle for the Docker image.
  output: "standalone",
  // Don't auto-generate AGENTS.md / CLAUDE.md in this workspace.
  agentRules: false,
};

export default nextConfig;
