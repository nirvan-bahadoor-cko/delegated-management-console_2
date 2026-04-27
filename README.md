# Delegated Management Console (D.M.C.)

Lightweight CLI service for managing role delegations and access-control policies across the organisation's infrastructure.

---

## Overview

D.M.C. lets platform teams grant scoped, time-bounded delegations from one principal to another — without handing out permanent admin credentials.

```
alice  ──[admin, scope: project-x]──►  bob
bob    ──[editor, scope: project-x]──►  carol
```

Delegation chains are validated on every CI run to detect circular grants, depth violations, and expired entries.

---

## Requirements

- Node.js 20+
- npm 9+

---

## Installation

```bash
npm ci
```

---

## Usage

```bash
# List all delegations and their status
node src/index.js --list

# Show delegations that cover a specific resource
node src/index.js --check <resource>

# Validate delegation chain integrity
node src/index.js --validate
```

---

## Delegation schema

Delegations are stored in `src/delegations.json`:

```json
{
  "schemaVersion": "2.1.0",
  "delegations": [
    {
      "delegator": "alice",
      "delegate": "bob",
      "role": "admin",
      "scope": "project-x",
      "expiresAt": "2026-12-31T23:59:59Z"
    }
  ]
}
```

Valid roles: `admin`, `operator`, `editor`, `viewer`, `auditor`.  
Use `"scope": "*"` to apply a delegation to all resources (use sparingly).

---

## Security scanning

The CI pipeline runs `security/scan.sh` on every push to `main`. The scanner checks for:

1. Missing or malformed delegation configs  
2. Invalid role references  
3. Privilege-escalation patterns (circular chains, wildcard over-grants)  
4. Access-control policy compliance

---

## Community bot

Open an issue and comment `/check-access <resource>` to look up which delegations are currently active for a given resource.  
The bot will respond with a summary and self-destruct the original comment for privacy.

---

## License

MIT
