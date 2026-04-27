/**
 * Delegated Management Console (D.M.C.)
 *
 * CLI tool for inspecting and validating role delegations
 * within the organisation's access control infrastructure.
 *
 * Usage:
 *   node src/index.js               — list all active delegations
 *   node src/index.js --list        — same as above
 *   node src/index.js --check <res> — show delegations for a resource
 *   node src/index.js --validate    — run delegation chain integrity check
 */

const semver = require("semver");
const fs = require("fs");
const path = require("path");

const DELEGATIONS_FILE = path.join(__dirname, "delegations.json");
const CONFIG_FILE = path.join(__dirname, "..", "dmc.config.json");

const DMC_VERSION = "2.1.0";
const MIN_SCHEMA_VERSION = "2.0.0";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadDelegations() {
  if (!fs.existsSync(DELEGATIONS_FILE)) {
    return { schemaVersion: DMC_VERSION, delegations: [] };
  }
  return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, "utf-8"));
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { environment: "development", maxDelegationDepth: 3, auditLog: false };
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

function validateSchema(data) {
  const { schemaVersion } = data;
  if (!schemaVersion) {
    console.warn("  WARNING: delegations.json has no schemaVersion field.");
    return;
  }
  if (!semver.satisfies(schemaVersion, `>=${MIN_SCHEMA_VERSION}`)) {
    console.error(
      `  ERROR: Unsupported schema version ${schemaVersion}. ` +
      `Minimum required: ${MIN_SCHEMA_VERSION}`
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdList() {
  const data = loadDelegations();
  const config = loadConfig();

  validateSchema(data);

  const { delegations } = data;
  const now = new Date();

  console.log(`Delegated Management Console v${DMC_VERSION}`);
  console.log("============================================\n");
  console.log(`  Environment : ${config.environment}`);
  console.log(`  Max depth   : ${config.maxDelegationDepth}`);
  console.log(`  Audit log   : ${config.auditLog ? "enabled" : "disabled"}`);
  console.log("");

  if (!delegations || delegations.length === 0) {
    console.log("  No active delegations found.\n");
    return;
  }

  console.log("  Active Delegations:");
  console.log("  -------------------");
  for (const d of delegations) {
    const expired = new Date(d.expiresAt) < now;
    const status = expired ? "EXPIRED" : "ACTIVE ";
    console.log(`  [${status}] ${d.delegator} → ${d.delegate}`);
    console.log(`             Role    : ${d.role}`);
    console.log(`             Scope   : ${d.scope}`);
    console.log(`             Expires : ${d.expiresAt}`);
    console.log("");
  }

  const active = delegations.filter(d => new Date(d.expiresAt) >= now).length;
  console.log(`  Total: ${delegations.length} delegation(s), ${active} active.\n`);
}

function cmdCheck(resource) {
  const data = loadDelegations();

  validateSchema(data);

  const matches = (data.delegations || []).filter(
    d => d.scope === resource || d.scope === "*"
  );

  if (matches.length === 0) {
    console.log(`No delegations found for resource: ${resource}`);
    process.exit(1);
  }

  console.log(`Delegations for resource '${resource}':\n`);
  for (const d of matches) {
    const expired = new Date(d.expiresAt) < new Date();
    console.log(`  ${d.delegate} — role: ${d.role} (granted by ${d.delegator})${expired ? " [EXPIRED]" : ""}`);
  }
}

function cmdValidate() {
  const data = loadDelegations();
  const config = loadConfig();

  validateSchema(data);

  const { delegations } = data;
  const maxDepth = config.maxDelegationDepth || 3;
  let issues = 0;

  console.log(`D.M.C. Delegation Chain Validator`);
  console.log("==================================\n");

  if (!delegations || delegations.length === 0) {
    console.log("  Nothing to validate.\n");
    return;
  }

  // Check for self-delegations
  for (const d of delegations) {
    if (d.delegator === d.delegate) {
      console.log(`  FAIL: Self-delegation detected for ${d.delegator} on scope '${d.scope}'`);
      issues++;
    }
  }

  // Check for delegation depth violations (simple chain follow)
  const seen = new Set();
  for (const d of delegations) {
    let current = d.delegator;
    let depth = 0;
    seen.clear();
    while (depth <= maxDepth) {
      if (seen.has(current)) {
        console.log(`  FAIL: Circular delegation chain detected starting at ${d.delegator}`);
        issues++;
        break;
      }
      seen.add(current);
      const next = delegations.find(x => x.delegator === current && x.scope === d.scope);
      if (!next) break;
      current = next.delegate;
      depth++;
    }
    if (depth > maxDepth) {
      console.log(`  FAIL: Delegation chain exceeds max depth (${maxDepth}) for scope '${d.scope}'`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log("  All delegation chains are valid.\n");
  } else {
    console.log(`\n  ${issues} issue(s) detected.\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--list") {
  cmdList();
} else if (args[0] === "--check" && args[1]) {
  cmdCheck(args[1]);
} else if (args[0] === "--validate") {
  cmdValidate();
} else {
  console.log("Usage: node src/index.js [--list | --check <resource> | --validate]");
  process.exit(1);
}
