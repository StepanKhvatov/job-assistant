import "dotenv/config";

import { readFileSync } from "node:fs";

import { getEnv } from "../src/config/env.js";
import { assertValidHhAuth, resolveAuthPaths } from "../src/playwright/auth.js";

const { statePath, metaPath } = resolveAuthPaths();
const baseUrl = getEnv().HH_BASE_URL;

assertValidHhAuth(statePath, metaPath, baseUrl);

const stateB64 = readFileSync(statePath).toString("base64");
const metaB64 = readFileSync(metaPath).toString("base64");

console.log("Add these GitHub repository secrets:\n");
console.log(`HH_AUTH_STATE_B64=${stateB64}\n`);
console.log(`HH_AUTH_META_B64=${metaB64}\n`);
console.log("Then remove HH_EMAIL / HH_PASSWORD from CI workflow (login runs only locally).");
