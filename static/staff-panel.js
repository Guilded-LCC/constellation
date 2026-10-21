(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);
  const NAV = [
    ["dashboard", "Dashboard"],
    ["users", "Users"],
    ["servers", "Servers"],
    ["reports", "Reports"],
    ["uploads", "Uploads"],
    ["badges", "Badges"],
    ["staff", "Staff"],
    ["audit", "Audit log"],
  ];
  const RULE_KINDS = [
    ["staff", "Platform staff"],
    ["account_age_days", "Account age (days)"],
    ["created_before", "Account created before"],
    ["server_count", "Server memberships ≥"],
    ["owned_server_members", "Owned server members ≥"],
    ["message_count", "Messages sent ≥"],
    ["partner_owner", "Owns a partner server"],
    ["verified_owner", "Owns a verified server"],
    ["is_bot", "Is a bot account"],
    ["hypesquad", "HypeSquad house"],
  ];
  const COUNT_KINDS = new Set(["account_age_days", "server_count", "owned_server_members", "message_count"]);
  const PAGE_SIZE = 25;
  let rpc, user, storage, imageApi = "", imageKey = "", getToken = async () => "", loadedFor = null;
  let page = "dashboard";
  let loading = false, busy = false;
  let error = "", note = "";
  let dashboardData = null;
  let users = { rows: [], total: 0, offset: 0, query: "" };
  let selectedUserId = null, selectedUser = null;
  let servers = { rows: [], total: 0, query: "" };
  let selectedServerId = null, selectedServer = null;
  let reports = [], reportStatus = "open";
  let uploads = [], uploadUrls = {}, uploadsFilter = "all";
  let badges = [], editingBadge = null, creating = false, badgeTab = "automatic";
  let staffRows = [], staffSearch = [];
  let auditRows = [], auditQuery = "";
  let uploadStatus = {};
  const root = () => document.querySelector("#app");
  const call = (action, payload = {}) => rpc("staff_action", { p_action: action, p_payload: payload });
  const art = (badge) => (window.renderBadgeIcon ? window.renderBadgeIcon(badge) : esc((badge?.name || "?").slice(0, 1)));
  const errorText = (err) => {
    console.error("[Constellation staff]", err);
    const text = err?.message || "The request could not be completed.";
    if (/not found/i.test(text)) return "This staff page is unavailable.";
    if (/permission|not authorized/i.test(text)) return "Your staff role does not allow this action.";
    if (/reason is required|add a reason|enter a reason/i.test(text)) return "Enter a reason before applying this action.";
    if (/add a moderation note/i.test(text)) return "Write the note before saving it.";
    return text.length < 180 ? text : "Could not save those changes. Please try again.";
  };
  const fmt = (value, withTime = false) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + (withTime ? `, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "");
  };
  const ago = (value) => {
    if (!value) return "never";
    const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return fmt(value);
  };
  const initials = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();
  const avatar = (person, name) => {
    const url = person?.avatar_url;
    return url && /^https:\/\//i.test(url)
      ? `<img src="${esc(url)}" alt="" loading="lazy">`
      : esc(initials(name));
  };
  const chip = (text, cls = "") => `<span class="staff-tag ${cls}">${esc(text)}</span>`;
  const button = (action, label, extra = "", id = "") => `<button class="staff-button ${extra}" data-staff-action="${action}"${id ? ` data-id="${esc(id)}"` : ""}>${esc(label)}</button>`;

  const ico = {
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    users: '<path d="M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6M16 4.6a3.4 3.4 0 0 1 0 6.7M17 14.6c2.7.4 4.5 2.4 4.5 5.4"/>',
    server: '<path d="M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01"/>',
    flag: '<path d="M5 21V4h9l-1 3h6l-2 5 2 5h-6l-1-3H5"/>',
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4"/>',
    badge: '<path d="M12 3l2.4 2.4 3.3-.4.9 3.2 2.9 1.7-1.7 2.9.4 3.3-3.2.9L12 21l-2.4-2.4-3.3.4-.9-3.2L2.5 12l1.7-2.9-.4-3.3 3.2-.9z"/><path d="m9 12 2 2 4-4"/>',
    shield: '<path d="M12 3l7 2.5v5.2c0 4.6-2.9 7.9-7 9.8-4.1-1.9-7-5.2-7-9.8V5.5z"/><path d="m9 11.6 2 2 4-4"/>',
    audit: '<path d="M5 4h9l5 5v11H5zM14 4v5h5M8 13h8M8 17h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="m15 6-6 6 6 6"/>',
  };
  const icon = (name, size = 18) => `<svg class="staff-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[name] || ""}</svg>`;

  function shell(body, heading, crumbs = "") {
    const current = NAV.find(([key]) => key === page)?.[1] || "Staff";
    root().innerHTML = `<main class="staff-shell"><header class="staff-header">
      <a class="staff-brand" href="/" title="Back to Constellation"><span class="staff-symbol">G</span><span class="staff-brandtext"><strong>Guilded Control</strong><small>Trust &amp; safety workspace</small></span></a>
      <form class="staff-global-search" data-staff-search="global" role="search"><span class="staff-search-ico">${icon("search", 17)}</span><input name="query" value="${esc(users.query)}" placeholder="Search email, username or account ID" autocomplete="off" aria-label="Search accounts"><kbd>Enter</kbd></form>
      <div class="staff-identity"><span class="staff-identity-name">${esc(user?.name || user?.username || "Staff")}</span><span class="staff-level">${user?.is_platform_admin ? "Platform admin" : "Staff"}</span><a class="staff-return" href="/">Exit</a></div>
    </header><div class="staff-accent"></div>
    <div class="staff-layout">
      <aside class="staff-nav"><p class="staff-nav-label">Workspace</p>${NAV.map(([key, name]) => `<button class="${page === key ? "active" : ""}" data-staff-action="nav" data-page="${key}">${icon(key === "dashboard" ? "grid" : key === "users" ? "users" : key === "servers" ? "server" : key === "reports" ? "flag" : key === "uploads" ? "upload" : key === "badges" ? "badge" : key === "staff" ? "shield" : "audit")}<span>${esc(name)}</span></button>`).join("")}
        <div class="staff-nav-bottom"><span>Signed in as</span><strong>${esc(user?.username || "staff")}</strong><small>Every action is audited.</small></div>
      </aside>
      <section class="staff-scroll" id="staff-scroll">
        <div class="staff-content">
          <div class="staff-page-head"><div>${crumbs ? `<span class="staff-crumb">${crumbs}</span>` : `<span class="staff-crumb">Guilded / ${esc(current)}</span>`}<h1>${esc(heading || current)}</h1></div><div class="staff-page-actions">${button("refresh", "Refresh", "subtle")}</div></div>
          ${note ? `<div class="staff-alert">${esc(note)}</div>` : ""}
          ${error ? `<div class="staff-alert staff-alert-error" role="alert">${esc(error)}</div>` : ""}
          ${body}
          <div class="staff-error" role="status"></div>
        </div>
      </section>
    </div></main>`;
  }

  function stat(title, value, detail = "") {
    return `<article class="staff-stat"><span>${esc(title)}</span><strong>${esc(value ?? "—")}</strong><small>${esc(detail)}</small></article>`;
  }
  function emptyState(title, detail, action = "") {
    return `<div class="staff-empty-state"><span class="staff-empty-mark">${icon("search", 22)}</span><strong>${esc(title)}</strong><p>${esc(detail)}</p>${action}</div>`;
  }

  function dashboard() {
    if (!dashboardData) return `<div class="staff-skeleton"></div><div class="staff-skeleton"></div><div class="staff-skeleton"></div>`;
    const d = dashboardData;
    return `<div class="staff-stats">${stat("Total accounts", d.users, "All registered users")}${stat("Communities", d.servers, "Servers on Guilded")}${stat("Messages today", d.messages_today, "Since midnight")}${stat("Open reports", d.open_reports, "Awaiting review")}${stat("Suspended", d.suspended, "Accounts on hold")}${stat("Signups · 7d", d.signups_7d, "New accounts this week")}</div>
      <section class="staff-section"><div class="staff-section-head"><h2>Recent moderation activity</h2><button class="staff-link" data-staff-action="nav" data-page="audit">View audit log ${icon("chevron", 14)}</button></div>
      ${(d.activity || []).length ? `<div class="staff-activity">${d.activity.map((item) => `<article class="staff-activity-row"><span class="staff-activity-mark">${icon("shield", 15)}</span><div><strong>${esc(item.action)}</strong><small>${esc(item.target_type)} ${esc(String(item.target_id || "").slice(0, 8))} · ${esc(item.reason || "No reason supplied")}</small></div><time>${esc(ago(item.created_at))}</time></article>`).join("")}</div>` : `<p class="staff-empty">No staff activity yet.</p>`}</section>`;
  }

  function userRow(item) {
    const name = item.name || item.username || "Unnamed account";
    return `<button class="staff-user-row" data-staff-action="user" data-id="${esc(item.id)}">
      <span class="staff-avatar">${avatar(item, name)}</span>
      <span class="staff-user-main"><strong>${esc(name)}</strong><small>@${esc(item.username || "unknown")} · ${esc(item.email || "no email")}</small></span>
      <span class="staff-user-tags">${item.suspended ? chip("Suspended", "danger") : ""}${item.is_staff ? chip("Staff", "gold") : ""}${item.is_bot ? chip("Bot") : ""}</span>
      <span class="staff-user-meta">joined ${esc(fmt(item.created_at))}<small>Account ${esc(String(item.id).slice(0, 8))}…</small></span>
      <span class="staff-row-go">${icon("chevron", 16)}</span>
    </button>`;
  }

  function usersPage() {
    if (selectedUserId) return selectedUser ? userDetail() : `<p class="staff-empty">Loading account…</p>`;
    const rows = users.rows || [];
    return `<form class="staff-searchbar" data-staff-search="users"><span class="staff-search-ico">${icon("search", 17)}</span><input name="query" value="${esc(users.query)}" placeholder="Search by email, @username, display name or account ID" autocomplete="off"><button class="staff-button" type="submit">Search</button></form>
      <div class="staff-result-head"><p>${users.query ? `Results for “${esc(users.query)}”` : "All accounts"}</p><span>${users.total.toLocaleString()} account${users.total === 1 ? "" : "s"}</span></div>
      ${rows.length ? `<div class="staff-user-list">${rows.map(userRow).join("")}</div>` : emptyState(users.query ? "No accounts matched" : "Search for an account", users.query ? "Try a different email, username or account ID." : "Search across every registered account to review badges, moderation history and access.")}
      ${rows.length < users.total ? `<button class="staff-load-more" data-staff-action="users-more">Load more <span>${rows.length.toLocaleString()} of ${users.total.toLocaleString()}</span></button>` : ""}`;
  }

  function userDetail() {
    const u = selectedUser;
    const profile = u.profile || {};
    const name = profile.name || profile.username || "Unnamed account";
    const granted = new Set((u.badges || []).map((badge) => badge.id));
    return `<button class="staff-back" data-staff-action="user-close">${icon("back", 15)} All accounts</button>
    <section class="staff-profile-card">
      <span class="staff-avatar staff-avatar-lg">${avatar(profile, name)}</span>
      <div class="staff-profile-id"><h2>${esc(name)}</h2><p>@${esc(profile.username || "unknown")} <span>·</span> ${esc(u.email || "no email")}</p>
        <div class="staff-chip-list">${u.suspension ? chip("Suspended", "danger") : chip("Active", "ok")}${u.is_staff ? chip(`Staff · ${u.staff_level || "staff"}`, "gold") : ""}${profile.is_bot ? chip("Bot") : ""}${u.email_confirmed ? chip("Email confirmed") : chip("Email unverified", "warn")}${u.hypesquad ? chip(`HypeSquad ${u.hypesquad}`) : ""}${profile.is_official ? chip("Official account", "gold") : ""}</div>
      </div>
      <div class="staff-profile-actions">${button("badge-sync", "Re-evaluate badges", "subtle")}</div>
      <dl class="staff-facts">
        <div class="staff-fact-wide"><dt>Account ID</dt><dd><code>${esc(profile.id || "")}</code><button class="staff-copy" data-staff-action="copy" data-id="${esc(profile.id)}" title="Copy account ID" aria-label="Copy account ID">${icon("copy", 13)}</button></dd></div>
        <div><dt>Joined</dt><dd>${esc(fmt(u.created_at, true))}</dd></div>
        <div><dt>Last sign-in</dt><dd>${esc(ago(u.last_sign_in_at))}</dd></div>
        <div><dt>Messages</dt><dd>${Number(u.messages || 0).toLocaleString()}</dd></div>
        <div><dt>Servers</dt><dd>${(u.servers || []).length.toLocaleString()}</dd></div>
        <div><dt>Reports against</dt><dd>${Number(u.reports || 0).toLocaleString()}</dd></div>
      </dl>
    </section>
    <div class="staff-columns">
      <section class="staff-section"><div class="staff-section-head"><h2>Badges</h2><span class="staff-note">Automatic badges re-apply on sync</span></div>
        <p class="staff-note">Select every badge this account should display. Manual grants are kept until you remove them.</p>
        <div class="staff-badge-picker">${badges.filter((badge) => !badge.hidden_from_picker || granted.has(badge.id)).map((badge) => `<label class="staff-badge-option">
          <input type="checkbox" data-badge-pick value="${esc(badge.id)}" ${granted.has(badge.id) ? "checked" : ""} ${badge.id === "staff" ? 'disabled title="Assigned automatically to platform staff"' : ""}>
          <span class="staff-badge-art">${art(badge)}</span>
          <span class="staff-badge-option-text"><strong>${esc(badge.name)}</strong><small>${esc(badge.description || badge.id)}</small></span>
          ${badge.requirements?.length ? `<span class="staff-auto" title="Automatic requirement">AUTO</span>` : ""}
        </label>`).join("") || `<p class="staff-empty">No badges configured.</p>`}</div>
        <div class="staff-inline staff-inline-end">${button("user-badges-save", "Save badges")}${button("badge-sync", "Re-evaluate", "subtle")}</div>
      </section>
      <section class="staff-section"><div class="staff-section-head"><h2>Moderation</h2>${u.suspension ? chip("Suspended", "danger") : chip("No active ban", "ok")}</div>
        ${u.suspension ? `<div class="staff-reason-card"><strong>Suspension reason</strong><p>${esc(u.suspension.reason)}</p><small>Applied ${esc(fmt(u.suspension.created_at, true))}</small></div>${button("user-unsuspend", "Lift suspension", "subtle")}` : `<label class="staff-label" for="staff-ban-reason">Reason for suspension</label><textarea id="staff-ban-reason" maxlength="1000" placeholder="Required. This is shown to the affected account."></textarea>${button("user-suspend", "Suspend account", "danger")}`}
        <div class="staff-divider"></div>
        <h3>Add a moderation record</h3>
        <div class="staff-note-form"><select id="staff-note-kind"><option value="note">Internal note</option><option value="ip-ban">IP ban request</option><option value="device-ban">Device ban request</option></select><textarea id="staff-note-body" maxlength="2000" placeholder="Evidence, context or the network range to block"></textarea>${button("user-note", "Add record", "subtle")}</div>
        <p class="staff-note">IP and device bans are recorded here for the network layer to enforce. Account suspensions take effect immediately.</p>
      </section>
      <section class="staff-section"><div class="staff-section-head"><h2>Moderation history</h2></div>
        ${(u.notes || []).length ? `<div class="staff-timeline">${u.notes.map((entry) => `<article><span class="staff-timeline-dot ${entry.kind === "ban" ? "danger" : entry.kind === "unban" ? "ok" : ""}"></span><div><strong>${esc(entry.kind === "ip-ban" ? "IP ban request" : entry.kind === "device-ban" ? "Device ban request" : entry.kind)}</strong><p>${esc(entry.body)}</p><small>${esc(entry.author?.name || entry.author?.username || "Staff")} · ${esc(fmt(entry.created_at, true))}</small></div></article>`).join("")}</div>` : `<p class="staff-empty">No moderation records yet.</p>`}</section>
      <section class="staff-section"><div class="staff-section-head"><h2>Communities</h2></div>
        ${(u.servers || []).length ? u.servers.map((server) => `<p class="staff-line">${esc(server.name)} <small>· joined ${esc(fmt(server.created_at))}</small></p>`).join("") : `<p class="staff-empty">Not a member of any community.</p>`}
        <div class="staff-divider"></div>
        <h3>Platform access</h3>
        ${user?.is_platform_admin ? `<div class="staff-inline"><select id="staff-level"><option value="staff" ${u.staff_level === "staff" ? "selected" : ""}>Staff</option><option value="admin" ${u.staff_level === "admin" ? "selected" : ""}>Admin</option></select>${button(u.is_staff ? "staff-revoke-user" : "staff-grant-user", u.is_staff ? "Remove staff" : "Add staff", u.is_staff ? "danger" : "")}</div>` : `<p class="staff-note">Only platform admins can change staff access.</p>`}
      </section>
    </div>`;
  }

  function serversPage() {
    if (selectedServerId) return selectedServer ? serverDetail() : `<p class="staff-empty">Loading server…</p>`;
    return `<form class="staff-searchbar" data-staff-search="servers"><span class="staff-search-ico">${icon("search", 17)}</span><input name="query" value="${esc(servers.query)}" placeholder="Search communities by name or server ID" autocomplete="off"><button class="staff-button" type="submit">Search</button></form>
      <div class="staff-result-head"><p>${servers.query ? `Communities matching “${esc(servers.query)}”` : "All communities"}</p><span>${(servers.rows || []).length} shown</span></div>
      ${(servers.rows || []).length ? `<div class="staff-user-list">${servers.rows.map((item) => `<button class="staff-user-row" data-staff-action="server" data-id="${esc(item.id)}"><span class="staff-avatar staff-avatar-square">${esc(initials(item.name))}</span><span class="staff-user-main"><strong>${esc(item.name)}</strong><small>${Number(item.members).toLocaleString()} members · owner ${esc(item.owner?.name || item.owner?.username || "unknown")}</small></span><span class="staff-user-tags">${item.suspended ? chip("Suspended", "danger") : ""}${item.partner ? chip("Partner", "gold") : ""}${item.verified ? chip("Verified", "ok") : ""}</span><span class="staff-user-meta">created ${esc(fmt(item.created_at))}</span><span class="staff-row-go">${icon("chevron", 16)}</span></button>`).join("")}</div>` : emptyState("No communities found", "Search by community name or server ID.")}`;
  }

  function serverDetail() {
    const s = selectedServer;
    return `<button class="staff-back" data-staff-action="server-close">${icon("back", 15)} All communities</button>
    <section class="staff-profile-card"><span class="staff-avatar staff-avatar-lg staff-avatar-square">${esc(initials(s.server?.name))}</span><div class="staff-profile-id"><h2>${esc(s.server?.name)}</h2><p>Owner ${esc(s.owner?.name || s.owner?.username || "unknown")} · ${Number(s.members).toLocaleString()} members</p><div class="staff-chip-list">${s.suspended ? chip("Suspended", "danger") : chip("Active", "ok")}${s.server?.partner ? chip("Partner", "gold") : ""}${s.server?.verified ? chip("Verified", "ok") : ""}</div></div></section>
    <div class="staff-columns">
      <section class="staff-section"><div class="staff-section-head"><h2>Community flags</h2></div><p class="staff-line">${esc(s.server?.description || "No description")}</p>
        <div class="staff-flags"><label><input type="checkbox" id="staff-verified" ${s.server?.verified ? "checked" : ""}> Verified</label><label><input type="checkbox" id="staff-partner" ${s.server?.partner ? "checked" : ""}> Partner</label>${button("server-flags", "Save flags")}</div>
        <p class="staff-note">Partner status automatically grants the Guilded Partner badge to the owner.</p></section>
      <section class="staff-section"><div class="staff-section-head"><h2>Server badges</h2></div><label class="staff-check-row"><input type="checkbox" id="staff-internal-employee" ${s.server?.features?.INTERNAL_EMPLOYEE_ONLY ? "checked" : ""}> Internal Employee (staff-only server)</label><p class="staff-note">While INTERNAL_EMPLOYEE_ONLY is on, the server shows the Internal Employee badge everywhere members see it.</p>${button("server-features", "Save badges")}</section>
      <section class="staff-section"><div class="staff-section-head"><h2>Channels</h2><span class="staff-note">${(s.channels || []).length} channels</span></div><div class="staff-chip-list">${(s.channels || []).map((channel) => chip(`${channel.type === "TEXT" ? "#" : ""} ${channel.name}`)).join("") || `<span class="staff-empty">No channels</span>`}</div></section>
      <section class="staff-section"><div class="staff-section-head"><h2>Moderation</h2></div>${s.suspension ? `<div class="staff-reason-card"><strong>Suspension reason</strong><p>${esc(s.suspension.reason)}</p></div>${button("server-unsuspend", "Lift suspension", "subtle")}` : `<label class="staff-label" for="staff-server-reason">Reason for suspension</label><textarea id="staff-server-reason" maxlength="1000" placeholder="Required"></textarea>${button("server-suspend", "Suspend community", "danger")}`}</section>
    </div>`;
  }

  function reportsPage() {
    return `<div class="staff-filterbar">${["open", "reviewing", "resolved", "dismissed", "all"].map((key) => `<button class="staff-filter ${reportStatus === key ? "active" : ""}" data-staff-action="reports-filter" data-id="${key}">${esc(key[0].toUpperCase() + key.slice(1))}</button>`).join("")}</div>
      ${reports.length ? reports.map((report) => `<article class="staff-report-card">
        <div class="staff-report-head"><div><strong>${esc(report.reason)}</strong><small>Reported by ${esc(report.reporter_profile?.name || report.reporter_profile?.username || "member")} · ${esc(fmt(report.created_at, true))}</small></div>${chip(report.status, report.status === "open" ? "warn" : report.status === "resolved" ? "ok" : "")}</div>
        ${report.target_profile ? `<p class="staff-note">Target: <strong>${esc(report.target_profile.name || report.target_profile.username)}</strong> · ${esc(report.target_profile.id || "")}</p>` : ""}
        ${report.message ? `<blockquote>${esc(report.message.body)}<small>#${esc(report.message.channel_id)} · message ${esc(report.message.id)}</small></blockquote><a class="staff-link" href="/?server=${encodeURIComponent(report.message.server_id)}&channel=${encodeURIComponent(report.message.channel_id)}">Open reported channel</a>` : ""}
        <div class="staff-inline staff-report-actions"><select id="report-status-${esc(report.id)}">${["open", "reviewing", "resolved", "dismissed"].map((state) => `<option ${report.status === state ? "selected" : ""}>${state}</option>`).join("")}</select><input id="report-note-${esc(report.id)}" placeholder="Internal notes" value="${esc(report.internal_notes)}"><button class="staff-button" data-staff-action="report-save" data-id="${esc(report.id)}">Save review</button></div>
      </article>`).join("") : emptyState("This queue is empty", "Reports from members will appear here for review.")}`;
  }

  function uploadsPage() {
    const counts = { all: uploads.length, pending: uploads.filter((row) => row.status !== "approved").length, approved: uploads.filter((row) => row.status === "approved").length };
    const rows = uploadsFilter === "all" ? uploads : uploads.filter((row) => (row.status === "approved" ? "approved" : "pending") === uploadsFilter);
    return `<div class="staff-filterbar">${[["all", "All"], ["pending", "Pending"], ["approved", "Approved"]].map(([key, label]) => `<button class="staff-filter ${uploadsFilter === key ? "active" : ""}" data-staff-action="uploads-filter" data-id="${key}">${esc(label)} <span>${counts[key]}</span></button>`).join("")}</div>
      ${rows.length ? `<div class="staff-upload-grid">${rows.map((row) => {
        const approved = row.status === "approved", url = uploadUrls[row.id], preview = url && /^image\//.test(row.content_type || "") ? `<a class="staff-upload-art" href="${esc(url)}" target="_blank" rel="noreferrer"><img src="${esc(url)}" alt="${esc(row.file_name)}" loading="lazy"></a>` : `<span class="staff-upload-art staff-upload-file">${icon("upload", 20)}</span>`;
        const uploader = String(row.user?.name || row.user?.username || "").trim() || (row.user?.id ? "Former account" : "Unknown user");
        return `<article class="staff-upload-card">${preview}<div class="staff-upload-body"><div class="staff-report-head"><strong>${esc(row.file_name)}</strong>${chip(approved ? "Approved" : "Pending", approved ? "ok" : "warn")}</div><p>${esc(uploader)} · ${esc(fmt(row.created_at, true))} · ${Math.round((Number(row.byte_size) || 0) / 1024)}KB</p><div class="staff-inline">${approved ? "" : button("upload-approve", "Approve", "subtle", row.id)}${button("upload-delete", "Delete", "danger", row.id)}${url ? `<a class="staff-button subtle" href="${esc(url)}" target="_blank" rel="noreferrer">Open</a>` : ""}</div></div></article>`;
      }).join("")}</div>` : emptyState("No uploads here", "Attachments awaiting review will show up in this queue.")}`;
  }

  function ruleValue(kind, config = {}) {
    if (COUNT_KINDS.has(kind)) return config.count ?? "";
    if (kind === "created_before") return String(config.date || "").slice(0, 10);
    if (kind === "hypesquad") return config.house || "";
    return "";
  }
  function ruleRow(rule = { kind: "server_count", config: {} }) {
    const kind = rule.kind || "server_count";
    return `<div class="staff-rule" data-rule-row><select data-rule-kind aria-label="Requirement type">${RULE_KINDS.map(([value, label]) => `<option value="${value}" ${value === kind ? "selected" : ""}>${esc(label)}</option>`).join("")}</select><input data-rule-value value="${esc(ruleValue(kind, rule.config || {}))}" placeholder="${kind === "hypesquad" ? "bravery / brilliance / balance" : kind === "created_before" ? "YYYY-MM-DD" : COUNT_KINDS.has(kind) ? "Minimum" : "No value"}" ${COUNT_KINDS.has(kind) || kind === "created_before" || kind === "hypesquad" ? "" : "disabled"}><button type="button" class="staff-icon-button" data-staff-action="rule-remove" aria-label="Remove requirement">${icon("close", 14)}</button></div>`;
  }
  function ruleLabel(rule) {
    const config = rule.config || {};
    if (rule.kind === "staff") return "Platform staff";
    if (rule.kind === "partner_owner") return "Owns a partner server";
    if (rule.kind === "verified_owner") return "Owns a verified server";
    if (rule.kind === "is_bot") return "Bot account";
    if (rule.kind === "account_age_days") return `Account ≥ ${config.days || 0} days old`;
    if (rule.kind === "created_before") return `Created before ${ruleValue("created_before", config) || "—"}`;
    if (rule.kind === "server_count") return `Member of ≥ ${config.count || 0} servers`;
    if (rule.kind === "owned_server_members") return `Owns a server with ≥ ${config.count || 0} members`;
    if (rule.kind === "message_count") return `≥ ${config.count || 0} messages`;
    if (rule.kind === "hypesquad") return `HypeSquad ${config.house || "house"}`;
    return rule.kind;
  }

  function badgeEditor(badge) {
    return `<form class="staff-badge-editor" data-staff-form="badge" data-id="${esc(badge.id)}">
      <input type="hidden" name="id" value="${esc(badge.id)}">
      <div class="staff-field-grid"><label>Name<input name="name" maxlength="60" required value="${esc(badge.name)}"></label><label>Category<select name="category">${["identity", "achievement", "hypesquad", "program", "developer", "event"].map((value) => `<option ${badge.category === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div>
      <label>Description<textarea name="description" maxlength="500" placeholder="Shown in badge tooltips">${esc(badge.description || "")}</textarea></label>
      <div class="staff-field-grid"><label>Assignment<select name="assignment">${[["automatic", "Automatic"], ["manual", "Manual"], ["both", "Automatic + manual"]].map(([value, label]) => `<option value="${value}" ${(badge.assignment || "manual") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label>Display scope<select name="display_scope">${[["everywhere", "Everywhere"], ["profile", "Profile only"], ["owned_servers", "Servers the member owns"], ["hidden", "Never shown"]].map(([value, label]) => `<option value="${value}" ${(badge.display_scope || "everywhere") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label></div><div class="staff-field-grid"><label>Accent colour<input name="accent" maxlength="9" pattern="^#[0-9a-fA-F]{6}$" value="${esc(badge.accent || "#5bb8fa")}"></label><label class="staff-check-row"><input type="checkbox" name="hidden_from_picker" ${badge.hidden_from_picker ? "checked" : ""}> Hide from the manual badge picker</label></div>
      <label>Icon URL<input name="icon_url" value="${esc(badge.icon_url || "")}" placeholder="https://… or upload an image"></label>
      <div class="staff-icon-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-badge-icon="${esc(badge.id)}"><span data-icon-status>${esc(uploadStatus[badge.id] || "")}</span></div>
      <div class="staff-import-row"><input data-import-url placeholder="Paste any image URL to import"><button type="button" class="staff-button subtle" data-staff-action="import-image">Fetch &amp; host</button><button type="button" class="staff-button subtle" data-staff-action="clean-image">Remove background</button></div>
      <p class="staff-note">Imported and uploaded icons are re-hosted in Guilded storage, so they keep working if the source disappears. Solid backgrounds are cleaned with remove.bg.</p>
      <div class="staff-requirements"><div class="staff-section-head"><h3>Automatic requirements</h3><button type="button" class="staff-link" data-staff-action="rule-add">${icon("plus", 14)} Add requirement</button></div><p class="staff-note">Every requirement must match. No requirements means the badge is granted manually.</p><div data-rule-list>${(badge.requirements || []).map(ruleRow).join("")}</div></div>
      <div class="staff-inline staff-inline-end">${button("badge-cancel", "Cancel", "subtle")}${button("badge-save", "Save badge", "primary")}</div>
    </form>`;
  }

  function badgeCard(badge) {
    const editing = editingBadge === badge.id;
    return `<article class="staff-badge-card ${editing ? "editing" : ""}"><div class="staff-badge-head"><span class="staff-badge-art staff-badge-art-lg">${art(badge)}</span><div><strong>${esc(badge.name)}</strong><small>${esc(badge.id)} · ${esc(badge.category || "achievement")} · ${esc(badge.assignment || "manual")} · ${esc(badge.display_scope || "everywhere")}${badge.hidden_from_picker ? " · hidden from picker" : ""}</small></div><span class="staff-badge-count">${Number(badge.grants || 0).toLocaleString()}<small>granted</small></span></div><p>${esc(badge.description || "No description yet.")}</p><div class="staff-chip-list">${(badge.requirements || []).length ? badge.requirements.map((rule) => chip(ruleLabel(rule))).join("") : chip("Manual grant", "muted")}</div>${editing ? badgeEditor(badge) : ""}<div class="staff-badge-actions"><button class="staff-button subtle" data-staff-action="badge-edit" data-id="${esc(badge.id)}">${editing ? "Close editor" : "Edit badge"}</button>${badge.id === "staff" || badge.id === "verified" || badge.id === "early-supporter" ? "" : `<button class="staff-button danger" data-staff-action="badge-delete" data-id="${esc(badge.id)}">Delete</button>`}</div></article>`;
  }

  function badgesPage() {
    const automaticCount = badges.filter((badge) => badge.assignment !== "manual").length, manualCount = badges.filter((badge) => badge.assignment === "manual").length;
    return `<div class="staff-filterbar"><button class="staff-filter ${badgeTab === "automatic" ? "active" : ""}" data-staff-action="badges-tab" data-id="automatic">Automatic <span>${automaticCount}</span></button><button class="staff-filter ${badgeTab === "manual" ? "active" : ""}" data-staff-action="badges-tab" data-id="manual">Manual <span>${manualCount}</span></button></div><div class="staff-badge-toolbar"><p>${badges.length} badges · ${badgeTab === "manual" ? "manual badges are granted by staff or billing" : "automatic requirements run whenever an account syncs"}.</p>${button("badge-create", "New badge", "primary")}</div>
      ${creating ? `<form class="staff-section staff-badge-create" data-staff-form="badge" data-id=""><div class="staff-section-head"><h2>New badge</h2>${button("badge-cancel", "Cancel", "subtle")}</div><div class="staff-field-grid"><label>Badge ID<input name="id" maxlength="40" required pattern="[a-z0-9_-]{2,40}" placeholder="guilded-example"></label><label>Name<input name="name" maxlength="60" required placeholder="Badge name"></label></div><label>Description<textarea name="description" maxlength="500" placeholder="What this badge represents"></textarea></label><label>Category<select name="category"><option>achievement</option><option>identity</option><option>hypesquad</option><option>program</option><option>developer</option><option>event</option></select></label><div class="staff-field-grid"><label>Assignment<select name="assignment"><option value="automatic">Automatic</option><option value="manual">Manual</option><option value="both">Automatic + manual</option></select></label><label>Display scope<select name="display_scope"><option value="everywhere">Everywhere</option><option value="profile">Profile only</option><option value="owned_servers">Servers the member owns</option><option value="hidden">Never shown</option></select></label></div><div class="staff-field-grid"><label>Accent colour<input name="accent" maxlength="9" pattern="^#[0-9a-fA-F]{6}$" value="#5bb8fa"></label><label class="staff-check-row"><input type="checkbox" name="hidden_from_picker"> Hide from the manual badge picker</label></div><label>Icon URL<input name="icon_url" placeholder="https://… or upload below"></label><div class="staff-icon-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-badge-icon="__new"><span data-icon-status></span></div><div class="staff-import-row"><input data-import-url placeholder="Paste any image URL to import"><button type="button" class="staff-button subtle" data-staff-action="import-image">Fetch &amp; host</button><button type="button" class="staff-button subtle" data-staff-action="clean-image">Remove background</button></div><div class="staff-inline staff-inline-end">${button("badge-save", "Create badge", "primary")}</div></form>` : ""}
      <div class="staff-badge-grid">${badges.filter((badge) => (badgeTab === "manual" ? badge.assignment === "manual" : badge.assignment !== "manual")).map(badgeCard).join("") || emptyState(badgeTab === "manual" ? "No manual badges" : "No automatic badges", badgeTab === "manual" ? "Manual badges are granted from an account page." : "Automatic badges appear once a requirement is added.")}</div>`;
  }

  function staffPage() {
    return `<form class="staff-searchbar" data-staff-search="staff"><span class="staff-search-ico">${icon("search", 17)}</span><input name="query" placeholder="Find an account to add to platform staff" autocomplete="off"><button class="staff-button" type="submit">Search</button></form>
      ${staffSearch.length ? `<div class="staff-user-list">${staffSearch.map((item) => `<div class="staff-user-row staff-user-row-static"><span class="staff-avatar">${avatar(item, item.name || item.username)}</span><span class="staff-user-main"><strong>${esc(item.name || item.username)}</strong><small>${esc(item.email || "")}</small></span><button class="staff-button" data-staff-action="staff-add" data-id="${esc(item.id)}">Add staff</button></div>`).join("")}</div>` : ""}
      <div class="staff-section"><div class="staff-section-head"><h2>Platform team</h2><span class="staff-note">${staffRows.length} member${staffRows.length === 1 ? "" : "s"}</span></div><div class="staff-table">${staffRows.map((row) => `<div class="staff-table-row"><span class="staff-avatar">${avatar(row.profile, row.profile?.name || row.profile?.username)}</span><span class="staff-table-main"><strong>${esc(row.profile?.name || row.profile?.username || "Unknown")}</strong><small>${esc(row.profile?.username ? `@${row.profile.username}` : "")} · added ${esc(fmt(row.added_at))}</small></span><select data-staff-level="${esc(row.user_id)}"><option value="staff" ${row.level === "staff" ? "selected" : ""}>Staff</option><option value="admin" ${row.level === "admin" ? "selected" : ""}>Admin</option></select><button class="staff-button subtle" data-staff-action="staff-level-save" data-id="${esc(row.user_id)}">Save</button><button class="staff-button danger" data-staff-action="staff-remove" data-id="${esc(row.user_id)}">Remove</button></div>`).join("") || `<p class="staff-empty">No platform staff configured.</p>`}</div></div>`;
  }

  function auditPage() {
    return `<form class="staff-searchbar" data-staff-search="audit"><span class="staff-search-ico">${icon("search", 17)}</span><input name="query" value="${esc(auditQuery)}" placeholder="Filter by action, e.g. user/suspend" autocomplete="off"><button class="staff-button" type="submit">Filter</button></form>
      <div class="staff-table">${auditRows.map((row) => `<div class="staff-table-row staff-audit"><span class="staff-activity-mark">${icon("shield", 15)}</span><span class="staff-table-main"><strong>${esc(row.action)}</strong><small>${esc(row.target_type)} · ${esc(row.target_id || "—")} · ${esc(row.reason || "No reason supplied")}</small></span><time>${esc(fmt(row.created_at, true))}</time></div>`).join("") || `<p class="staff-empty">No matching audit records.</p>`}</div>`;
  }

  function render() {
    const body = page === "dashboard" ? dashboard() : page === "users" ? usersPage() : page === "servers" ? serversPage() : page === "reports" ? reportsPage() : page === "uploads" ? uploadsPage() : page === "badges" ? badgesPage() : page === "staff" ? staffPage() : auditPage();
    const heading = selectedUserId && page === "users" ? "Account detail" : selectedServerId && page === "servers" ? "Community detail" : "";
    const crumbs = selectedUserId && page === "users" ? "Guilded / Users / Account" : selectedServerId && page === "servers" ? "Guilded / Servers / Community" : "";
    const previous = document.querySelector("#staff-scroll")?.scrollTop || 0;
    shell(body, heading, crumbs);
    const scroll = document.querySelector("#staff-scroll");
    if (scroll) scroll.scrollTop = render.toTop ? 0 : render.scrollTop ?? previous;
    render.toTop = false;
    render.scrollTop = undefined;
  }

  async function openUser(id) {
    const detail = await call("user/get", { user_id: id });
    if (!detail) throw new Error("The account detail was not returned.");
    selectedUser = detail;
    selectedUserId = id;
  }

  async function load({ silent = false } = {}) {
    if (loading) return;
    loading = true;
    if (!silent) { error = ""; }
    try {
      if (page === "dashboard") dashboardData = await call("dashboard");
      if (page === "users") {
        const found = await call("users/search", { query: users.query, limit: PAGE_SIZE, offset: users.offset });
        users = { ...users, ...found };
        if (!badges.length) badges = await call("badges/list");
        if (selectedUserId) await openUser(selectedUserId);
      }
      if (page === "servers") servers = { ...servers, rows: await call("servers/search", { query: servers.query }) };
      if (page === "servers" && selectedServerId) selectedServer = await call("server/get", { server_id: selectedServerId });
      if (page === "reports") reports = await call("reports", { status: reportStatus === "all" ? null : reportStatus });
      if (page === "uploads") {
        uploads = (await rpc("staff_list_uploads")) || [];
        uploadUrls = {};
        await Promise.all(uploads.map(async (row) => {
          if (!row?.id || !row.storage_path || !storage?.sign) return;
          try { const url = await storage.sign(row.storage_path); if (url) uploadUrls[row.id] = url; }
          catch (err) { console.error("[Constellation staff] could not sign upload preview", err); }
        }));
      }
      if (page === "badges") badges = await call("badges/list");
      if (page === "staff") staffRows = await call("staff/list");
      if (page === "audit") auditRows = await call("audit", { query: auditQuery });
      error = "";
    } catch (err) {
      error = errorText(err);
    } finally {
      loading = false;
    }
    render();
  }

  function fail(err) {
    error = errorText(err);
    render();
  }
  // Notes update in place so unsaved editor fields are never wiped.
  function setNote(text, rerender = false) {
    note = text;
    if (rerender) render();
    else {
      const content = document.querySelector(".staff-content");
      if (!content) return render();
      let alert = content.querySelector(".staff-alert:not(.staff-alert-error)");
      if (!alert) {
        content.querySelector(".staff-page-head")?.insertAdjacentHTML("afterend", '<div class="staff-alert" role="status"></div>');
        alert = content.querySelector(".staff-alert:not(.staff-alert-error)");
      }
      if (alert) alert.textContent = text;
    }
    clearTimeout(setNote.timer);
    setNote.timer = setTimeout(() => {
      if (note !== text) return;
      note = "";
      document.querySelector(".staff-alert:not(.staff-alert-error)")?.remove();
    }, 3200);
  }

  async function saveBadge(form) {
    const fields = Object.fromEntries(new FormData(form));
    fields.hidden_from_picker = form.querySelector('[name="hidden_from_picker"]')?.checked ? "true" : "false";
    const rows = [...form.querySelectorAll("[data-rule-row]")];
    const requirements = rows.map((row) => {
      const kind = row.querySelector("[data-rule-kind]")?.value || "server_count";
      const raw = row.querySelector("[data-rule-value]")?.value?.trim() || "";
      let config = {};
      if (COUNT_KINDS.has(kind)) config = { count: Math.max(1, Number(raw) || 1) };
      else if (kind === "created_before") config = { date: raw ? `${raw}T00:00:00Z` : new Date().toISOString() };
      else if (kind === "hypesquad") config = { house: ["bravery", "brilliance", "balance"].includes(raw) ? raw : "bravery" };
      return { kind, config, enabled: true };
    });
    if (fields.id) await call("badge/save", fields);
    if (fields.id) await call("badge/requirements", { badge: fields.id, requirements });
    badges = await call("badges/list");
    editingBadge = null;
    creating = false;
    setNote("Badge saved. Requirements apply on the next account sync.", true);
  }

  function isLocalImageApi() {
    return String(imageApi).startsWith("/");
  }
  async function callImageTool(action, body, contentType) {
    if (!imageApi) throw new Error("Image tools are not configured.");
    const headers = {};
    if (contentType) headers["Content-Type"] = contentType;
    if (!isLocalImageApi()) {
      if (imageKey) headers.apikey = imageKey;
      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${imageApi}?action=${encodeURIComponent(action)}`, { method: "POST", headers, body });
    if (!response.ok) {
      let message = "";
      try { const data = await response.json(); message = data?.error || ""; } catch {}
      throw new Error(message || `The image service returned ${response.status}.`);
    }
    return response.blob();
  }

  async function renderToCanvas(blob, max = 512) {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(16, Math.round(bitmap.width * scale));
    canvas.height = Math.max(16, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return { canvas, ctx };
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png");
    });
  }

  async function cleanWithApi(blob, statusEl) {
    if (statusEl) statusEl.textContent = "Removing background with remove.bg…";
    const cleaned = await callImageTool("remove-bg", blob, blob.type || "image/png");
    const { canvas } = await renderToCanvas(cleaned, 512);
    trimCanvas(canvas);
    return canvasBlob(canvas);
  }

  async function prepareIcon(blob, statusEl, force = false) {
    const { canvas, ctx } = await renderToCanvas(blob, 512);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const solid = detectSolidBackground(image);
    const shouldRemove = force || (solid.solid && confirm("This icon has a solid background.\n\nUpload a transparent PNG without that background?"));
    if (!shouldRemove) return { blob: await canvasBlob(canvas), removed: false };
    try {
      return { blob: await cleanWithApi(blob, statusEl), removed: true };
    } catch (error) {
      console.warn("[Constellation staff] remove.bg unavailable, using local cleanup", error);
      if (statusEl) statusEl.textContent = "Using local background cleanup…";
      if (solid.solid) {
        ctx.putImageData(removeBackground(image, solid.color), 0, 0);
        trimCanvas(canvas);
      }
      return { blob: await canvasBlob(canvas), removed: solid.solid };
    }
  }

  async function hostPrepared(blob, form, { force = false, statusEl } = {}) {
    if (!storage?.uploadBadgeIcon) throw new Error("Image storage is not configured.");
    const status = statusEl || form.querySelector("[data-icon-status]");
    if (status) status.textContent = "Preparing icon…";
    const prepared = await prepareIcon(blob, status, force);
    if (status) status.textContent = "Uploading to Guilded storage…";
    const url = await storage.uploadBadgeIcon(prepared.blob, "png");
    const iconField = form.querySelector('input[name="icon_url"]');
    if (iconField) iconField.value = url;
    const badge = badges.find((entry) => entry.id === form.dataset.id);
    if (badge) badge.icon_url = url;
    if (status) status.textContent = prepared.removed ? "Uploaded with a transparent background." : "Uploaded and hosted permanently.";
    setNote(prepared.removed ? "Background removed and icon hosted. Save the badge to publish it." : "Icon hosted permanently. Save the badge to publish it.");
  }

  async function uploadIcon(input) {
    const file = input.files?.[0];
    if (!file) return;
    const form = input.closest("form");
    const statusEl = input.parentElement.querySelector("[data-icon-status]");
    if (!form) return;
    try {
      await hostPrepared(file, form, { statusEl });
    } catch (error) {
      if (statusEl) statusEl.textContent = "";
      console.error("[Constellation staff] icon upload failed", error);
      fail(error);
    }
  }

  async function importIcon(form, rawUrl, force = false) {
    const statusEl = form.querySelector("[data-icon-status]");
    const url = String(rawUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("Paste a full image URL starting with http or https.");
    if (statusEl) statusEl.textContent = "Fetching image…";
    const blob = await callImageTool("import", JSON.stringify({ url }), "application/json");
    await hostPrepared(blob, form, { force, statusEl });
  }

  async function cleanCurrentIcon(form) {
    const field = form.querySelector('input[name="icon_url"]');
    const url = field?.value?.trim() || "";
    if (!url) throw new Error("Add an image URL or upload a file first.");
    await importIcon(form, url, true);
  }

  function detectSolidBackground(image) {
    const { data, width, height } = image;
    const counts = new Map();
    const sample = (x, y) => {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    const points = [];
    const step = Math.max(1, Math.round(Math.min(width, height) / 64));
    for (let x = 0; x < width; x += step) { points.push(sample(x, 0), sample(x, height - 1)); }
    for (let y = 0; y < height; y += step) { points.push(sample(0, y), sample(width - 1, y)); }
    let transparent = 0;
    for (const pixel of points) {
      if (pixel[3] < 24) { transparent += 1; continue; }
      const key = `${pixel[0] >> 4},${pixel[1] >> 4},${pixel[2] >> 4}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (transparent > points.length * 0.6) return { solid: false };
    const [key, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ["0,0,0", 0];
    const [r, g, b] = key.split(",").map((value) => (Number(value) << 4) + 8);
    let near = 0;
    for (const pixel of points) {
      if (pixel[3] < 24) continue;
      if (Math.abs(pixel[0] - r) + Math.abs(pixel[1] - g) + Math.abs(pixel[2] - b) < 90) near += 1;
    }
    return { solid: hits / Math.max(1, points.length - transparent) > 0.86 && near / Math.max(1, points.length - transparent) > 0.86, color: [r, g, b] };
  }

  function removeBackground(image, color) {
    const { data, width, height } = image;
    const visited = new Uint8Array(width * height);
    const stack = [];
    const matches = (index) => {
      const offset = index * 4;
      if (data[offset + 3] < 20) return true;
      const dr = data[offset] - color[0], dg = data[offset + 1] - color[1], db = data[offset + 2] - color[2];
      return dr * dr + dg * dg + db * db < 58 * 58;
    };
    for (let x = 0; x < width; x += 1) { stack.push(x, (height - 1) * width + x); }
    for (let y = 0; y < height; y += 1) { stack.push(y * width, y * width + width - 1); }
    while (stack.length) {
      const index = stack.pop();
      if (index < 0 || index >= width * height || visited[index]) continue;
      if (!matches(index)) continue;
      visited[index] = 1;
      data[index * 4 + 3] = 0;
      const x = index % width;
      if (x > 0) stack.push(index - 1);
      if (x < width - 1) stack.push(index + 1);
      if (index >= width) stack.push(index - width);
      if (index < width * (height - 1)) stack.push(index + width);
    }
    // Soften the cut edge so the icon does not look jagged when scaled down.
    const edge = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        if (visited[i]) continue;
        if (visited[i - 1] || visited[i + 1] || visited[i - width] || visited[i + width]) edge.push(i);
      }
    }
    for (const i of edge) data[i * 4 + 3] = 140;
    return image;
  }

  function trimCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let left = width, right = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right <= left || bottom <= top) return;
    const pad = 2;
    left = Math.max(0, left - pad); top = Math.max(0, top - pad);
    right = Math.min(width - 1, right + pad); bottom = Math.min(height - 1, bottom + pad);
    const cropped = document.createElement("canvas");
    cropped.width = right - left + 1;
    cropped.height = bottom - top + 1;
    cropped.getContext("2d").drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    canvas.width = cropped.width;
    canvas.height = cropped.height;
    canvas.getContext("2d").drawImage(cropped, 0, 0);
  }

  async function act(action, id, source) {
    // Navigation stays available while a save settles so the console never
    // feels stuck behind a slow request.
    if (busy && !["nav", "refresh"].includes(action)) return;
    busy = true;
    const previousScroll = document.querySelector("#staff-scroll")?.scrollTop || 0;
    try {
      if (action === "nav") {
        page = source.dataset.page; error = ""; note = "";
        selectedUserId = null; selectedUser = null; selectedServerId = null; selectedServer = null; creating = false; editingBadge = null;
        if (page === "users" && users.query) users.offset = 0;
        render.toTop = true;
        await load({ silent: true });
        return;
      }
      if (action === "refresh") { await load(); return; }
      if (action === "copy") {
        try { await navigator.clipboard.writeText(id); setNote("Account ID copied."); } catch { setNote("Could not copy the account ID."); }
        return;
      }
      if (action === "user") { selectedUserId = id; render.toTop = true; await load({ silent: true }); return; }
      if (action === "user-close") { selectedUserId = null; selectedUser = null; await load({ silent: true }); return; }
      if (action === "users-more") { users.offset = users.rows.length; await load({ silent: true }); return; }
      if (action === "server") { selectedServerId = id; await load({ silent: true }); return; }
      if (action === "server-close") { selectedServerId = null; selectedServer = null; await load({ silent: true }); return; }
      if (action === "reports-filter") { reportStatus = id; await load({ silent: true }); return; }
      if (action === "uploads-filter") { uploadsFilter = id; render.scrollTop = previousScroll; render(); return; }
      if (action === "user-badges-save") {
        const picks = [...root().querySelectorAll("[data-badge-pick]:checked")].map((input) => input.value);
        await call("user/badges", { user_id: selectedUserId, badges: picks });
      }
      if (action === "badge-sync") { await call("badge/sync", { user_id: selectedUserId }); await openUser(selectedUserId); }
      if (action === "user-suspend") { await call("user/suspend", { user_id: selectedUserId, enabled: true, reason: root().querySelector("#staff-ban-reason")?.value || "" }); await openUser(selectedUserId); }
      if (action === "user-unsuspend") { await call("user/suspend", { user_id: selectedUserId, enabled: false, reason: root().querySelector("#staff-ban-reason")?.value || "Suspension lifted by staff" }); await openUser(selectedUserId); }
      if (action === "user-note") { await call("user/note", { user_id: selectedUserId, kind: root().querySelector("#staff-note-kind")?.value || "note", body: root().querySelector("#staff-note-body")?.value || "" }); await openUser(selectedUserId); }
      if (action === "staff-grant-user") { await call("staff/set", { user_id: selectedUserId, enabled: true, level: root().querySelector("#staff-level")?.value || "staff" }); await openUser(selectedUserId); }
      if (action === "staff-revoke-user") { await call("staff/set", { user_id: selectedUserId, enabled: false }); await openUser(selectedUserId); }
      if (action === "server-features") { await call("server/features", { server_id: selectedServerId, flag: "INTERNAL_EMPLOYEE_ONLY", enabled: root().querySelector("#staff-internal-employee")?.checked }); await load({ silent: true }); return; }
      if (action === "server-flags") { await call("server/flags", { server_id: selectedServerId, verified: root().querySelector("#staff-verified")?.checked, partner: root().querySelector("#staff-partner")?.checked }); await load({ silent: true }); return; }
      if (action === "server-suspend") { await call("server/suspend", { server_id: selectedServerId, enabled: true, reason: root().querySelector("#staff-server-reason")?.value || "" }); await load({ silent: true }); return; }
      if (action === "server-unsuspend") { await call("server/suspend", { server_id: selectedServerId, enabled: false, reason: "Suspension lifted by staff" }); await load({ silent: true }); return; }
      if (action === "upload-approve") { await rpc("staff_approve_upload", { p_upload_id: id }); await load({ silent: true }); return; }
      if (action === "upload-delete") {
        if (!confirm("Delete this file? This cannot be undone.")) return;
        const removed = await rpc("staff_delete_upload", { p_upload_id: id });
        if (removed?.storage_path && storage?.remove) { try { await storage.remove(removed.storage_path); } catch (err) { console.error("[Constellation staff] could not remove the stored file", err); } }
        await load({ silent: true }); return;
      }
      if (action === "report-save") {
        await call("report/update", { report_id: id, status: root().querySelector(`#report-status-${CSS.escape(id)}`).value, internal_notes: root().querySelector(`#report-note-${CSS.escape(id)}`).value, assignee: user.id });
        await load({ silent: true }); return;
      }
      if (action === "staff-add") { await call("staff/set", { user_id: id, enabled: true, level: "staff" }); staffSearch = []; await load({ silent: true }); return; }
      if (action === "staff-level-save") { await call("staff/set", { user_id: id, enabled: true, level: root().querySelector(`[data-staff-level="${CSS.escape(id)}"]`).value }); await load({ silent: true }); return; }
      if (action === "staff-remove") { await call("staff/set", { user_id: id, enabled: false }); await load({ silent: true }); return; }
      if (action === "badge-edit") { editingBadge = editingBadge === id ? null : id; render.scrollTop = previousScroll; render(); return; }
      if (action === "badge-create") { creating = true; editingBadge = null; render(); document.querySelector(".staff-badge-create")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (action === "badge-cancel") { editingBadge = null; creating = false; render(); return; }
      if (action === "badges-tab") { badgeTab = id === "manual" ? "manual" : "automatic"; editingBadge = null; creating = false; render(); return; }
      if (action === "badge-delete") {
        if (!confirm("Delete this badge and remove it from every account?")) return;
        await call("badge/delete", { id }); badges = await call("badges/list"); setNote("Badge deleted."); return;
      }
      if (action === "import-image") {
        const form = source.closest("form");
        const url = form?.querySelector("[data-import-url]")?.value || "";
        if (form) {
          try { await importIcon(form, url); }
          catch (error) {
            const status = form.querySelector("[data-icon-status]");
            if (status) status.textContent = error.message;
            setNote(error.message);
          }
        }
        return;
      }
      if (action === "clean-image") {
        const form = source.closest("form");
        if (form) {
          try { await cleanCurrentIcon(form); }
          catch (error) {
            const status = form.querySelector("[data-icon-status]");
            if (status) status.textContent = error.message;
            setNote(error.message);
          }
        }
        return;
      }
      if (action === "rule-add") {
        const list = source.closest(".staff-requirements")?.querySelector("[data-rule-list]");
        if (list) { list.insertAdjacentHTML("beforeend", ruleRow({ kind: "server_count", config: { count: 1 } })); }
        return;
      }
      if (action === "rule-remove") { source.closest("[data-rule-row]")?.remove(); return; }
      if (action === "badge-save") {
        const form = source.closest("form");
        if (form) await saveBadge(form);
        return;
      }
      if (action === "user-save-badges") { await load(); return; }
      setNote("Saved.");
      await load({ silent: true });
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-staff-action]");
    if (!trigger || !root()?.contains(trigger)) return;
    event.preventDefault();
    const action = trigger.dataset.staffAction;
    if (action === "badge-save") {
      const form = trigger.closest("form");
      if (form) { event.preventDefault(); busy = true; saveBadge(form).catch(fail).finally(() => { busy = false; }); }
      return;
    }
    act(action, trigger.dataset.id, trigger);
  });

  document.addEventListener("submit", async (event) => {
    const badgeForm = event.target.closest('[data-staff-form="badge"]');
    if (badgeForm && root()?.contains(badgeForm)) {
      event.preventDefault();
      if (busy) return;
      busy = true;
      try { await saveBadge(badgeForm); } catch (err) { fail(err); } finally { busy = false; }
      return;
    }
    const form = event.target.closest("[data-staff-search]");
    if (!form || !root()?.contains(form)) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const query = String(data.query || "").trim();
    try {
      if (form.dataset.staffSearch === "users" || form.dataset.staffSearch === "global") {
        page = "users"; users = { rows: [], total: 0, offset: 0, query }; selectedUserId = null; selectedUser = null;
        render.toTop = true;
        await load();
        return;
      }
      if (form.dataset.staffSearch === "servers") { servers.query = query; selectedServerId = null; selectedServer = null; await load(); return; }
      if (form.dataset.staffSearch === "staff") {
        const result = await call("users/search", { query, limit: 8, offset: 0 });
        staffSearch = result.rows || [];
        render();
        return;
      }
      if (form.dataset.staffSearch === "audit") { auditQuery = query; auditRows = await call("audit", { query }); render(); return; }
    } catch (err) { fail(err); }
  });

  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-badge-icon]");
    if (!input) return;
    event.preventDefault();
    uploadIcon(input);
  });

  document.addEventListener("change", (event) => {
    const kind = event.target.closest("[data-rule-kind]");
    if (!kind) return;
    const row = kind.closest("[data-rule-row]");
    const value = row?.querySelector("[data-rule-value]");
    if (!value) return;
    const type = kind.value;
    const enabled = COUNT_KINDS.has(type) || type === "created_before" || type === "hypesquad";
    value.disabled = !enabled;
    value.placeholder = type === "hypesquad" ? "bravery / brilliance / balance" : type === "created_before" ? "YYYY-MM-DD" : COUNT_KINDS.has(type) ? "Minimum" : "No value";
    if (!enabled) value.value = "";
    if (type === "hypesquad" && !["bravery", "brilliance", "balance"].includes(value.value)) value.value = "bravery";
  });

  window.renderStaffPage = (params) => {
    rpc = params.rpc;
    user = params.user;
    storage = params.storage || storage;
    imageApi = params.imageApi || imageApi;
    imageKey = params.imageKey || imageKey;
    getToken = params.getToken || getToken;
    if (loadedFor === user?.id && root()?.querySelector(".staff-shell")) return;
    if (loadedFor !== user?.id) {
      loadedFor = user?.id; page = "dashboard"; dashboardData = null; users = { rows: [], total: 0, offset: 0, query: "" };
      selectedUserId = selectedUser = selectedServerId = selectedServer = null; badges = []; editingBadge = null; creating = false;
    }
    render();
    load();
  };
})();
