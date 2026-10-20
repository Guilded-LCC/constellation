(() => {
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);
  const nav = [
    ["dashboard", "Dashboard"],
    ["users", "Users"],
    ["servers", "Servers"],
    ["reports", "Reports"],
    ["uploads", "Uploads"],
    ["badges", "Badges"],
    ["staff", "Staff"],
    ["audit", "Audit log"],
  ];
  let rpc, user, loadedFor = null, page = "dashboard", data = null, badgeOptions = [], selectedUser = null, selectedUserId = null, selectedServer = null, staffSearchResults = [], query = "", status = "open", busy = false, loadError = "";
  const root = () => document.querySelector("#app");
  const call = (action, payload = {}) => rpc("staff_action", { p_action: action, p_payload: payload });
  const errorText = (error) => {
    console.error("[Constellation staff]", error);
    const text = error?.message || "The request could not be completed.";
    if (/not found/i.test(text)) return "This staff page is unavailable.";
    if (/permission|not authorized/i.test(text)) return "Your staff role does not allow this action.";
    if (/a reason is required|add a reason|enter a reason/i.test(text)) return "Enter a reason before applying this action.";
    return "Could not save those changes. Please try again.";
  };
  const button = (action, label, extra = "") => `<button class="staff-button ${extra}" data-staff-action="${action}">${esc(label)}</button>`;
  const record = (title, meta, action, id, label = "View") => `<article class="staff-record"><div><strong>${esc(title || "Unknown")}</strong><small>${esc(meta || "")}</small></div><button class="staff-button" data-staff-action="${action}" data-id="${esc(id)}">${esc(label)}</button></article>`;
  const label = (text) => `<label class="staff-label">${esc(text)}</label>`;
  function shell(body, note = "") {
    root().innerHTML = `<main class="staff-shell"><header class="staff-header"><div class="staff-brand"><span class="staff-symbol">C</span><div><strong>Constellation Staff</strong><small>Trust &amp; safety workspace</small></div></div><span class="staff-identity">${esc(user?.name || user?.username || "Staff")} <i>${user?.is_platform_admin ? "Platform admin" : "Staff"}</i></span><a class="staff-return" href="/">Back to Constellation</a></header><div class="staff-accent"></div><div class="staff-layout"><aside class="staff-nav"><p>WORKSPACE</p>${nav.map(([key, name]) => `<button class="${page === key ? "active" : ""}" data-staff-action="nav" data-page="${key}">${esc(name)}</button>`).join("")}<div class="staff-nav-bottom">Restricted to platform staff<br>Every change is audited.</div></aside><section class="staff-content"><div class="staff-page-head"><div><span>CONSTELLATION / ${esc(page.toUpperCase())}</span><h1>${esc(nav.find(([key]) => key === page)?.[1] || "Staff")}</h1></div>${button("refresh", "Refresh", "subtle")}</div>${note ? `<div class="staff-alert">${esc(note)}</div>` : ""}${body}<div class="staff-error" role="status"></div></section></div></main>`;
  }
  function stat(title, value, detail = "") { return `<article class="staff-stat"><span>${esc(title)}</span><strong>${esc(value ?? "—")}</strong><small>${esc(detail)}</small></article>`; }
  function dashboard() {
    if (!data) return `<p class="staff-empty">${loadError ? "Dashboard counts are unavailable." : "Loading live dashboard counts…"}</p>`;
    const d = data;
    return `<div class="staff-stats">${stat("Users", d.users)}${stat("Servers", d.servers)}${stat("Messages today", d.messages_today)}${stat("Open reports", d.open_reports)}${stat("Suspended accounts", d.suspended)}${stat("Signups · 7 days", d.signups_7d)}</div><section class="staff-section"><h2>Recent staff activity</h2>${(d.activity || []).length ? d.activity.map((item) => `<article class="staff-audit-row"><strong>${esc(item.action)}</strong><span>${esc(item.target_type)} ${esc(item.target_id)}</span><small>${esc(item.reason || "No reason supplied")} · ${new Date(item.created_at).toLocaleString()}</small></article>`).join("") : `<p class="staff-empty">No staff activity yet.</p>`}</section>`;
  }
  function searchBox(placeholder, kind) { return `<form class="staff-search" data-staff-search="${kind}"><input name="query" value="${esc(query)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"><button class="staff-button" type="submit">Search</button></form>`; }
  function users() {
    const rows = data || [];
    const selected = selectedUser;
    return `${searchBox("Search username or email", "users")}${rows.length ? `<div class="staff-records staff-user-results">${rows.map((item) => record(item.name || item.username, `${item.email} · joined ${new Date(item.created_at).toLocaleDateString()}${item.suspended ? " · suspended" : ""}`, "user", item.id)).join("")}</div>` : `<p class="staff-empty">Search for a user to review their account.</p>`}${selected ? `<section class="staff-detail"><div class="staff-detail-head"><div><h2>${esc(selected.profile?.name || selected.profile?.username || "User")}</h2><p>@${esc(selected.profile?.username || "unknown")} · ${esc(selected.email)} · joined ${selected.created_at ? new Date(selected.created_at).toLocaleDateString() : "date unavailable"}</p>${selected.profile?.bio ? `<p>${esc(selected.profile.bio)}</p>` : ""}</div><div class="staff-inline">${selected.suspension ? `<span class="staff-tag danger">Suspended</span>` : `<span class="staff-tag">Active</span>`}${button("user-close", "Back to users", "subtle")}</div></div><div class="staff-detail-grid"><div><h3>Badges</h3><div class="staff-chip-list">${(selected.badges || []).map((badge) => `<span class="staff-tag">${esc(badge)}${badge !== "staff" ? `<button aria-label="Revoke ${esc(badge)}" data-staff-action="badge-revoke" data-id="${esc(badge)}">×</button>` : ""}</span>`).join("") || `<span class="staff-empty">No badges</span>`}</div><div class="staff-inline"><select id="staff-badge-select">${badgeOptions.map((badge) => `<option value="${esc(badge.id)}">${esc(badge.name)}</option>`).join("")}</select>${button("badge-grant", "Grant badge")}</div><h3>Servers</h3>${(selected.servers || []).map((server) => `<p class="staff-line">${esc(server.name)} <small>· ${server.owner ? "Owner" : "Member"}${server.created_at ? ` · ${new Date(server.created_at).toLocaleDateString()}` : ""}</small></p>`).join("") || `<p class="staff-empty">No servers</p>`}</div><div><h3>Moderation</h3>${selected.suspension ? `<p class="staff-reason">${esc(selected.suspension.reason)}</p>${button("user-unsuspend", "Lift suspension", "subtle")}` : `${label("Reason for suspension")}<textarea id="staff-user-reason" maxlength="1000" placeholder="Required; visible to the affected user"></textarea>${button("user-suspend", "Suspend account", "danger")}` }<p class="staff-line">${Number(selected.reports) || 0} related report(s)</p>${(selected.reportItems || []).map((report) => `<p class="staff-line">${esc(report.reason)} <small>· ${esc(report.status)} · ${new Date(report.created_at).toLocaleDateString()}</small></p>`).join("")}${user?.is_platform_admin ? `<h3>Platform staff</h3><div class="staff-inline"><select id="staff-level"><option value="staff" ${selected.staff_level === "staff" ? "selected" : ""}>Staff</option><option value="admin" ${selected.staff_level === "admin" ? "selected" : ""}>Admin</option></select>${button(selected.is_staff ? "staff-revoke-user" : "staff-grant-user", selected.is_staff ? "Remove staff" : "Add staff")}</div>` : ""}</div></div></section>` : ""}`;
  }
  async function openUser(id) {
    selectedUserId = id;
    const [detail, serverRows, reportRows] = await Promise.all([
      call("user/get", { user_id: id }),
      call("servers/search", { query: "" }),
      call("reports", { status: null }),
    ]);
    if (!detail) throw new Error("The user detail was not returned.");
    const memberships = Array.isArray(detail.servers) ? detail.servers : [];
    const owned = (Array.isArray(serverRows) ? serverRows : [])
      .filter((server) => server.owner?.id === id)
      .map((server) => ({ ...server, owner: true }));
    detail.profile = detail.profile || {};
    detail.servers = [...new Map([...memberships, ...owned].map((server) => [server.id, server])).values()];
    detail.reportItems = (Array.isArray(reportRows) ? reportRows : []).filter((report) => report.target_user === id);
    selectedUser = detail;
  }
  function servers() {
    const rows = data || [];
    return `${searchBox("Search servers", "servers")}${rows.length ? `<div class="staff-records">${rows.map((item) => record(item.name, `${item.owner?.name || item.owner?.username || "Unknown owner"} · ${item.members} members · ${new Date(item.created_at).toLocaleDateString()}${item.suspended ? " · suspended" : ""}`, "server", item.id)).join("")}</div>` : `<p class="staff-empty">Search for a server to review its settings.</p>`}${selectedServer ? `<section class="staff-detail"><div class="staff-detail-head"><div><h2>${esc(selectedServer.server?.name)}</h2><p>Owner: ${esc(selectedServer.owner?.name || selectedServer.owner?.username)} · ${selectedServer.members} members</p></div>${selectedServer.suspended ? `<span class="staff-tag danger">Suspended</span>` : ""}</div><p class="staff-line">${esc(selectedServer.server?.description || "No description")}</p><div class="staff-flags"><label><input type="checkbox" id="staff-verified" ${selectedServer.server?.verified ? "checked" : ""}> Verified</label><label><input type="checkbox" id="staff-partner" ${selectedServer.server?.partner ? "checked" : ""}> Partner</label>${button("server-flags", "Save flags")}</div>${selectedServer.suspension ? `<p class="staff-reason">${esc(selectedServer.suspension.reason)}</p>${button("server-unsuspend", "Lift suspension", "subtle")}` : `${label("Reason for server suspension")}<textarea id="staff-server-reason" maxlength="1000"></textarea>${button("server-suspend", "Suspend server", "danger")}`}<h3>Channels</h3><div class="staff-chip-list">${(selectedServer.channels || []).map((channel) => `<span class="staff-tag"># ${esc(channel.name)} · ${esc(channel.type)}</span>`).join("") || "No channels"}</div><p class="staff-note">Message content is not visible in server details. It is shown only when attached to a report.</p></section>` : ""}`;
  }
  function reports() {
    const rows = data || [];
    return `<div class="staff-filter"><label>Status<select id="staff-report-status">${["open", "reviewing", "resolved", "dismissed", "all"].map((x) => `<option ${status === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>${button("reports-load", "Apply")}</div>${rows.length ? rows.map((r) => `<article class="staff-report"><div class="staff-report-title"><strong>${esc(r.reason)}</strong><span class="staff-tag">${esc(r.status)}</span></div><p>Reported by ${esc(r.reporter_profile?.name || r.reporter_profile?.username || "Member")} · ${new Date(r.created_at).toLocaleString()}</p>${r.target_profile ? `<p>Target: ${esc(r.target_profile.name || r.target_profile.username)}</p>` : ""}${r.message ? `<blockquote>${esc(r.message.body)}<small>Message ${esc(r.message.id)} · channel ${esc(r.message.channel_id)}</small></blockquote><a class="staff-context-link" href="/?server=${encodeURIComponent(r.message.server_id)}&channel=${encodeURIComponent(r.message.channel_id)}">Open reported channel</a>` : ""}<div class="staff-inline"><select id="report-status-${r.id}">${["open", "reviewing", "resolved", "dismissed"].map((x) => `<option ${r.status === x ? "selected" : ""}>${x}</option>`).join("")}</select><input id="report-note-${r.id}" placeholder="Internal notes" value="${esc(r.internal_notes)}"><button class="staff-button" data-staff-action="report-save" data-id="${esc(r.id)}">Save review</button></div></article>`).join("") : `<p class="staff-empty">No reports in this queue.</p>`}`;
  }
  function badges() {
    const rows = data || [];
    return `<form class="staff-badge-form" data-staff-search="badge-save"><input name="id" placeholder="badge-id" maxlength="40" required><input name="name" placeholder="Badge name" maxlength="60" required><input name="icon_url" placeholder="Icon URL (optional)"><button class="staff-button" type="submit">Create badge</button></form><div class="staff-records">${rows.map((item, i) => `<article class="staff-record"><div class="staff-badge-preview">${item.icon_url ? `<img src="${esc(item.icon_url)}" alt="">` : "◈"}<small>${esc(item.id)}</small></div><form class="staff-badge-form" data-staff-search="badge-save"><input name="id" type="hidden" value="${esc(item.id)}"><input name="name" maxlength="60" required value="${esc(item.name)}"><input name="icon_url" placeholder="Icon URL" value="${esc(item.icon_url || "")}"><button class="staff-button" type="submit">Save</button></form><div class="staff-inline"><button class="staff-button subtle" data-staff-action="badge-move" data-id="${esc(item.id)}" data-dir="-1" ${i === 0 ? "disabled" : ""}>↑</button><button class="staff-button subtle" data-staff-action="badge-move" data-id="${esc(item.id)}" data-dir="1" ${i === rows.length - 1 ? "disabled" : ""}>↓</button>${["staff", "verified", "early-supporter"].includes(item.id) ? "" : `<button class="staff-button danger" data-staff-action="badge-delete" data-id="${esc(item.id)}">Delete</button>`}</div></article>`).join("")}</div>`;
  }
  function staff() {
    const rows = data || [];
    return `${searchBox("Find a user to add to platform staff", "staff-search")}${staffSearchResults.map((item) => record(item.name || item.username, item.email, "staff-add", item.id, "Add staff")).join("")}<div class="staff-records">${rows.map((item) => `<article class="staff-record"><div><strong>${esc(item.profile?.name || item.profile?.username)}</strong><small>${esc(item.user_id)} · added ${new Date(item.added_at).toLocaleDateString()}</small></div><div class="staff-inline"><select data-staff-level="${esc(item.user_id)}"><option value="staff" ${item.level === "staff" ? "selected" : ""}>Staff</option><option value="admin" ${item.level === "admin" ? "selected" : ""}>Admin</option></select><button class="staff-button" data-staff-action="staff-level-save" data-id="${esc(item.user_id)}">Save</button><button class="staff-button danger" data-staff-action="staff-remove" data-id="${esc(item.user_id)}">Remove</button></div></article>`).join("") || `<p class="staff-empty">No platform staff configured.</p>`}</div>`;
  }
  function uploads() {
    const rows = (data || []).filter(r => r.status === 'pending');
    return `${rows.length ? rows.map((r) => `<article class="staff-report"><div class="staff-report-title"><strong>${esc(r.file_name)}</strong><span class="staff-tag">${Math.round(r.byte_size/1024)}KB</span></div><p>Uploaded by ${esc(r.user?.name || r.user?.username)} · ${new Date(r.created_at).toLocaleString()}</p><div class="staff-inline">${button("upload-approve", "Approve", "subtle")}${button("upload-delete", "Delete", "danger")}</div></article>`).join("") : `<p class="staff-empty">No pending user uploads found.</p>`}`;
  }

  function audit() {
    const rows = data || [];
    return `${searchBox("Filter by action", "audit")}${rows.map((item) => `<article class="staff-audit-row"><strong>${esc(item.action)}</strong><span>${esc(item.target_type)} ${esc(item.target_id)}</span><small>${esc(item.reason || "No reason supplied")} · ${new Date(item.created_at).toLocaleString()}</small></article>`).join("") || `<p class="staff-empty">No matching audit records.</p>`}`;
  }
  async function load() {
    if (busy) return;
    busy = true;
    try {
      if (page === "dashboard") data = await call("dashboard");
      if (page === "users") { data = await call("users/search", { query }); badgeOptions = await call("badges/list"); }
      if (page === "servers") data = await call("servers/search", { query });
      if (page === "reports") data = await call("reports", { status: status === "all" ? null : status });
      if (page === "uploads") data = await rpc("staff_list_uploads");
      if (page === "badges") data = await call("badges/list");
      if (page === "staff") data = await call("staff/list");
      if (page === "audit") data = await call("audit", { query });
      if (page === "users" && selectedUserId) await openUser(selectedUserId);
      if (page === "servers" && selectedServer?.server?.id) selectedServer = await call("server/get", { server_id: selectedServer.server.id });
      loadError = "";
    } catch (error) {
      data = null;
      loadError = errorText(error);
    } finally { busy = false; }
    render();
  }
  function render(note = "") {
    const body = page === "dashboard" ? dashboard() : page === "users" ? users() : page === "servers" ? servers() : page === "reports" ? reports() : page === "uploads" ? uploads() : page === "badges" ? badges() : page === "staff" ? staff() : audit();
    shell(body, note || loadError);
  }
  function fail(error) {
    const el = root().querySelector(".staff-error");
    if (el) el.textContent = errorText(error);
    else render(errorText(error));
  }
  async function act(action, id, buttonEl) {
    try {
      if (action === "nav") { page = buttonEl.dataset.page; data = null; selectedUser = selectedServer = null; selectedUserId = null; staffSearchResults = []; await load(); return; }
      if (action === "refresh") { await load(); return; }
      if (action === "user") { await openUser(id); render(); return; }
      if (action === "user-close") { selectedUser = null; selectedUserId = null; render(); return; }
      if (action === "server") { selectedServer = await call("server/get", { server_id: id }); render(); return; }
      if (action === "badge-grant") await call("user/badge", { user_id: selectedUserId, badge: root().querySelector("#staff-badge-select").value, enabled: true });
      if (action === "badge-revoke") await call("user/badge", { user_id: selectedUserId, badge: id, enabled: false });
      if (action === "user-suspend") await call("user/suspend", { user_id: selectedUserId, enabled: true, reason: root().querySelector("#staff-user-reason").value });
      if (action === "user-unsuspend") await call("user/suspend", { user_id: selectedUserId, enabled: false, reason: "User suspension lifted by staff" });
      if (action === "staff-grant-user") await call("staff/set", { user_id: selectedUserId, enabled: true, level: root().querySelector("#staff-level").value });
      if (action === "staff-revoke-user") await call("staff/set", { user_id: selectedUserId, enabled: false });
      if (action === "server-flags") await call("server/flags", { server_id: selectedServer.server.id, verified: root().querySelector("#staff-verified").checked, partner: root().querySelector("#staff-partner").checked });
      if (action === "server-suspend") await call("server/suspend", { server_id: selectedServer.server.id, enabled: true, reason: root().querySelector("#staff-server-reason").value });
      if (action === "server-unsuspend") await call("server/suspend", { server_id: selectedServer.server.id, enabled: false, reason: "Server suspension lifted by staff" });
      if (action === "upload-approve") await rpc("staff_approve_upload", { p_upload_id: id });
      if (action === "upload-delete") await rpc("staff_delete_upload", { p_upload_id: id });
      if (action === "reports-load") { status = root().querySelector("#staff-report-status").value; }
      if (action === "report-save") await call("report/update", { report_id: id, status: root().querySelector(`#report-status-${CSS.escape(id)}`).value, internal_notes: root().querySelector(`#report-note-${CSS.escape(id)}`).value, assignee: user.id });
      if (action === "badge-delete") await call("badge/delete", { id });
      if (action === "badge-move") {
        const rows = [...(data || [])], index = rows.findIndex((x) => x.id === id), to = index + Number(buttonEl.dataset.dir);
        if (to >= 0 && to < rows.length) { [rows[index], rows[to]] = [rows[to], rows[index]]; await Promise.all(rows.map((x, i) => call("badge/save", { ...x, position: i }))); }
      }
      if (action === "staff-add") await call("staff/set", { user_id: id, enabled: true, level: "staff" });
      if (action === "staff-level-save") await call("staff/set", { user_id: id, enabled: true, level: root().querySelector(`[data-staff-level="${CSS.escape(id)}"]`).value });
      if (action === "staff-remove") await call("staff/set", { user_id: id, enabled: false });
      if (action === "reports-load") status = root().querySelector("#staff-report-status").value;
      await load();
    } catch (error) { fail(error); }
  }
  document.addEventListener("click", (event) => {
    const buttonEl = event.target.closest("[data-staff-action]");
    if (!buttonEl || !root()?.contains(buttonEl)) return;
    event.preventDefault();
    const action = buttonEl.dataset.staffAction;
    if (action === "staff-add") act(action, buttonEl.dataset.id, buttonEl);
    else act(action, buttonEl.dataset.id, buttonEl);
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-staff-search]");
    if (!form || !root()?.contains(form)) return;
    event.preventDefault();
    const action = form.dataset.staffSearch, fields = Object.fromEntries(new FormData(form));
    try {
      if (action === "badge-save") { await call("badge/save", fields); data = await call("badges/list"); }
      else if (action === "staff-search") { query = fields.query || ""; staffSearchResults = await call("users/search", { query }); }
      else if (action === "audit") { query = fields.query || ""; data = await call("audit", { query }); }
      else { query = fields.query || ""; data = await call(`${action}/search`, { query }); }
      render();
    } catch (error) { fail(error); }
  });
  window.renderStaffPage = (params) => {
    rpc = params.rpc;
    user = params.user;
    if (loadedFor === user?.id && root()?.querySelector(".staff-shell")) return;
    if (loadedFor !== user?.id) { loadedFor = user?.id; page = "dashboard"; data = null; }
    render();
    load();
  };
})();
