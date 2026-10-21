TASK: Implement the Uploads and Staff Panel feature.

Read NOTES.md and SPEC.md first. Follow them and do not redo finished work.

Part 1, Uploads:
- Add an upload endpoint that validates file type and size (max 5 MB) and stores the file in Supabase Storage.
- Save the file URL and metadata in the database, linked to the logged-in user.
- On the front end, add an upload form with progress/error messages and a list of uploaded files.

Part 2, Staff Panel:
- Add a staff-only section visible only to users with a staff/admin role. Enforce the role check on the server.
- Staff can see all uploads and approve or delete them.
- Match the existing styles in static/style.css.

Rules: make the smallest changes that work, keep existing behavior, never put secrets in code, and list any shell commands or SQL I need to run.
