# EUI Microsoft sign-in: migration plan after university authorization

This is a **future implementation plan**, not a functioning EUI Entra integration. The current system uses demo-only username/password login with synthetic data.

## Phase A — before EUI approval (implemented)

- Clearly label username/password as **temporary demo sign-in**.
- Use local `users` with `username` and **bcrypt-hashed demo passwords**, signed HTTP-only cookies, backend role checks, and short-lived sessions.
- Store only synthetic records. Keep seeded demo password isolated from the real EUI systems.
- Do not collect students' real university passwords or attempt to imitate the Microsoft sign-in page.

## Phase B — EUI IT authorization (required)

Obtain written agreement for:

1. University tenant ID, application registration, approved redirect URI(s) and allowed domains.
2. Supported authentication policy (OIDC authorization code + PKCE, Entra MFA and conditional access if required).
3. Access policy: who may sign in? Are test users allowed? How are student, instructor and administrator roles provisioned?
4. Whether and how the app can receive official course enrollment/roster data; identity authentication **does not prove enrollment**.
5. Whether data processing, campus location, pseudonymous device events and retention are approved under EUI policies and applicable Egyptian law.
6. University-approved hosting, secrets management, audit access, security review and incident handling.

## Phase C — technical migration (to implement after approval)

- Use a trusted Microsoft Entra ID / OpenID Connect integration (e.g., Auth.js Microsoft Entra provider configured by EUI IT) to **redirect users to Microsoft-hosted sign-in**. Never take university credentials in the app.
- Validate tokens against the university's issuer/audience/tenant and cryptographic signature through the approved OIDC library. Use Authorization Code Flow with PKCE.
- Add `directory_tenant_id` and `directory_object_id` fields to an identity mapping table and map `(tid, oid)` to internal UUID. **Never rely on email as the stable key**.
- Link directory identities to approved student and instructor data using the institution's authoritative mapping, not guesses based on names.
- Continue to require server-side `role` and enrollment checks for every API operation.
- Disable `/api/auth/login` username/password and demo credentials in approved deployment, rotate environment secrets, migrate cookies/sessions as necessary.
- Test revoked access, students leaving a subject, account changes, session expiry, tenant mismatch, administrator misuse and privacy/data-retention processes.

## Phase D — production criteria

Written EUI approval, privacy review, actual enrollment integration, a production security assessment, accessible fallback workflows, approved geofence and device policies, tested performance and backup/recovery procedures.

**Important:** university Microsoft integration cannot be completed simply by entering a client ID. You need EUI's tenant-specific authorization and operational support.
