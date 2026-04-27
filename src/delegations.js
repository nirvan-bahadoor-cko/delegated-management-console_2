/**
 * Delegated Management Console (D.M.C.)
 * Delegation model — role definitions and chain validation helpers.
 */

"use strict";

// ---------------------------------------------------------------------------
// Role catalogue
// ---------------------------------------------------------------------------

const ROLES = Object.freeze({
  ADMIN: "admin",
  OPERATOR: "operator",
  EDITOR: "editor",
  VIEWER: "viewer",
  AUDITOR: "auditor",
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DELEGATION_DEPTH = 3;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates a single delegation entry against the expected schema.
 * @param {object} delegation
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateDelegation(delegation) {
  const required = ["delegator", "delegate", "role", "scope", "expiresAt"];
  for (const field of required) {
    if (!delegation[field]) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  if (!Object.values(ROLES).includes(delegation.role)) {
    return { valid: false, reason: `Unknown role: '${delegation.role}'. Valid roles: ${Object.values(ROLES).join(", ")}` };
  }

  if (delegation.delegator === delegation.delegate) {
    return { valid: false, reason: "Self-delegation is not permitted." };
  }

  if (isNaN(Date.parse(delegation.expiresAt))) {
    return { valid: false, reason: `Invalid expiresAt date: ${delegation.expiresAt}` };
  }

  return { valid: true };
}

/**
 * Follows the delegation chain from a given user up to maxDepth hops.
 * Returns an ordered array of delegation objects traversed.
 *
 * @param {object[]} delegations
 * @param {string} startUser
 * @param {string} scope
 * @param {number} [maxDepth]
 * @returns {object[]}
 */
function buildDelegationChain(
  delegations,
  startUser,
  scope,
  maxDepth = MAX_DELEGATION_DEPTH
) {
  const chain = [];
  const visited = new Set();
  let current = startUser;

  while (chain.length < maxDepth) {
    if (visited.has(current)) break; // circular guard
    visited.add(current);

    const next = delegations.find(
      d => d.delegator === current && (d.scope === scope || d.scope === "*")
    );
    if (!next) break;

    chain.push(next);
    current = next.delegate;
  }

  return chain;
}

/**
 * Returns true if the given user has an active (non-expired) delegation
 * for the specified scope with at least the given role.
 *
 * @param {object[]} delegations
 * @param {string} user
 * @param {string} scope
 * @param {string} requiredRole
 * @returns {boolean}
 */
function hasActiveDelegation(delegations, user, scope, requiredRole) {
  const now = new Date();
  return delegations.some(
    d =>
      d.delegate === user &&
      (d.scope === scope || d.scope === "*") &&
      d.role === requiredRole &&
      new Date(d.expiresAt) > now
  );
}

module.exports = {
  ROLES,
  MAX_DELEGATION_DEPTH,
  validateDelegation,
  buildDelegationChain,
  hasActiveDelegation,
};
