#!/usr/bin/env node
// Applies the intranet HTTP OAuth patch to @modelcontextprotocol/client.
//
// The upstream MCP SDK requires OAuth token endpoints to be HTTPS (loopback
// exempt). This patch relaxes that to also allow plain HTTP so that private
// intranet MCP servers using OAuth over HTTP work. It is idempotent: it checks
// for the PATCH(piagent) marker before editing, and walks up from this package
// directory to find the SDK wherever it is hoisted (or nested).
//
// Fails soft (exit 0) when the SDK is not found so installation never breaks;
// prints a warning in that case so missing relaxation is discoverable.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join("@modelcontextprotocol", "client", "dist", "index.mjs");
const MARK = "PATCH(piagent)";
const BEFORE =
  'if (url.protocol !== "https:" && !isLoopbackHost(url.hostname)) throw new InsecureTokenEndpointError(url.href);';
const AFTER =
  'if (url.protocol !== "https:" && url.protocol !== "http:" && !isLoopbackHost(url.hostname)) throw new InsecureTokenEndpointError(url.href); // PATCH(piagent): allow intranet HTTP token endpoints';

let file = null;
let dir = here;
for (let i = 0; i < 8 && dir !== dirname(dir); i++) {
  const candidate = join(dir, "node_modules", target);
  if (existsSync(candidate)) {
    file = candidate;
    break;
  }
  const nested = join(
    dir,
    "node_modules",
    "@icefairy",
    "pi-mcp-adapter",
    "node_modules",
    target,
  );
  if (existsSync(nested)) {
    file = nested;
    break;
  }
  dir = dirname(dir);
}

if (!file) {
  console.warn(
    "[pi-mcp-adapter] intranet-HTTP patch skipped: @modelcontextprotocol/client not found",
  );
  process.exit(0);
}

const content = readFileSync(file, "utf-8");

if (content.includes(MARK)) {
  console.log(
    "[pi-mcp-adapter] intranet-HTTP patch already applied:",
    file,
  );
  process.exit(0);
}

if (!content.includes(BEFORE)) {
  console.warn(
    "[pi-mcp-adapter] intranet-HTTP patch skipped: upstream code shape changed:",
    file,
  );
  process.exit(0);
}

writeFileSync(file, content.replace(BEFORE, AFTER));
console.log("[pi-mcp-adapter] intranet-HTTP patch applied:", file);
