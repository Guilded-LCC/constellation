# Contributing to Constellation

Thanks for helping. Constellation is a small project, so clear reports and small,
focused pull requests get the fastest review.

## Getting set up

See the self-hosting steps in [README.md](README.md). Run the local checks before
you open a pull request:

```
npm run check
```

The end-to-end and security tests need your own Supabase project. Copy
`.env.example` to `.env` and fill in your values. Never commit `.env`, keys, or
database passwords.

## Pull requests

- Keep each pull request to one change. Explain the *why* in the description.
- Include a database migration only as a new file. Never edit a migration that
  has already been applied.
- Any change to row-level security, auth, or permissions needs a test that
  checks the access rule (see the security tests).
- Note in the description which checks you ran and what they showed.

## Issue triage

Issues are labelled as `bug`, `enhancement`, `question`, or `security`. Security
reports go through the private process in [SECURITY.md](SECURITY.md), never a
public issue.

## Reviews and releases

The maintainer reviews pull requests and triages new issues as they come in.
Changes that affect data or security are reviewed before merging. Releases use
semantic versioning (`MAJOR.MINOR.PATCH`), each release is tagged, and every
release is recorded in [CHANGELOG.md](CHANGELOG.md).
