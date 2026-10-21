# Constellation

Constellation is an open-source team chat platform with servers, channels,
roles, direct messages, threads, attachments, moderation and audit logs. It is
a plain JavaScript front end served by a small Node static server, with
[Supabase](https://supabase.com) providing the database, authentication,
row-level security and file storage.

Status: early, pre-release. Expect rough edges and breaking changes.

## Features

- Servers with categories, channels, roles and private access
- Text chat, direct messages, reactions, edits and pins
- Invites, public/private servers, kicks and bans
- Moderation tools and an audit log
- Server and role images stored in Supabase Storage
- Database security enforced with row-level security policies (60+ migrations)
- End-to-end and security test suites (Playwright)

Not implemented yet: voice and video, forums, docs, calendars, uploads in chat,
bots and subscriptions.

## Run it yourself

You need Node.js 20+ and a free Supabase project.

1. **Create a Supabase project** at https://supabase.com/dashboard.
2. **Apply the migrations** in `supabase/migrations/` to that project, for
   example with the Supabase CLI:

   ```
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   Use only the migrations here. Do not put the service-role key in the browser.
3. **Point the browser config at your project.** `static/config.js` ships with
   placeholders. Replace them with your project's URL and publishable (anon) key.
   These values are public by design; row-level security protects the data.
4. **Install dependencies and start the server:**

   ```
   npm install
   npm start
   ```

   Open http://localhost:8766. The server binds to `127.0.0.1` only and serves
   static files with `Cache-Control: no-store`.

### Optional: incoming webhook function

The source for the incoming webhook is in
`supabase/functions/incoming-webhook/`. Deploy it with:

```
npx supabase functions deploy incoming-webhook --project-ref <your-project-ref> --no-verify-jwt
```

`--no-verify-jwt` is intentional for webhook callers. Each hook uses a random
256-bit token, and the database checks permissions and applies a rate limit.

## Tests

```
npm run check            # syntax checks
npm run test:e2e         # end-to-end tests (Playwright)
npm run test:security    # security tests
```

The end-to-end and security tests read their Supabase settings from a local
`.env` file. Copy `.env.example` to `.env` and fill in your own values. Never commit `.env`.

## Security notes

- Never commit `.env`, service-role keys, database passwords or Supabase
  access tokens.
- Browser code uses only the publishable key. Application data is not written
  to localStorage, sessionStorage or IndexedDB.
- Direct table access is revoked from browser roles. All data access goes
  through authenticated database functions.

If you find a security issue, please open a private security advisory on
GitHub rather than a public issue.

## Contributing

Issues and pull requests are welcome. For larger changes, open an issue first
to discuss the approach.

## License

MIT. See [LICENSE](LICENSE).
