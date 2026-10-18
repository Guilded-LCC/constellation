(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const paths = {
    plus: "M12 5v14M5 12h14",
    chevron: "m6 9 6 6 6-6",
    hash: "M4 9h16M4 15h16M11 3 7 21M17 3l-4 18",
    home: "M3 10 12 3l9 7v10H3V10ZM9 20v-7h6v7",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    settings:
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .34 1.87l-1.87 1.87A1.7 1.7 0 0 0 16 18.4a1.7 1.7 0 0 0-1 .92V22h-6v-2.68a1.7 1.7 0 0 0-1-.92 1.7 1.7 0 0 0-1.87.34l-1.87-1.87A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.92-1H1v-4h2.68a1.7 1.7 0 0 0 .92-1 1.7 1.7 0 0 0-.34-1.87l1.87-1.87A1.7 1.7 0 0 0 8 5.6a1.7 1.7 0 0 0 1-.92V2h6v2.68a1.7 1.7 0 0 0 1 .92 1.7 1.7 0 0 0 1.87-.34l1.87 1.87A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .92 1H23v4h-2.68a1.7 1.7 0 0 0-.92 1Z",
    search: "m21 21-4.4-4.4M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
    pin: "m16 3 5 5-3 1-2 4-2 2-4 2-1 3-5-5 3-1 2-4 2-2 4-2 1-3ZM2 22l6-6",
    lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
    send: "m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2",
    smile:
      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M8.5 9h.01M15.5 9h.01",
    close: "M18 6 6 18M6 6l12 12",
    menu: "M4 7h16M4 12h16M4 17h16",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    invite:
      "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6",
    chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.9L3 21l1.9-5.7A9 9 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z",
    audit: "M5 3h14v18H5zM9 8h6M9 12h6M9 16h4",
    edit: "M12 20h9M16 4l4 4L9 19l-5 1 1-5L16 4Z",
    trash: "M4 7h16M10 11v7M14 11v7M6 7l1 14h10l1-14M9 7V4h6v3",
    arrow: "M12 5v14m-6-6 6 6 6-6",
    calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16",
    paperclip:
      "M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5",
    mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8",
    headphones:
      "M4 13v-2a8 8 0 0 1 16 0v2M4 13h4v8H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 1-2ZM20 13h-4v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-1-2Z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    up: "m6 15 6-6 6 6",
    down: "m6 9 6 6 6-6",
    image: "M3 3h18v18H3zM7.5 8h.01M3 17l5-5 4 4 3-3 6 6",
    logout: "M10 17l5-5-5-5M15 12H3M13 3h7v18h-7",
    copy: "M9 9h12v12H9zM5 17H3V3h14v2",
    shield: "M12 2 3 6v5c0 5 3.4 8.5 9 11 5.6-2.5 9-6 9-11V6l-9-4Z",
    check: "m4 12 5 5L20 6",
  };
  const icon = (name, size = "") =>
    `<svg class="i ${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.hash}"/></svg>`;
  const config = window.CONSTELLATION_CONFIG || {};
  // Supabase owns the short-lived auth session; application data is never stored locally.
  const supabase =
    config.supabaseUrl &&
    config.supabasePublishableKey &&
    window.supabase?.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  const modal = $("#modal");
  let state = null,
    sid = null,
    cid = null,
    dm = null,
    page = "home",
    messages = [],
    featureState = {},
    pendingAttachments = [],
    attachmentURLs = {},
    search = "",
    pins = false,
    selectedRole = null,
    roleDraft = null,
    settingsTab = "overview",
    editingChannel = null,
    editingCategory = null,
    collapsed = {},
    preferencesLoaded = false,
    membersVisible = true,
    pollBusy = false,
    pendingRender = false,
    registration = false,
    contextTarget = null,
    lastMessageKey = "";
  function safeMedia(value) {
    const u = String(value || "");
    const prefix =
      config.supabaseUrl + "/storage/v1/object/public/community-media/";
    return u.startsWith(prefix) &&
      /^[A-Za-z0-9/_\.%-]+$/.test(u.slice(prefix.length))
      ? escapeHtml(u)
      : "";
  }
  function current() {
    return state?.servers?.find((server) => server.id === sid);
  }
  function normalizeState(data) {
    const array = (value) =>
      Array.isArray(value)
        ? value.filter((item) => item && typeof item === "object")
        : [];
    const strings = (value) =>
      Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
    const user = (value) => ({
      ...value,
      name: value?.name || value?.username || "Member",
      username: value?.username || "member",
      status: value?.status || "online",
      roles: strings(value?.roles),
    });
    return {
      ...data,
      user: user(data?.user),
      contacts: array(data?.contacts).map(user),
      servers: array(data?.servers).map((server) => ({
        ...server,
        name: server.name || "Server",
        permissions: strings(server.permissions),
        roles: array(server.roles).map((role) => ({
          ...role,
          name: role.position === 0 ? "Member" : role.name || "Role",
          permissions: strings(role.permissions),
        })),
        members: array(server.members).map(user),
        channels: array(server.channels),
        categories: array(server.categories),
        bans: array(server.bans).map(user),
        audit: array(server.audit),
        announcements: array(server.announcements),
      })),
    };
  }
  function can(permission) {
    const s = current(),
      me = state?.user;
    return !!(
      s &&
      me &&
      (s.owner === me.id ||
        s.permissions?.includes("administrator") ||
        s.permissions?.includes(permission))
    );
  }
  function topRole(member) {
    return current()?.roles?.find((role) => member?.roles?.includes(role.id));
  }
  function person(id) {
    return (
      current()?.members?.find((member) => member.id === id) ||
      state?.contacts?.find((member) => member.id === id) ||
      (state?.user?.id === id ? state.user : null) ||
      (dm?.id === id ? dm : null) || { name: "Former member", avatar: "" }
    );
  }
  function avatar(personData, extra = "") {
    const image = safeMedia(personData?.avatar_url);
    const label = escapeHtml(
      (personData?.name || personData?.username || "U")
        .slice(0, 1)
        .toUpperCase(),
    );
    return `<span class="avatar ${extra}">${image ? `<img src="${image}" alt="">` : label}</span>`;
  }
  function roleIcon(role) {
    const src = safeMedia(role?.icon_url);
    return src
      ? `<img class="role-icon" src="${src}" alt="${escapeHtml(role.name)} role icon">`
      : role?.emoji
        ? `<span class="role-emote" title="${escapeHtml(role.name)}">${escapeHtml(role.emoji)}</span>`
        : "";
  }
  function roleColor(role) {
    return /^#[0-9a-fA-F]{6}$/.test(role?.color || "") ? role.color : "#c8cbd2";
  }
  function roleTextStyle(role) {
    const color = roleColor(role),
      second = role?.color2,
      angle = Math.max(0, Math.min(360, Number(role?.gradient_angle ?? 90)));
    if (/^#[0-9a-fA-F]{6}$/.test(second || ""))
      return `background:linear-gradient(${angle}deg,${color},${second});background-clip:text;-webkit-background-clip:text;color:transparent`;
    return `color:${color}`;
  }
  function errText(error) {
    const raw = error?.message || String(error);
    console.error("[Constellation]", error);
    if (error?.code === "23505")
      return "That name is already in use. Please choose another.";
    if (error?.code === "23514")
      return "Please check the values and try again.";
    if (/foreign key|profiles|owner/i.test(raw))
      return "Your account profile is syncing. Please try again.";
    if (
      /not authorized|permission|not permitted|row.level security/i.test(raw) ||
      error?.code === "42501"
    )
      return "You do not have permission to do that.";
    if (/network|fetch|connection/i.test(raw))
      return "The connection was interrupted. Please try again.";
    if (/constraint|syntax|relation|schema cache|column .*not exist/i.test(raw))
      return "Something could not be saved. Please try again.";
    return raw;
  }
  async function rpc(name, args = {}) {
    if (!supabase) throw Error("Connection unavailable");
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async function api(action, payload = {}) {
    return rpc("app_api", { p_action: action, p_payload: payload });
  }
  const featureApi = (action, payload = {}) =>
    rpc("app_feature_api", { p_action: action, p_payload: payload });
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.style.display = "block";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (el.style.display = "none"), 3500);
  }
  function field(id, label, value = "", type = "text") {
    return `<label for="${id}">${escapeHtml(label)}</label><input id="${id}" type="${type}" value="${escapeHtml(value)}">`;
  }
  function value(id) {
    return $("#" + id)?.value ?? "";
  }
  function checked(id) {
    return !!$("#" + id)?.checked;
  }
  function show(title, body, foot = "", settings = false) {
    modal.className = settings ? "settings-dialog" : "";
    modal.innerHTML = `<div class="modalhead"><h2>${escapeHtml(title)}</h2><button class="icon-button" data-action="close" aria-label="Close">${icon("close")}</button></div><div class="modalbody">${body}<div class="error" id="modalerror"></div></div>${foot ? `<div class="modalfoot">${foot}</div>` : ""}${settings ? `<button class="settings-close icon-button" data-action="close" aria-label="Close settings">${icon("close")}</button>` : ""}`;
    if (!modal.open) modal.showModal();
  }
  function closeModal() {
    modal.close();
    modal.className = "";
    if (pendingRender && state) {
      pendingRender = false;
      render();
    }
  }
  function showError(error) {
    const el = $("#modalerror");
    if (modal.open && el) el.textContent = errText(error);
    else toast(errText(error));
  }
  function renderAuth() {
    if (!supabase) {
      $("#app").innerHTML =
        '<div class="auth"><div class="auth-shell"><div class="authcard"><h1>Connection unavailable</h1><p>Check the site configuration and reload.</p></div></div></div>';
      return;
    }
    $("#app").innerHTML =
      `<div class="auth"><div class="auth-shell"><div class="auth-brand"><span class="mark">G</span>Constellation</div><form class="authcard" id="auth-form"><h1>${registration ? "Create an account" : "Welcome back"}</h1><p>${registration ? "Choose your name and join the conversation." : "Sign in to your account to continue."}</p>${field("email", "Email address", "", "email")}${registration ? field("username", "Username") : ""}${registration ? field("displayname", "Display name") : ""}${field("password", registration ? "Password · at least 10 characters" : "Password", "", "password")}<button class="primary" type="submit">${registration ? "Create account" : "Sign in"}</button><div class="error" id="autherror"></div><div class="switch">${registration ? "Already have an account?" : "New to Constellation?"} <button type="button" data-action="auth-switch">${registration ? "Sign in" : "Create an account"}</button></div></form></div></div>`;
    $("#auth-form").autocomplete = "off";
    $("#email").autocomplete = "off";
    $("#email").required = true;
    $("#password").autocomplete = "off";
    $("#password").required = true;
    if (registration) {
      $("#password").minLength = 10;
      $("#username").required = true;
      $("#username").pattern = "[a-zA-Z0-9_.-]{3,32}";
    }
  }
  async function refresh(renderAll = true) {
    await rpc("ensure_profile");
    state = normalizeState(await rpc("app_state"));
    state = state || {
      user: { name: "Member", username: "member", status: "online" },
      servers: [],
      contacts: [],
    };
    state.user = state.user || {
      name: "Member",
      username: "member",
      status: "online",
    };
    state.user.status = state.user.status || "online";
    if (!preferencesLoaded) {
      const preferences = await rpc("app_ui_state", { p_data: null });
      collapsed = Object.fromEntries(
        (preferences?.collapsed || []).map((id) => [id, true]),
      );
      preferencesLoaded = true;
    }
    if (sid && !current()) {
      sid = null;
      cid = null;
      page = "home";
    }
    if (!sid && state.servers?.length && !dm) {
      sid = state.servers[0].id;
      page = "overview";
    }
    if (renderAll) render();
    if (page === "chat") await loadMessages();
  }
  function rail() {
    return `<nav class="rail" aria-label="Servers"><button class="orb brand ${!sid ? "active" : ""}" data-action="home" title="Home">G</button><div class="divider"></div>${state.servers.map((server) => `<button class="orb ${server.id === sid ? "active" : ""}" data-action="server" data-id="${server.id}" title="${escapeHtml(server.name)}">${safeMedia(server.avatar_url) ? `<img src="${safeMedia(server.avatar_url)}" alt="">` : escapeHtml((server.name || "S")[0].toUpperCase())}</button>`).join("")}<button class="orb" data-action="create-server" title="Create server">${icon("plus", "lg")}</button><button class="orb rail-bottom" data-action="profile" title="Your profile">${avatar(state.user)}</button></nav>`;
  }
  function serverHeader(server) {
    if (!server)
      return `<header class="serverhead"><button data-action="home"><span class="server-avatar">G</span><span class="server-title">Direct messages<small>Your conversations</small></span></button></header>`;
    const banner = safeMedia(server.banner_url);
    return `<header class="serverhead ${banner ? "has-banner" : ""}" ${banner ? `style="background-image:url('${banner}')"` : ""}><button data-action="server-menu"><span class="server-avatar">${safeMedia(server.avatar_url) ? `<img src="${safeMedia(server.avatar_url)}" alt="">` : escapeHtml(server.name[0].toUpperCase())}</span><span class="server-title">${escapeHtml(server.name)}<small>Server home</small></span>${icon("chevron")}</button></header>`;
  }
  function categoryNav(server) {
    const cats = server.categories || [];
    const orphan = server.channels.filter(
      (channel) => !cats.some((cat) => cat.id === channel.category_id),
    );
    const groups = cats.map((cat) => ({
      cat,
      channels: server.channels.filter(
        (channel) => channel.category_id === cat.id,
      ),
    }));
    if (orphan.length)
      groups.push({
        cat: { id: "uncategorized", name: "UNCATEGORIZED", allowed: [] },
        channels: orphan,
      });
    return groups
      .map(
        ({ cat, channels }) =>
          `<div class="cat-head" data-category="${cat.id}" draggable="${can("manage_channels") && cat.id !== "uncategorized"}"><button class="cat-toggle ${collapsed[cat.id] ? "rotated" : ""}" data-action="toggle-category" data-id="${cat.id}">${icon("chevron", "sm")}<span>${escapeHtml(cat.name)}</span></button>${can("manage_channels") && cat.id !== "uncategorized" ? `<span class="cat-actions"><button class="icon-button" data-action="new-channel" data-category="${cat.id}" title="Create channel">${icon("plus", "sm")}</button><button class="icon-button" data-action="edit-category" data-id="${cat.id}" title="Category settings">${icon("settings", "sm")}</button></span>` : ""}</div>${collapsed[cat.id] ? "" : channels.map((channel) => `<div class="channel-wrap" draggable="${can("manage_channels")}" data-channel="${channel.id}"><button class="channel ${cid === channel.id && page === "chat" ? "active" : ""}" data-action="channel" data-id="${channel.id}">${icon(channel.allowed?.length || cat.allowed?.length ? "lock" : channel.type === "VOICE" ? "mic" : "hash", "sm")}<span class="channel-name">${escapeHtml(channel.name)}</span></button></div>`).join("")}`,
      )
      .join("");
  }
  function sidebar() {
    const server = current();
    return `<aside class="sidebar">${serverHeader(server)}<button class="sidebar-search" data-action="quick-switch">${icon("search", "sm")} Search ${escapeHtml(server?.name || "messages")} <span style="margin-left:auto">Ctrl K</span></button><nav class="nav" aria-label="Sections and channels">${server ? `<div class="nav-heading">Sections</div><button class="nav-item ${page === "overview" ? "active" : ""}" data-action="overview">${icon("home", "sm")}<span>Overview</span></button><button class="nav-item" data-action="members-page">${icon("users", "sm")}<span>Members</span></button>${can("manage_server") || can("view_audit") ? `<button class="nav-item ${page === "audit" ? "active" : ""}" data-action="audit-page">${icon("audit", "sm")}<span>Audit log</span></button>` : ""}${state.user?.platform_staff ? `<button class="nav-item" data-action="staff-panel">${icon("shield", "sm")}<span>Staff panel</span></button>` : ""}<div class="nav-heading">Channels ${can("manage_channels") ? `<button data-action="new-category" title="Create category">${icon("plus", "sm")}</button>` : ""}</div>${categoryNav(server)}` : `<div class="nav-heading">Direct messages <button data-action="new-dm" title="New conversation">${icon("plus", "sm")}</button></div>${[...new Map([...(state.contacts || []), ...(dm ? [dm] : [])].map((user) => [user.id, user])).values()].map((user) => `<button class="channel ${dm?.id === user.id ? "active" : ""}" data-action="dm" data-id="${user.id}">${avatar(user)}<span class="channel-name">${escapeHtml(user.name)}</span></button>`).join("")}<button class="channel" data-action="new-dm">${icon("plus", "sm")}<span>New conversation</span></button>`}</nav><footer class="profilebar"><span class="avatar-wrap">${avatar(state.user)}<i class="status-dot ${escapeHtml(state.user.status || "online")}"></i></span><span class="who"><strong>${escapeHtml(state.user.name)}</strong><small>${escapeHtml(state.user.status || "online")}</small></span><button class="icon-button" data-action="profile" title="User settings">${icon("settings")}</button></footer></aside>`;
  }
  function memberList() {
    const server = current();
    if (!server) return '<aside class="members"></aside>';
    const members = (server.members || []).filter(Boolean),
      roles = server.roles || [];
    const groups = new Map();
    for (const member of members) {
      const hoist = roles.find(
          (role) => role.hoist && member.roles?.includes(role.id),
        ),
        name =
          member.status === "invisible" ? "Offline" : hoist?.id || "Online";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(member);
    }
    const rank = (id) =>
      id === "Online"
        ? 10000
        : id === "Offline"
          ? 10001
          : roles.findIndex((r) => r.id === id);
    const ordered = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
    return `<aside class="members" aria-label="Members">${ordered
      .map(
        ([id, people]) =>
          `<section class="member-group"><h2>${escapeHtml(roles.find((r) => r.id === id)?.name || id)} — ${people.length}</h2>${people
            .map((member) => {
              const role = topRole(member);
              return `<button class="member ${member.status === "invisible" ? "offline" : ""}" data-action="member" data-id="${member.id}"><span class="avatar-wrap">${avatar(member)}<i class="status-dot ${escapeHtml(member.status || "online")}"></i></span><span class="who"><strong><span style="${roleTextStyle(role)}">${escapeHtml(member.name || "Member")}</span> ${roleIcon(role)}</strong><small>${escapeHtml(member.status || "online")}</small></span></button>`;
            })
            .join("")}</section>`,
      )
      .join("")}</aside>`;
  }
  function topbar(title, topic = "", kind = "hash") {
    return `<header class="topbar"><button class="icon-button mobiletoggle" data-action="nav" aria-label="Open navigation">${icon("menu")}</button>${icon(kind)}<strong>${escapeHtml(title)}</strong>${topic ? `<span class="topic">${escapeHtml(topic)}</span>` : '<span class="topic"></span>'}<div class="top-actions">${page === "chat" ? `<input class="top-search" id="top-search" aria-label="Search messages" placeholder="Search messages" value="${escapeHtml(search)}"><button class="icon-button" data-action="pins" title="${pins ? "Show all messages" : "Pinned messages"}">${icon("pin")}</button>` : ""}${page === "chat" ? "" : `<button class="icon-button" data-action="quick-switch" title="Quick switch">${icon("search")}</button>`}${current() ? `<button class="icon-button" data-action="memberlist" title="Toggle members">${icon("users")}</button>` : ""}</div></header>`;
  }
  function overview() {
    const s = current();
    const banner = safeMedia(s?.banner_url),
      avatarUrl = safeMedia(s?.avatar_url),
      latest = s?.announcements || [];
    return `${topbar("Overview", "", "home")}<div class="overview-scroll"><div class="overview-banner" ${banner ? `style="background-image:url('${banner}')"` : ""}></div><section class="overview-body"><div class="overview-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="">` : escapeHtml((s?.name || "S")[0].toUpperCase())}</div><h1>${escapeHtml(s?.name)}</h1><p>${escapeHtml(s?.description || "A place for your community to talk and build together.")}</p><div class="overview-actions"><button class="primary" data-action="invite">${icon("invite", "sm")} Invite people</button>${can("manage_server") ? `<button class="secondary" data-action="settings">${icon("settings", "sm")} Customize server</button>` : ""}</div><div class="announcements-heading"><h2>Latest announcements</h2></div><div class="overview-cards">${latest.length ? latest.map((item) => `<button class="overview-card" data-action="channel" data-id="${item.channel_id}"><h3>${escapeHtml(item.body)}</h3><p>${avatar(item.author)} ${escapeHtml(item.author?.name || "Member")} · ${dayLabel(item.created)}</p><small>in ${escapeHtml(item.channel)}</small></button>`).join("") : '<p class="muted">No announcements yet.</p>'}</div></section></div>`;
  }
  function chatView() {
    const s = current(),
      channel = s?.channels.find((item) => item.id === cid);
    return `${topbar(dm?.name || channel?.name || "Channel", dm ? "Direct message" : channel?.topic || "", dm ? "chat" : channel?.type === "VOICE" ? "mic" : "hash")}<div class="timeline" id="timeline"></div><form id="compose" class="composer"><div class="composebox"><button class="icon-button attach" type="button" data-action="attach" title="Attach a file" aria-label="Attach a file">${icon("paperclip")}</button><input id="chat-attachment" type="file" hidden multiple><textarea id="message" maxlength="4000" aria-label="Message" placeholder="Message ${escapeHtml(dm ? "@" + dm.name : "#" + (channel?.name || "channel"))}"></textarea><button class="icon-button" type="button" data-action="emoji" title="Insert emoji">${icon("smile")}</button><button class="primary send" title="Send message" aria-label="Send message">${icon("send", "sm")}</button></div>${pendingAttachments.length ? `<div class="pending-files">${pendingAttachments.map((x) => `<span>${escapeHtml(x.name)} · ${Math.ceil(x.size / 1024)} KB</span>`).join("")}</div>` : ""}<small>Enter to send · Shift + Enter for a new line</small></form>`;
  }
  function featureView() {
    const channel = current()?.channels.find((item) => item.id === cid);
    const data = featureState || {};
    if (!channel) return chatView();
    if (channel.type === "LIST")
      return `${topbar(channel.name, channel.topic, "hash")}<section class="feature-view"><header><h1>${escapeHtml(channel.name)}</h1><button class="primary" data-action="feature-add">Add item</button></header><div class="feature-list">${(data.items || []).map((i) => `<article class="feature-card"><label><input type="checkbox" data-action="list-toggle" data-id="${i.id}" ${i.done ? "checked" : ""}><strong>${escapeHtml(i.title)}</strong></label>${i.note ? `<p>${escapeHtml(i.note)}</p>` : ""}<small>${i.assignee ? "Assigned" : "Unassigned"}</small><button data-action="feature-edit" data-id="${i.id}">Edit</button><button class="danger" data-action="feature-delete" data-id="${i.id}">Delete</button></article>`).join("") || '<p class="muted">No list items yet.</p>'}</div></section>`;
    if (channel.type === "DOCS")
      return `${topbar(channel.name, channel.topic, "hash")}<section class="feature-view"><header><h1>${escapeHtml(channel.name)}</h1><button class="primary" data-action="feature-add">New document</button></header><div class="feature-list">${(data.docs || []).map((d) => `<article class="feature-card"><strong>${escapeHtml(d.title)}</strong><p>${escapeHtml((d.body || "").slice(0, 220))}</p><button data-action="feature-edit" data-id="${d.id}">Edit</button><button class="danger" data-action="feature-delete" data-id="${d.id}">Delete</button></article>`).join("") || '<p class="muted">No documents yet.</p>'}</div></section>`;
    if (channel.type === "CALENDAR")
      return `${topbar(channel.name, channel.topic, "hash")}<section class="feature-view"><header><h1>${escapeHtml(channel.name)}</h1><button class="primary" data-action="feature-add">Create event</button></header><div class="calendar-grid">${(data.events || []).map((x) => `<article class="feature-card"><strong>${escapeHtml(x.title)}</strong><p>${new Date(x.starts_at).toLocaleString()}</p><p>${escapeHtml(x.description || "")}</p><button data-action="event-rsvp" data-id="${x.id}">RSVP</button><button data-action="feature-edit" data-id="${x.id}">Edit</button><button class="danger" data-action="feature-delete" data-id="${x.id}">Delete</button></article>`).join("") || '<p class="muted">No events this month.</p>'}</div></section>`;
    if (channel.type === "FORUM")
      return `${topbar(channel.name, channel.topic, "hash")}<section class="feature-view"><header><h1>${escapeHtml(channel.name)}</h1><button class="primary" data-action="feature-add">New topic</button></header><div class="feature-list">${(data.topics || []).map((t) => `<article class="feature-card"><strong>${t.pinned ? "📌 " : ""}${escapeHtml(t.title)}</strong><p>${escapeHtml(t.body)}</p><small>${t.reply_count || 0} replies${t.locked ? " · Locked" : ""}</small><button data-action="forum-reply" data-id="${t.id}">Reply</button>${can("manage_topics") ? `<button data-action="forum-lock" data-id="${t.id}" data-locked="${!t.locked}">${t.locked ? "Unlock" : "Lock"}</button>` : ""}</article>`).join("") || '<p class="muted">No topics yet.</p>'}</div></section>`;
    if (channel.type === "VOICE")
      return `${topbar(channel.name, channel.topic, "mic")}<section class="feature-view voice-view"><h1>${escapeHtml(channel.name)}</h1><p class="muted">Presence-only voice room — audio is not enabled.</p><button class="primary" data-action="voice-toggle">${(data.participants || []).some((x) => x.id === state.user.id) ? "Leave voice" : "Join voice"}</button><div class="voice-grid">${(data.participants || []).map((p) => `<article class="voice-tile">${avatar(p)}<strong>${escapeHtml(p.name || "Member")}</strong><small>${p.muted ? "Muted" : "Listening"}${p.deafened ? " · Deafened" : ""}</small></article>`).join("")}</div></section>`;
    return chatView();
  }
  function auditView() {
    const s = current();
    return `${topbar("Audit log", "", "audit")}<div class="audit-scroll"><div class="audit-filters"><select id="audit-time" aria-label="Time frame"><option value="all">All time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option></select><select id="audit-action" aria-label="Action"><option value="all">All actions</option><option value="role">Role changes</option><option value="channel">Channels</option><option value="category">Categories</option><option value="invite">Invites</option><option value="member">Members</option><option value="server">Server</option></select><select id="audit-member" aria-label="Member"><option value="all">All members</option>${s.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("")}</select></div><div id="audit-results"></div></div>`;
  }
  function auditKind(item) {
    const name = item.action.toLowerCase();
    if (name.includes("role")) return "role";
    if (name.includes("channel")) return "channel";
    if (name.includes("categor")) return "category";
    if (name.includes("invite")) return "invite";
    if (/member|joined|kick|ban|left/.test(name)) return "member";
    return "server";
  }
  function renderAudit() {
    const root = $("#audit-results");
    if (!root) return;
    const s = current(),
      days = value("audit-time"),
      action = value("audit-action"),
      member = value("audit-member");
    const filtered = (s.audit || []).filter(
      (item) =>
        (days === "all" ||
          item.created > Date.now() / 1000 - Number(days) * 86400) &&
        (action === "all" || auditKind(item) === action) &&
        (member === "all" || item.actor === member),
    );
    root.innerHTML = filtered.length
      ? filtered
          .map(
            (item) =>
              `<div class="audit-item">${avatar(person(item.actor))}<div><strong>${escapeHtml(item.action.replaceAll("/", " · "))}</strong><small>${escapeHtml(person(item.actor).name)} · ${new Date(item.created * 1000).toLocaleString()}</small></div></div>`,
          )
          .join("")
      : '<p class="muted">No actions match these filters.</p>';
  }
  function render() {
    if (!state) {
      renderAuth();
      return;
    }
    const server = current();
    if (page === "chat" && !dm && !server) {
      page = "home";
      cid = null;
    }
    if (
      page === "chat" &&
      server &&
      !server.channels.some((c) => c.id === cid)
    ) {
      cid = server.channels[0]?.id || null;
      if (!cid) page = "overview";
    }
    const selectedChannel = server?.channels.find((item) => item.id === cid);
    const isFeature =
      !dm &&
      ["LIST", "DOCS", "CALENDAR", "FORUM", "VOICE"].includes(
        selectedChannel?.type,
      );
    $("#app").innerHTML =
      `<div class="layout ${membersVisible ? "" : "members-hidden"}">${rail()}${sidebar()}<main class="main">${server ? (page === "overview" ? overview() : page === "audit" && (can("manage_server") || can("view_audit")) ? auditView() : isFeature ? featureView() : chatView()) : dm ? chatView() : `<section class="empty-home"><div class="home-mark">G</div><h1>Your conversations start here</h1><p>Open a server, create your own, or send a direct message.</p><div class="actions"><button class="primary" data-action="create-server">Create a server</button><button class="secondary" data-action="join-server">Join a server</button></div><button data-action="new-dm">Start a direct message</button></section>`}</main>${memberList()}</div>`;
    if (page === "chat") {
      lastMessageKey = "";
      renderMessages();
      $("#message")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          $("#compose").requestSubmit();
        }
      });
    }
    if (page === "audit") renderAudit();
  }
  async function loadMessages() {
    if (page !== "chat" || (!cid && !dm)) return;
    const key = dm ? "u" + dm.id : "c" + cid;
    const data = await rpc("app_messages", {
      p_channel: dm ? null : cid,
      p_user: dm?.id || null,
    });
    if (key === (dm ? "u" + dm.id : "c" + cid)) {
      messages = (Array.isArray(data) ? data : []).filter(
        (item) => item && typeof item.body === "string",
      );
      const attachments = messages.flatMap((item) => item.attachments || []);
      await Promise.all(
        attachments.map(async (attachment) => {
          if (attachmentURLs[attachment.id]) return;
          const { data: signed } = await supabase.storage
            .from("attachments")
            .createSignedUrl(attachment.path, 3600);
          if (signed?.signedUrl)
            attachmentURLs[attachment.id] = signed.signedUrl;
        }),
      );
      renderMessages();
    }
  }
  async function loadFeature() {
    if (!cid) return;
    featureState = (await rpc("app_feature_state", { p_channel: cid })) || {};
    render();
  }
  async function queueAttachments(files) {
    if (!cid || dm)
      throw Error("Files can only be attached to server channels right now.");
    for (const file of [...files]) {
      if (file.size > 10 * 1024 * 1024)
        throw Error(`${file.name} is larger than the 10 MB limit.`);
      const path = `channels/${cid}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) throw uploadError;
      const result = await featureApi("attachment/create", {
        channel: cid,
        path,
        name: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
      });
      pendingAttachments.push({ ...result, name: file.name, size: file.size });
    }
    render();
  }
  function dayLabel(timestamp) {
    const date = new Date(timestamp * 1000),
      today = new Date(),
      yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  function renderMessages() {
    const root = $("#timeline");
    if (!root) return;
    const channel = current()?.channels.find((item) => item.id === cid),
      key = JSON.stringify([messages, search, pins, cid, dm?.id]);
    if (key === lastMessageKey) return;
    lastMessageKey = key;
    const follow =
      root.scrollHeight - root.scrollTop - root.clientHeight < 90 ||
      !root.innerHTML;
    let previousDate = "";
    const visible = messages.filter(
      (item) =>
        (!pins || item.pinned) &&
        item.body.toLowerCase().includes(search.toLowerCase()),
    );
    root.innerHTML = `<div class="welcome"><div class="bigicon">${icon(dm ? "chat" : "hash")}</div><h1>${dm ? "A conversation with " + escapeHtml(dm.name) : "Welcome to #" + escapeHtml(channel?.name || "general")}</h1><p>${escapeHtml(dm ? "This is the beginning of your direct messages." : channel?.topic || "This is the beginning of this channel.")}</p></div>${pins ? '<div class="date">Pinned messages</div>' : ""}${visible
      .map((item) => {
        const user = person(item.sender),
          role = topRole(user),
          day = dayLabel(item.created);
        const divider =
          day !== previousDate
            ? `<div class="date">${escapeHtml(day)}</div>`
            : "";
        previousDate = day;
        const attachments = (item.attachments || [])
          .map((a) =>
            /^image\//.test(a.type) && attachmentURLs[a.id]
              ? `<a href="${attachmentURLs[a.id]}" target="_blank" rel="noreferrer"><img class="chat-image" src="${attachmentURLs[a.id]}" alt="${escapeHtml(a.name)}"></a>`
              : `<a class="file-chip" href="${attachmentURLs[a.id] || "#"}" target="_blank" rel="noreferrer">${escapeHtml(a.name)} · ${Math.ceil(a.size / 1024)} KB</a>`,
          )
          .join("");
        return `${divider}<article class="message" data-message="${item.id}">${avatar(user)}<div class="content"><span class="name" style="${roleTextStyle(role)}">${escapeHtml(user.name)}</span>${roleIcon(role)}<time>${new Date(item.created * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>${item.pinned ? ` <span class="pinned">${icon("pin", "sm")} Pinned</span>` : ""}<p>${escapeHtml(item.body)}</p>${attachments}${item.edited ? '<span class="edited">(edited)</span>' : ""}<div>${(item.reactions || []).map((reaction) => `<button class="reaction" data-action="reaction" data-id="${item.id}" data-emoji="${escapeHtml(reaction.emoji)}">${escapeHtml(reaction.emoji)} ${reaction.count}</button>`).join("")}</div></div><div class="msgtools"><button data-action="reaction-picker" data-id="${item.id}" title="React">${icon("smile", "sm")}</button><button data-action="reply" data-id="${item.id}" title="Reply">${icon("chat", "sm")}</button>${item.sender === state.user.id ? `<button data-action="edit-message" data-id="${item.id}" title="Edit">${icon("edit", "sm")}</button>` : ""}${cid && can("manage_messages") ? `<button data-action="pin" data-id="${item.id}" title="${item.pinned ? "Unpin" : "Pin"}">${icon("pin", "sm")}</button>` : ""}${item.sender === state.user.id || (cid && can("manage_messages")) ? `<button data-action="delete-message" data-id="${item.id}" title="Delete">${icon("trash", "sm")}</button>` : ""}</div></article>`;
      })
      .join(
        "",
      )}${!visible.length ? `<p class="muted">${search || pins ? "No messages match." : "Start the conversation."}</p>` : ""}`;
    if (follow) root.scrollTop = root.scrollHeight;
  }
  function menu(items, x, y) {
    document.querySelector(".context-menu")?.remove();
    const el = document.createElement("div");
    el.className = "context-menu";
    el.setAttribute("role", "menu");
    el.innerHTML = items
      .map(
        (item) =>
          `<button role="menuitem" class="${item.danger ? "danger" : ""}" data-action="${item.action}" ${item.id ? `data-id="${item.id}"` : ""} ${item.dir ? `data-dir="${item.dir}"` : ""}>${icon(item.icon, "sm")}${escapeHtml(item.label)}</button>`,
      )
      .join("");
    document.body.appendChild(el);
    el.style.left = Math.min(x, innerWidth - 190) + "px";
    el.style.top = Math.min(y, innerHeight - el.offsetHeight - 10) + "px";
  }
  function serverMenu() {
    const s = current(),
      rect = $(".serverhead").getBoundingClientRect(),
      items = [
        { label: "Invite people", action: "invite", icon: "invite" },
        { label: "Settings", action: "settings", icon: "settings" },
        { label: "Audit log", action: "audit-page", icon: "audit" },
      ];
    if (can("manage_channels"))
      items.push(
        { label: "Create channel", action: "new-channel", icon: "plus" },
        { label: "Create category", action: "new-category", icon: "plus" },
      );
    items.push({
      label: "Leave server",
      action: s.owner === state.user.id ? "owner-leave-info" : "leave-server",
      icon: "logout",
      danger: true,
    });
    menu(items, rect.left + 5, rect.bottom + 3);
    $(".context-menu")?.classList.add("server-dropdown");
  }
  function categoryEditor(id = null) {
    const cat = current().categories.find((item) => item.id === id);
    editingCategory = id;
    show(
      cat ? "Category settings" : "Create a category",
      `${field("category-name", "Category name", cat?.name || "")}<label>Access</label><p class="notice">Leave all roles unchecked for a public category. Private channels inherit these roles unless overridden.</p>${current()
        .roles.filter((role) => role.position > 0)
        .map(
          (role) =>
            `<label class="permission"><span>${escapeHtml(role.name)}</span><input type="checkbox" data-category-role="${role.id}" ${cat?.allowed?.includes(role.id) ? "checked" : ""}></label>`,
        )
        .join("")}`,
      `${cat ? `<button class="danger" data-action="delete-category">Delete category</button>` : ""}<button class="primary" data-action="save-category">${cat ? "Save changes" : "Create category"}</button>`,
    );
  }
  function channelEditor(id = null, categoryId = null) {
    const channel = current().channels.find((item) => item.id === id);
    editingChannel = id;
    show(
      channel ? "Channel settings" : "Create a channel",
      `${field("channel-name", "Channel name", channel?.name || "")}<label for="channel-type">Channel type</label><select id="channel-type">${["TEXT", "LIST", "DOCS", "CALENDAR", "FORUM", "VOICE"].map((type) => `<option value="${type}" ${(channel?.type || "TEXT") === type ? "selected" : ""}>${type[0] + type.slice(1).toLowerCase()}</option>`).join("")}</select><label for="channel-topic">Topic</label><input id="channel-topic" value="${escapeHtml(channel?.topic || "")}"><label for="channel-category">Category</label><select id="channel-category">${current()
        .categories.map(
          (cat) =>
            `<option value="${cat.id}" ${(channel?.category_id || categoryId) === cat.id ? "selected" : ""}>${escapeHtml(cat.name)}</option>`,
        )
        .join(
          "",
        )}</select><label class="permission"><span>Read only <small>Members with message management can still post.</small></span><input id="channel-readonly" type="checkbox" ${channel?.readonly ? "checked" : ""}></label><label>Private channel roles</label><p class="notice">When unchecked, the channel uses its category access.</p>${current()
        .roles.filter((role) => role.position > 0)
        .map(
          (role) =>
            `<label class="permission"><span>${escapeHtml(role.name)}</span><input type="checkbox" data-channel-role="${role.id}" ${channel?.allowed?.includes(role.id) ? "checked" : ""}></label>`,
        )
        .join("")}`,
      `${channel ? `<button class="danger" data-action="delete-channel">Delete channel</button>` : ""}<button class="primary" data-action="save-channel">${channel ? "Save channel" : "Create channel"}</button>`,
    );
  }
  function memberModal(id) {
    const member = current()?.members.find((item) => item.id === id);
    if (!member) return;
    const mine = member.id === state.user.id;
    show(
      member.name,
      `${avatar(member)} <strong>@${escapeHtml(member.username)}</strong><p class="muted" style="margin:12px 0">${escapeHtml(member.bio || "")}</p>${mine ? '<p class="muted">Your roles in this server</p>' : ""}${current()
        .roles.filter((role) => role.position > 0)
        .map(
          (role) =>
            `<label class="permission"><span style="${roleTextStyle(role)}">${roleIcon(role)} ${escapeHtml(role.name)}</span><input type="checkbox" data-action="assign-role" data-id="${member.id}" data-role="${role.id}" ${member.roles?.includes(role.id) ? "checked" : ""} ${!can("manage_roles") && !(mine && role.self_assignable) ? "disabled" : ""}></label>`,
        )
        .join(
          "",
        )}${!mine ? `<div class="upload-row"><button data-action="dm-member" data-id="${id}">Send message</button>${can("kick_members") ? `<button class="danger" data-action="kick" data-id="${id}">Kick</button>` : ""}${can("ban_members") ? `<button class="danger" data-action="ban" data-id="${id}">Ban</button>` : ""}</div>` : ""}`,
    );
  }
  function profileModal() {
    const user = state.user;
    show(
      "User settings",
      `${field("profile-name", "Display name", user.name)}${field("profile-avatar", "Avatar character", user.avatar || "")}<label for="profile-bio">About me</label><textarea id="profile-bio">${escapeHtml(user.bio || "")}</textarea><label for="profile-status">Status</label><select id="profile-status">${["online", "idle", "dnd", "invisible"].map((status) => `<option ${status === user.status ? "selected" : ""}>${status}</option>`).join("")}</select><p class="notice">Badges: ${(user.badges || []).map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join(" ") || "None"}</p><p class="notice">Status is selected manually.</p>`,
      `<button class="secondary" data-action="logout">Sign out</button><button class="primary" data-action="save-profile">Save profile</button>`,
    );
  }
  async function mutate(action, payload, after) {
    await api(action, payload);
    await refresh();
    if (after) after();
    else closeModal();
  }
  function quickSwitch() {
    const s = current();
    show(
      "Quick switch",
      `${field("quick-query", "Search channels or members", "")}<div id="quick-results"></div>`,
    );
    $("#quick-query").focus();
    renderQuick();
  }
  function renderQuick() {
    const root = $("#quick-results");
    if (!root) return;
    const query = value("quick-query").toLowerCase();
    const server = current();
    root.innerHTML = `${
      server?.channels
        .filter((c) => c.name.toLowerCase().includes(query))
        .slice(0, 12)
        .map(
          (c) =>
            `<button class="nav-item" data-action="channel" data-id="${c.id}">${icon("hash", "sm")} ${escapeHtml(c.name)}</button>`,
        )
        .join("") || ""
    }${(state.contacts || [])
      .filter((u) => u.name.toLowerCase().includes(query))
      .slice(0, 8)
      .map(
        (u) =>
          `<button class="nav-item" data-action="dm" data-id="${u.id}">${icon("chat", "sm")} ${escapeHtml(u.name)}</button>`,
      )
      .join("")}`;
  }
  const settingsUI = window.createSettingsUI({
    supabase,
    rpc,
    api,
    current,
    can,
    icon,
    avatar,
    escapeHtml,
    roleIcon,
    roleTextStyle,
    safeMedia,
    refresh,
    toast,
    errText,
    modal,
  });
  function settings() {
    settingsUI.open(settingsTab);
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      document.querySelector(".context-menu")?.remove();
      return;
    }
    const action = button.dataset.action,
      id = button.dataset.id;
    document.querySelector(".context-menu")?.remove();
    try {
      if (action === "close") {
        closeModal();
        return;
      }
      if (action === "auth-switch") {
        registration = !registration;
        renderAuth();
        return;
      }
      if (action === "nav") {
        $(".layout")?.classList.toggle("shownav");
        return;
      }
      if (action === "home") {
        sid = cid = null;
        dm = null;
        page = "home";
        render();
        return;
      }
      if (action === "server") {
        sid = id;
        cid = null;
        dm = null;
        page = "overview";
        render();
        return;
      }
      if (action === "overview") {
        page = "overview";
        render();
        return;
      }
      if (action === "audit-page") {
        if (!can("manage_server") && !can("view_audit"))
          throw Error("Missing permission");
        page = "audit";
        closeModal();
        render();
        return;
      }
      if (action === "members-page") {
        show("Members", memberList().replace(/^<aside[^>]*>|<\/aside>$/g, ""));
        return;
      }
      if (action === "channel" || action === "first-channel") {
        cid = action === "first-channel" ? current().channels[0]?.id : id;
        if (!cid) throw Error("No channel yet");
        dm = null;
        page = "chat";
        closeModal();
        render();
        if (
          ["LIST", "DOCS", "CALENDAR", "FORUM", "VOICE"].includes(
            current()?.channels.find((x) => x.id === cid)?.type,
          )
        )
          await loadFeature();
        else await loadMessages();
        return;
      }
      if (action === "dm" || action === "dm-member") {
        dm = person(id);
        sid = cid = null;
        page = "chat";
        closeModal();
        render();
        await loadMessages();
        return;
      }
      if (action === "toggle-category") {
        collapsed[id] = !collapsed[id];
        await rpc("app_ui_state", {
          p_data: {
            collapsed: Object.keys(collapsed).filter((key) => collapsed[key]),
          },
        });
        render();
        return;
      }
      if (action === "memberlist") {
        if (innerWidth < 1100)
          show(
            "Members",
            memberList().replace(/^<aside[^>]*>|<\/aside>$/g, ""),
          );
        else {
          membersVisible = !membersVisible;
          render();
        }
        return;
      }
      if (action === "quick-switch") {
        quickSwitch();
        return;
      }
      if (action === "attach") {
        $("#chat-attachment")?.click();
        return;
      }
      if (action === "feature-add") {
        const channel = current()?.channels.find((x) => x.id === cid);
        if (channel.type === "LIST") {
          const title = prompt("Item title");
          if (!title) return;
          await featureApi("list/create", {
            channel: cid,
            title,
            note: prompt("Optional note") || "",
          });
        } else if (channel.type === "DOCS") {
          const title = prompt("Document title");
          if (!title) return;
          await featureApi("docs/create", { channel: cid, title, body: "" });
        } else if (channel.type === "CALENDAR") {
          const title = prompt("Event title");
          if (!title) return;
          const starts_at = prompt(
            "Start (YYYY-MM-DD HH:MM)",
            new Date().toISOString().slice(0, 16),
          );
          if (!starts_at) return;
          await featureApi("calendar/create", {
            channel: cid,
            title,
            starts_at,
            description: prompt("Description") || "",
          });
        } else if (channel.type === "FORUM") {
          const title = prompt("Topic title");
          if (!title) return;
          const body = prompt("Opening post");
          if (!body) return;
          await featureApi("forum/create", { channel: cid, title, body });
        }
        await loadFeature();
        return;
      }
      if (action === "feature-edit") {
        const channel = current()?.channels.find((x) => x.id === cid);
        const collection =
          channel.type === "LIST"
            ? featureState.items
            : channel.type === "DOCS"
              ? featureState.docs
              : featureState.events;
        const item = collection?.find((x) => x.id === id);
        if (!item) return;
        const title = prompt("Title", item.title);
        if (!title) return;
        const apiName =
          channel.type === "LIST"
            ? "list/save"
            : channel.type === "DOCS"
              ? "docs/save"
              : "calendar/save";
        await featureApi(apiName, {
          channel: cid,
          id,
          title,
          note:
            channel.type === "LIST"
              ? prompt("Note", item.note || "") || ""
              : undefined,
          body:
            channel.type === "DOCS"
              ? prompt("Document content", item.body || "") || ""
              : undefined,
          description:
            channel.type === "CALENDAR"
              ? prompt("Description", item.description || "") || ""
              : undefined,
          starts_at:
            channel.type === "CALENDAR"
              ? prompt("Start", item.starts_at) || item.starts_at
              : undefined,
          ends_at: channel.type === "CALENDAR" ? item.ends_at || "" : undefined,
          done: item.done,
        });
        await loadFeature();
        return;
      }
      if (action === "feature-delete") {
        const channel = current()?.channels.find((x) => x.id === cid);
        if (!confirm("Delete this item?")) return;
        await featureApi(
          channel.type === "LIST"
            ? "list/delete"
            : channel.type === "DOCS"
              ? "docs/delete"
              : "calendar/delete",
          { channel: cid, id },
        );
        await loadFeature();
        return;
      }
      if (action === "list-toggle") {
        const item = featureState.items?.find((x) => x.id === id);
        await featureApi("list/save", {
          channel: cid,
          id,
          title: item.title,
          note: item.note || "",
          done: button.checked,
        });
        await loadFeature();
        return;
      }
      if (action === "event-rsvp") {
        await featureApi("calendar/rsvp", {
          channel: cid,
          id,
          status: "going",
        });
        await loadFeature();
        return;
      }
      if (action === "forum-reply") {
        const body = prompt("Reply");
        if (!body) return;
        await featureApi("forum/reply", { channel: cid, topic: id, body });
        await loadFeature();
        return;
      }
      if (action === "forum-lock") {
        await featureApi("forum/moderate", {
          channel: cid,
          id,
          locked: button.dataset.locked === "true",
        });
        await loadFeature();
        return;
      }
      if (action === "voice-toggle") {
        const joined = (featureState.participants || []).some(
          (x) => x.id === state.user.id,
        );
        await featureApi(joined ? "voice/leave" : "voice/join", {
          channel: cid,
        });
        await loadFeature();
        return;
      }
      if (action === "server-menu") {
        serverMenu();
        return;
      }
      if (action === "owner-leave-info") {
        toast("Transfer server ownership before leaving.");
        return;
      }
      if (action === "settings") {
        settingsTab = "overview";
        settings();
        return;
      }
      if (action === "staff-panel") {
        show(
          "Platform staff",
          `<p class="notice">Assign a staff badge by username. This is logged and restricted to platform staff.</p><label>Username<input id="staff-username"></label><select id="staff-badge"><option value="staff">Staff</option><option value="verified">Verified</option><option value="early-supporter">Early supporter</option></select>`,
          `<button class="primary" data-action="staff-badge">Assign badge</button>`,
        );
        return;
      }
      if (action === "staff-badge") {
        const user = await api("dm/open", {
          username: value("staff-username"),
        });
        await featureApi("staff/badge", {
          user: user.user.id,
          badge: value("staff-badge"),
        });
        closeModal();
        toast("Badge assigned");
        return;
      }
      if (action === "settings-tab") {
        settingsTab = id;
        settings();
        return;
      }
      if (action === "rules") {
        show(
          "Server rules",
          `<p style="white-space:pre-wrap">${escapeHtml(current().rules || "No rules have been added yet.")}</p>`,
        );
        return;
      }
      if (action === "create-server") {
        show(
          "Create a server",
          `${field("new-server-name", "Server name", "My community")}`,
          '<button class="primary" data-action="submit-server">Create server</button>',
        );
        return;
      }
      if (action === "submit-server") {
        const result = await api("server/create", {
          name: value("new-server-name"),
          icon: "G",
        });
        sid = result.id;
        cid = null;
        dm = null;
        page = "overview";
        await refresh();
        closeModal();
        return;
      }
      if (action === "join-server") {
        show(
          "Join a server",
          field("invite-code", "Invite code"),
          '<button class="secondary" data-action="browse-servers">Browse public servers</button><button class="primary" data-action="submit-join">Join server</button>',
        );
        return;
      }
      if (action === "browse-servers") {
        const servers = await rpc("app_discover_servers");
        show(
          "Public servers",
          servers.length
            ? servers
                .map(
                  (s) =>
                    `<div class="s-record"><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.description)} · ${s.member_count} members</small></div><button class="primary" data-action="join-public" data-id="${s.id}">${s.joined ? "Open" : "Join"}</button></div>`,
                )
                .join("")
            : '<p class="muted">No public servers yet.</p>',
        );
        return;
      }
      if (action === "join-public") {
        await rpc("app_join_public_server", { p_server: id });
        sid = id;
        page = "overview";
        await refresh();
        closeModal();
        return;
      }
      if (action === "submit-join") {
        const result = await api("server/join", { code: value("invite-code") });
        sid = result.id;
        cid = null;
        dm = null;
        page = "overview";
        await refresh();
        closeModal();
        return;
      }
      if (action === "invite") {
        const result = await api("server/invite", { server: sid });
        show(
          "Invite people",
          `${field("copy-code", "Invite code", result.code)}<p class="notice">Share this code and the localhost address with someone who can access this PC. The app stays on localhost.</p>`,
          '<button class="primary" data-action="copy-invite">Copy code</button>',
        );
        return;
      }
      if (action === "copy-invite") {
        await navigator.clipboard.writeText(value("copy-code"));
        toast("Invite code copied");
        return;
      }
      if (action === "save-server") {
        await mutate(
          "server/update",
          {
            server: sid,
            name: value("server-name"),
            icon: current().icon,
            description: value("server-description"),
            rules: value("server-rules"),
            boost: Number(value("server-boost")),
          },
          () => {
            settings();
            toast("Server saved");
          },
        );
        return;
      }
      if (action === "remove-server-media") {
        await rpc("app_server_media", {
          p_server: sid,
          p_kind: button.dataset.kind,
          p_url: "",
        });
        await refresh();
        settings();
        return;
      }
      if (action === "new-category") {
        categoryEditor();
        return;
      }
      if (action === "edit-category") {
        categoryEditor(id);
        return;
      }
      if (action === "save-category") {
        await rpc("app_category_api", {
          p_action: "save",
          p_payload: {
            server: sid,
            id: editingCategory,
            name: value("category-name"),
            allowed: [
              ...document.querySelectorAll("[data-category-role]:checked"),
            ].map((input) => input.dataset.categoryRole),
          },
        });
        await refresh();
        closeModal();
        toast("Category saved");
        return;
      }
      if (action === "delete-category") {
        if (
          confirm(
            "Delete this category? Its channels will remain in the server.",
          )
        ) {
          await rpc("app_category_api", {
            p_action: "delete",
            p_payload: { server: sid, id: editingCategory },
          });
          await refresh();
          closeModal();
        }
        return;
      }
      if (action === "move-category") {
        await rpc("app_category_api", {
          p_action: "move",
          p_payload: { server: sid, id, direction: button.dataset.dir },
        });
        await refresh();
        settings();
        return;
      }
      if (action === "move-channel") {
        await rpc("app_channel_move", {
          p_channel: id,
          p_direction: button.dataset.dir,
        });
        await refresh();
        return;
      }
      if (action === "new-channel") {
        channelEditor(null, button.dataset.category || null);
        return;
      }
      if (action === "edit-channel") {
        channelEditor(id || cid);
        return;
      }
      if (action === "save-channel") {
        const cat = current().categories.find(
          (item) => item.id === value("channel-category"),
        );
        if (!cat) throw Error("Create a category first");
        await api("channel/save", {
          server: sid,
          id: editingChannel,
          name: value("channel-name"),
          topic: value("channel-topic"),
          category: cat.name,
          category_id: cat.id,
          type: value("channel-type"),
          readonly: checked("channel-readonly"),
          allowed: [
            ...document.querySelectorAll("[data-channel-role]:checked"),
          ].map((input) => input.dataset.channelRole),
        });
        await refresh();
        closeModal();
        toast("Channel saved");
        return;
      }
      if (action === "delete-channel") {
        if (confirm("Delete this channel and its messages?")) {
          await mutate("channel/delete", { server: sid, id: editingChannel });
          cid = null;
          page = "overview";
          render();
        }
        return;
      }
      if (action === "member") {
        memberModal(id);
        return;
      }
      if (action === "assign-role") {
        const role = button.dataset.role;
        if (id === state.user.id && !can("manage_roles"))
          await rpc("app_role_self", {
            p_role: role,
            p_enabled: button.checked,
          });
        else
          await api("member/role", {
            server: sid,
            user: id,
            role,
            enabled: button.checked,
          });
        await refresh();
        memberModal(id);
        return;
      }
      if (["kick", "ban", "unban"].includes(action)) {
        if (confirm(`${action} this member?`))
          await mutate(
            "member/moderate",
            { server: sid, user: id, action },
            () => {
              settingsTab = "people";
              settings();
            },
          );
        return;
      }
      if (action === "leave-server" || action === "delete-server") {
        if (
          confirm(
            action === "delete-server"
              ? "Permanently delete this server and all its content?"
              : "Leave this server?",
          )
        ) {
          await api(
            "server/" + (action === "delete-server" ? "delete" : "leave"),
            { server: sid },
          );
          sid = cid = null;
          page = "home";
          await refresh();
          closeModal();
        }
        return;
      }
      if (action === "profile") {
        profileModal();
        return;
      }
      if (action === "save-profile") {
        await mutate("profile", {
          name: value("profile-name"),
          avatar: value("profile-avatar") || state.user.avatar || "G",
          bio: value("profile-bio"),
          status: value("profile-status"),
        });
        return;
      }
      if (action === "logout") {
        await supabase.auth.signOut({ scope: "local" });
        state = null;
        sid = cid = dm = null;
        page = "home";
        preferencesLoaded = false;
        collapsed = {};
        closeModal();
        renderAuth();
        return;
      }
      if (action === "new-dm") {
        show(
          "New direct message",
          field("dm-username", "Username"),
          '<button class="primary" data-action="open-dm">Open conversation</button>',
        );
        return;
      }
      if (action === "open-dm") {
        const result = await api("dm/open", { username: value("dm-username") });
        dm = result.user;
        sid = cid = null;
        page = "chat";
        closeModal();
        render();
        await loadMessages();
        return;
      }
      if (action === "pins") {
        pins = !pins;
        renderMessages();
        return;
      }
      if (action === "reaction-picker") {
        show(
          "React to message",
          `<div class="upload-row">${["💜", "👍", "✨", "😂", "🎉", "👀"].map((emoji) => `<button data-action="reaction" data-id="${id}" data-emoji="${emoji}" style="font-size:22px">${emoji}</button>`).join("")}</div>`,
        );
        return;
      }
      if (action === "reaction") {
        await api("message/react", { id, emoji: button.dataset.emoji });
        closeModal();
        await loadMessages();
        return;
      }
      if (action === "reply") {
        const original = messages.find((item) => item.id === id);
        $("#message").value =
          `> ${original.body.split("\n")[0].slice(0, 100)}\n`;
        $("#message").focus();
        return;
      }
      if (action === "edit-message") {
        const original = messages.find((item) => item.id === id);
        show(
          "Edit message",
          `<label for="edit-body">Message</label><textarea id="edit-body">${escapeHtml(original.body)}</textarea>`,
          `<button class="primary" data-action="save-message" data-id="${id}">Save</button>`,
        );
        return;
      }
      if (action === "save-message") {
        await api("message/edit", { id, body: value("edit-body") });
        closeModal();
        await loadMessages();
        return;
      }
      if (action === "pin") {
        await api("message/pin", { id });
        await loadMessages();
        return;
      }
      if (action === "delete-message") {
        if (confirm("Delete this message?")) {
          await api("message/delete", { id });
          await loadMessages();
        }
        return;
      }
      if (action === "emoji") {
        show(
          "Insert emoji",
          `<div class="upload-row">${["💜", "👍", "✨", "😂", "🎉", "👀"].map((emoji) => `<button data-action="insert-emoji" data-emoji="${emoji}" style="font-size:22px">${emoji}</button>`).join("")}</div>`,
        );
        return;
      }
      if (action === "insert-emoji") {
        $("#message").value += button.dataset.emoji;
        closeModal();
        $("#message").focus();
        return;
      }
    } catch (error) {
      showError(error);
    }
  });
  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (["audit-time", "audit-action", "audit-member"].includes(input.id))
      renderAudit();
    if (input.id === "chat-attachment" && input.files?.length) {
      try {
        await queueAttachments(input.files);
      } catch (error) {
        toast(errText(error));
      }
    }
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "quick-query") renderQuick();
    if (event.target.id === "role-color" && $("#color-value"))
      $("#color-value").textContent = event.target.value;
    if (event.target.id === "top-search") {
      search = event.target.value;
      renderMessages();
    }
  });
  document.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  });
  document.addEventListener("drop", async (event) => {
    if (!event.dataTransfer?.files?.length || !event.target.closest(".main"))
      return;
    event.preventDefault();
    try {
      await queueAttachments(event.dataTransfer.files);
    } catch (error) {
      toast(errText(error));
    }
  });
  document.addEventListener("paste", async (event) => {
    const files = [...(event.clipboardData?.items || [])]
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!files.length || !event.target.closest("#compose")) return;
    try {
      await queueAttachments(files);
    } catch (error) {
      toast(errText(error));
    }
  });
  document.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "auth-form") {
      const button = event.target.querySelector("[type=submit]");
      button.disabled = true;
      try {
        const email = value("email").trim(),
          password = value("password");
        if (registration) {
          const response = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: location.origin,
              data: {
                username: value("username"),
                name: value("displayname") || value("username"),
              },
            },
          });
          if (response.error) throw response.error;
          if (!response.data.session) {
            toast("Check your email, then sign in.");
            registration = false;
            renderAuth();
            return;
          }
        } else {
          const response = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (response.error) throw response.error;
        }
        await refresh();
      } catch (error) {
        $("#autherror").textContent = errText(error);
        button.disabled = false;
      }
      return;
    }
    if (event.target.id === "compose") {
      const input = $("#message"),
        body = input.value;
      if (!body.trim() && !pendingAttachments.length) return;
      const button = event.target.querySelector(".send");
      button.disabled = true;
      try {
        const created = await api("message/send", {
          channel: dm ? null : cid,
          user: dm?.id || null,
          body: body || "Shared a file",
        });
        for (const attachment of pendingAttachments)
          await featureApi("attachment/bind", {
            channel: cid,
            id: attachment.id,
            message: created.id,
          });
        pendingAttachments = [];
        input.value = "";
        await loadMessages();
        $("#timeline").scrollTop = $("#timeline").scrollHeight;
      } catch (error) {
        toast(errText(error));
      } finally {
        button.disabled = false;
        input.focus();
      }
    }
  });
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest(
      "[data-message],[data-channel],[data-category],.member[data-id],.orb[data-id],.serverhead,.nav",
    );
    if (!target || !state) return;
    event.preventDefault();
    const id =
      target.dataset.message ||
      target.dataset.channel ||
      target.dataset.category ||
      target.dataset.id;
    contextTarget = id;
    let items = [];
    if (target.dataset.message) {
      const message = messages.find((item) => item.id === id);
      items = [
        { label: "React", action: "reaction-picker", icon: "smile", id },
        { label: "Reply", action: "reply", icon: "chat", id },
      ];
      if (message?.sender === state.user.id)
        items.push({ label: "Edit", action: "edit-message", icon: "edit", id });
      if (cid && can("manage_messages"))
        items.push({
          label: message.pinned ? "Unpin" : "Pin",
          action: "pin",
          icon: "pin",
          id,
        });
      if (message?.sender === state.user.id || (cid && can("manage_messages")))
        items.push({
          label: "Delete",
          action: "delete-message",
          icon: "trash",
          id,
          danger: true,
        });
    } else if (target.dataset.channel) {
      items = [{ label: "Open channel", action: "channel", icon: "hash", id }];
      if (can("manage_channels"))
        items.push(
          {
            label: "Channel settings",
            action: "edit-channel",
            icon: "settings",
            id,
          },
          {
            label: "Move up",
            action: "move-channel",
            icon: "up",
            id,
            dir: "up",
          },
          {
            label: "Move down",
            action: "move-channel",
            icon: "down",
            id,
            dir: "down",
          },
        );
    } else if (target.dataset.category) {
      items = [
        {
          label: "Collapse / expand",
          action: "toggle-category",
          icon: "list",
          id,
        },
      ];
      if (can("manage_channels"))
        items.push(
          { label: "Create channel", action: "new-channel", icon: "plus", id },
          {
            label: "Category settings",
            action: "edit-category",
            icon: "settings",
            id,
          },
        );
    } else if (target.classList.contains("member"))
      items = [
        { label: "Member profile", action: "member", icon: "users", id },
        { label: "Direct message", action: "dm-member", icon: "chat", id },
      ];
    else if (
      target.classList.contains("nav") &&
      current() &&
      can("manage_channels")
    )
      items = [
        { label: "Create category", action: "new-category", icon: "plus" },
        { label: "Create channel", action: "new-channel", icon: "hash" },
      ];
    else if (current())
      items = [
        { label: "Server settings", action: "settings", icon: "settings" },
        { label: "Invite people", action: "invite", icon: "invite" },
        { label: "Create category", action: "new-category", icon: "plus" },
      ];
    if (items.length) menu(items, event.clientX, event.clientY);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelector(".context-menu")?.remove();
      if (modal.open) closeModal();
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k" &&
      state
    ) {
      event.preventDefault();
      quickSwitch();
    }
  });
  document.addEventListener("dragstart", (event) => {
    const channel = event.target.closest("[data-channel]"),
      category = event.target.closest("[data-category]");
    if (channel && can("manage_channels"))
      event.dataTransfer.setData("text/channel-id", channel.dataset.channel);
    else if (
      category &&
      category.dataset.category !== "uncategorized" &&
      can("manage_channels")
    )
      event.dataTransfer.setData("text/category-id", category.dataset.category);
  });
  document.addEventListener("dragover", (event) => {
    const target = event.target.closest("[data-channel],[data-category]");
    if (
      target &&
      target.dataset.category !== "uncategorized" &&
      (event.dataTransfer.types.includes("text/channel-id") ||
        event.dataTransfer.types.includes("text/category-id"))
    ) {
      event.preventDefault();
      target.classList.add("drag-over");
    }
  });
  document.addEventListener("dragleave", (event) =>
    event.target
      .closest("[data-channel],[data-category]")
      ?.classList.remove("drag-over"),
  );
  document.addEventListener("drop", async (event) => {
    const target = event.target.closest("[data-channel],[data-category]");
    if (!target || target.dataset.category === "uncategorized") return;
    event.preventDefault();
    target.classList.remove("drag-over");
    const channelId = event.dataTransfer.getData("text/channel-id"),
      categoryId = event.dataTransfer.getData("text/category-id");
    try {
      if (
        target.dataset.channel &&
        channelId &&
        channelId !== target.dataset.channel
      ) {
        await rpc("app_channel_place", {
          p_source: channelId,
          p_target: target.dataset.channel,
        });
        toast("Channels reordered");
      } else if (target.dataset.category && channelId) {
        await rpc("app_category_api", {
          p_action: "channel/move",
          p_payload: {
            server: sid,
            id: channelId,
            category: target.dataset.category,
          },
        });
        toast("Channel moved");
      } else if (
        target.dataset.category &&
        categoryId &&
        categoryId !== target.dataset.category
      ) {
        await rpc("app_category_place", {
          p_source: categoryId,
          p_target: target.dataset.category,
        });
        toast("Categories reordered");
      }
      await refresh();
    } catch (error) {
      toast(errText(error));
    }
  });
  (async () => {
    try {
      await refresh();
    } catch {
      renderAuth();
    }
  })();
  setInterval(async () => {
    if (!state || document.hidden || pollBusy) return;
    pollBusy = true;
    try {
      if (page === "chat") await loadMessages();
      const fresh = normalizeState(await rpc("app_state"));
      if (JSON.stringify(fresh) !== JSON.stringify(state)) {
        state = fresh;
        pendingRender = true;
      }
      if (pendingRender && !modal.open && !$("#message")?.value) {
        pendingRender = false;
        render();
      }
    } catch (error) {
      if (state) toast(errText(error));
    } finally {
      pollBusy = false;
    }
  }, 3000);
})();
