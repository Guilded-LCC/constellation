# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report them privately through GitHub's private vulnerability reporting for this
repository (Security tab → "Report a vulnerability"). Include:

- a description of the issue and its impact,
- steps to reproduce, or a proof of concept,
- the commit or version you tested.

I aim to acknowledge reports within 7 days and to share a fix or mitigation
plan after triage.

## Scope

In scope: the code in this repository, including the SQL migrations (row-level
security and access rules), the Supabase edge functions, and the front end.

Out of scope: issues in third-party services (Supabase, your own hosting
provider) that are not caused by this code, and reports that depend on a
leaked service-role key or a compromised machine.

## Secrets

Never commit `.env`, service-role keys, database passwords, or API keys. The
repository ships only placeholders (`static/config.js`, `.env.example`). The
publishable (anon) key is public by design, and row-level security protects the
data. If you find a real secret in the history, report it as described above.
