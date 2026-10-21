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
    bookmark: "M6 3h12v18l-6-4.2L6 21z",
    poll: "M5 21V11M12 21V4M19 21v-6",
    hash: "M4 9h16M4 15h16M11 3 7 21M17 3l-4 18",
    home: "M3 10 12 3l9 7v10H3V10ZM9 20v-7h6v7",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
    settings:
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .34 1.87l-1.87 1.87A1.7 1.7 0 0 0 16 18.4a1.7 1.7 0 0 0-1 .92V22h-6v-2.68a1.7 1.7 0 0 0-1-.92 1.7 1.7 0 0 0-1.87.34l-1.87-1.87A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.92-1H1v-4h2.68a1.7 1.7 0 0 0 .92-1 1.7 1.7 0 0 0-.34-1.87l1.87-1.87A1.7 1.7 0 0 0 8 5.6a1.7 1.7 0 0 0 1-.92V2h6v2.68a1.7 1.7 0 0 0 1 .92 1.7 1.7 0 0 0 1.87-.34l1.87 1.87A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .92 1H23v4h-2.68a1.7 1.7 0 0 0-.92 1Z",
    search: "m21 21-4.4-4.4M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
    pin: "m16 3 5 5-3 1-2 4-2 2-4 2-1 3-5-5 3-1 2-4 2-2 4-2 1-3ZM2 22l6-6",
    lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
    send: "m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2",
    smile:
      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M8.5 9h.01M15.5 9h.01",
    close: "M18 6 6 18M6 6l12 12",
    eye: "M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7-10-7-10-7Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
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
    megaphone: "M3 11v2h3l11 5V6L6 11H3ZM6 13l2 6h4l-2-4M20 9v6",
    trophy: "M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4M8 4V2h8v2",
    compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM15.5 8.5l-2 5-5 2 2-5 5-2Z",
    sparkles: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM19 14l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z",
    star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",
    help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4m0 3h.01",
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
    serverListOpen = false,
    serverSearch = "",
    messages = [],
    messageRelations = { replies: [], threads: [] },
    replyTarget = null,
    privateReply = false,
    replyMention = true,
    rightPanelTab = "members",
    activeThread = null,
    threadData = null,
    featureState = {},
    pendingAttachments = [],
    attachmentURLs = {},
    myReactions = new Map(),
    pendingSends = 0,
    relationsFor = "",
    relationsLoadedAt = 0,
    search = "",
    searchQuery = "",
    searchResults = [],
    searchBusy = false,
    searchView = "results",
    savedSearchList = [],
    bookmarkList = [],
    pins = false,
    selectedRole = null,
    roleDraft = null,
    settingsTab = "overview",
    editingChannel = null,
    editingCategory = null,
    collapsed = {},
    uiPreferences = {},
    favoriteServers = new Set(),
    preferencesLoaded = false,
    membersVisible = true,
    overviewInfo = { serverId: null, createdAt: null, events: [], loading: false },
    pollBusy = false,
    pendingRender = false,
    profileEnsured = false,
    badgesSynced = false,
    serverBadges = {},
    serverBadgesLoaded = false,
    registration = false,
    invitePreviewCode = "",
    invitePreviewInfo = null,
    invitePreviewError = "",
    invitePreviewRequest = "",
    inviteAuthMode = "preview",
    inviteDisplayName = "",
    invitePromptedCode = "",
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
  async function saveUiPreferences() {
    uiPreferences = {
      ...uiPreferences,
      collapsed: Object.keys(collapsed).filter((id) => collapsed[id]),
      favorite_servers: [...favoriteServers],
    };
    await rpc("app_ui_state", { p_data: uiPreferences });
  }
  async function loadOverviewInfo(server) {
    if (!server?.id || overviewInfo.serverId === server.id || overviewInfo.loading) return;
    overviewInfo = { serverId: server.id, createdAt: server.created_at || null, events: [], loading: true };
    const calendarChannels = (server.channels || []).filter((channel) => String(channel.type).toUpperCase() === "CALENDAR");
    const dateRequest = rpc("app_settings", {
      p_server: server.id,
      p_action: "read",
      p_data: {},
    }).catch(() => null);
    const [dateResult, ...calendarResults] = await Promise.all([
      dateRequest,
      ...calendarChannels.map(async (channel) => {
        try { return await rpc("app_feature_state", { p_channel: channel.id }); }
        catch { return {}; }
      }),
    ]);
    const events = calendarResults.flatMap((result, index) => Array.isArray(result?.events) ? result.events.map((event) => ({ ...event, channel_id: calendarChannels[index]?.id })) : [])
      .filter((event) => Number.isFinite(Date.parse(event.starts_at)) && Date.parse(event.starts_at) >= Date.now())
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    overviewInfo = {
      serverId: server.id,
      createdAt: dateResult?.server?.created_at || server.created_at || null,
      events,
      loading: false,
    };
    if (current()?.id === server.id && page === "overview") render();
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
  function memberStatus(member) {
    const emoji = member?.custom_status_emoji || member?.status_emoji || "";
    const text = member?.custom_status || "";
    if (!emoji && !text) return "";
    return `<small>${emoji ? `<span class="custom-status-emoji">${escapeHtml(emoji)}</span>` : ""}${text ? escapeHtml(text) : ""}</small>`;
  }
  function botBadge(member) {
    return member?.is_bot === true || member?.isBot === true
      ? '<span class="bot-badge">BOT</span>'
      : "";
  }
  function badgeName(badge) {
    return typeof badge === "string"
      ? badge
      : badge?.name || badge?.id || "Badge";
  }
  // Guilded badge artwork, drawn inline so it never depends on an external
  // host, a blocked image or a network round-trip. Each badge gets its own
  // accent colour and symbol on a shared dark seal.
  const BADGE_GLYPHS = (() => {
    const wrap = (color, inner) =>
      `<circle cx="12" cy="12" r="11.4" fill="#15181f"/><circle cx="12" cy="12" r="10.4" fill="none" stroke="${color}" stroke-width="1.3"/>${inner}`;
    const line = (color, d, width = 1.7) =>
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const gold = "#f5c400",
      blue = "#63b3ff",
      green = "#5ad4a0",
      violet = "#b39bff",
      orange = "#ffa14a",
      pink = "#ff86b8",
      red = "#ff7a76";
    // Ten account-age tiers share one tree family: the canopy grows with each year.
    const ACCOUNT_TIERS = [
      ["account-seed", "#7fb08a", 1],
      ["account-sprout", "#8cc86a", 2],
      ["account-bud", "#5fd17a", 3],
      ["account-sapling", "#4fd1c5", 4],
      ["account-blossom", "#5bb8fa", 5],
      ["account-redwood", "#7c8cff", 6],
      ["account-sequoia", "#a78bfa", 7],
      ["account-bristlecone", "#d670e8", 8],
      ["account-stromatolite", "#f472b6", 9],
      ["account-primordial", "#f5c400", 10],
    ];
    const tree = (color, tier) => {
      const r = Math.min(4.6, 2 + tier * 0.42);
      return wrap(
        color,
        line(color, "M12 19.8V11.6", 1.7) +
          `<circle cx="12" cy="${(11.2 - r * 0.16).toFixed(2)}" r="${r.toFixed(2)}" fill="${color}"/>` +
          `<circle cx="${(12 - r * 0.68).toFixed(2)}" cy="12.4" r="${(r * 0.6).toFixed(2)}" fill="${color}" opacity=".95"/>` +
          `<circle cx="${(12 + r * 0.68).toFixed(2)}" cy="12.4" r="${(r * 0.6).toFixed(2)}" fill="${color}" opacity=".95"/>`,
      );
    };
    return {
      ...Object.fromEntries(ACCOUNT_TIERS.map(([id, color, tier]) => [id, tree(color, tier)])),
      staff: wrap(gold, line(gold, "M12 4.6l5.6 2v4.6c0 3.6-2.3 6-5.6 7.4-3.3-1.4-5.6-3.8-5.6-7.4V6.6z") + line("#15181f", "m9.6 11.6 1.8 1.8 3.4-3.6", 1.9)),
      verified: wrap(gold, `<circle cx="12" cy="12" r="6.4" fill="#f5c400"/>` + line("#15181f", "m9.4 12.1 1.7 1.7 3.6-3.9", 1.9)),
      "early-supporter": wrap(gold, `<path d="M12 18c-3.4-2-5.6-4-5.6-6.6A3.1 3.1 0 0 1 12 9.3a3.1 3.1 0 0 1 5.6 2.1C17.6 14 15.4 16 12 18z" fill="#f5c400"/>`),
      "guilded-partner": wrap(gold, `<circle cx="9.6" cy="12" r="3.6" fill="none" stroke="${gold}" stroke-width="1.7"/><circle cx="14.4" cy="12" r="3.6" fill="none" stroke="${gold}" stroke-width="1.7"/>`),
      "guilded-house-bravery": wrap(red, `<path d="M12 4.4c3 3 4.6 5.2 4.6 7.7A4.6 4.6 0 0 1 12 16.7a4.6 4.6 0 0 1-4.6-4.6c0-2.5 1.6-4.7 4.6-7.7z" fill="${red}"/><path d="M12 10.2c1.1 1.2 1.6 2 1.6 2.9a1.6 1.6 0 0 1-3.2 0c0-.9.5-1.7 1.6-2.9z" fill="#15181f"/>`),
      "guilded-house-brilliance": wrap(violet, `<path d="M12 4.2l2 5.4 5.4 2-5.4 2-2 5.4-2-5.4-5.4-2 5.4-2z" fill="${violet}"/>`),
      "guilded-house-balance": wrap(green, line(green, "M12 5.4v13M6.6 8.2h10.8") + line(green, "M8.2 8.2 5.8 13h4.8zM15.8 8.2 13.4 13h4.8z", 1.5)),
      "guilded-events-attendee": wrap(gold, `<path d="M5 9.4a2.6 2.6 0 0 0 0 5.2v2.2h14v-2.2a2.6 2.6 0 0 1 0-5.2V7.2H5z" fill="none" stroke="${gold}" stroke-width="1.5"/>` + line(gold, "M12 8.6l.9 2 2.1.3-1.6 1.5.4 2.1-1.8-1-1.8 1 .4-2.1-1.6-1.5 2.1-.3z", 1.1)),
      "guilded-events-attendee-legacy": wrap(gold, line(gold, "M8 7.4h8M8 11h8M8 14.6h5")),
      "guilded-bug-hunter": wrap(green, `<ellipse cx="12" cy="13" rx="3.4" ry="4.2" fill="${green}"/>` + line(green, "M12 8.2V6M8.6 9.4 6.8 8M15.4 9.4l1.8-1.4M8.3 13H5.8M15.7 13h2.5M8.6 16.6 6.8 18M15.4 16.6l1.8 1.4", 1.4)),
      "guilded-certified-moderator": wrap(gold, `<path d="M12 4.6l5.6 2v4.6c0 3.6-2.3 6-5.6 7.4-3.3-1.4-5.6-3.8-5.6-7.4V6.6z" fill="none" stroke="${gold}" stroke-width="1.4"/>` + line(gold, "m12 8.3 1.1 2.3 2.5.3-1.9 1.7.5 2.5-2.2-1.3-2.2 1.3.5-2.5-1.9-1.7 2.5-.3z", 1)),
      "guilded-active-developer": wrap(blue, line(blue, "m9.4 8.6-3.6 3.4 3.6 3.4M14.6 8.6l3.6 3.4-3.6 3.4M13.2 6.8l-2.4 10.4", 1.6)),
      "guilded-verified-bot-developer-legacy": wrap(blue, `<rect x="7.2" y="9" width="9.6" height="7.4" rx="2" fill="none" stroke="${blue}" stroke-width="1.5"/>` + line(blue, "M12 9V6.6M12 6.6h.01") + `<circle cx="10" cy="12.6" r="0.9" fill="${blue}"/><circle cx="14" cy="12.6" r="0.9" fill="${blue}"/>`),
      "guilded-premium-subscriber": wrap(pink, `<path d="M7 7.2h10l2 3.4-7 8.6-7-8.6z" fill="${pink}"/><path d="M9.4 7.2 12 18.4l2.6-11.2z" fill="#15181f" opacity=".25"/>`),
      "guilded-server-booster": wrap(orange, `<path d="M12 4.4c3.2 2.1 4.4 5 4.4 8l-2.2 3.4h-4.4L7.6 12.4c0-3 1.2-5.9 4.4-8z" fill="${orange}"/><circle cx="12" cy="10" r="1.8" fill="#15181f"/><path d="M10 17.4l2 2.6 2-2.6z" fill="${orange}"/>`),
      "guilded-verified-bot": wrap(blue, `<rect x="7.2" y="9" width="9.6" height="7.4" rx="2" fill="${blue}"/>` + line(blue, "M12 9V6.6") + `<circle cx="10" cy="12.6" r="0.9" fill="#15181f"/><circle cx="14" cy="12.6" r="0.9" fill="#15181f"/>`),
      "guilded-early-verified-bot-developer": wrap(blue, `<rect x="7.2" y="9.6" width="9.6" height="6.8" rx="2" fill="none" stroke="${blue}" stroke-width="1.5"/>` + line(blue, "M12 9.6V7.2") + `<circle cx="10" cy="12.8" r="0.8" fill="${blue}"/><circle cx="14" cy="12.8" r="0.8" fill="${blue}"/>` + line(gold, "m12 4.2.8 1.8 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2z", 0.9)),
      "guilded-community-moderator": wrap(gold, `<circle cx="12" cy="10.4" r="4.2" fill="none" stroke="${gold}" stroke-width="1.5"/>` + line(gold, "m9.7 13.6-1.4 6 3.7-2 3.7 2-1.4-6", 1.5)),
      "guilded-event-staff": wrap(gold, `<rect x="5.6" y="7" width="12.8" height="11" rx="1.6" fill="none" stroke="${gold}" stroke-width="1.5"/>` + line(gold, "M5.6 10.4h12.8M9.2 5.6v2.8M14.8 5.6v2.8m-6.3 6.1 1.6 1.6 3-3.2", 1.4)),
      "guilded-event-participant": wrap(gold, `<rect x="5.6" y="7" width="12.8" height="11" rx="1.6" fill="none" stroke="${gold}" stroke-width="1.5"/>` + line(gold, "M5.6 10.4h12.8M9.2 5.6v2.8M14.8 5.6v2.8", 1.4)),
      "guilded-seasonal-event": wrap(blue, line(blue, "M12 5v14M6 8.5l12 7M18 8.5l-12 7", 1.5) + line(blue, "m9.8 5.9 2.2 1.1 2.2-1.1M9.8 18.1l2.2-1.1 2.2 1.1", 1.2)),
      "guilded-game-developer": wrap(violet, `<path d="M7.4 9h9.2a3 3 0 0 1 2.9 3.7l-.6 3a2.2 2.2 0 0 1-3.7.9L13.8 15h-3.6l-1.4 1.6a2.2 2.2 0 0 1-3.7-.9l-.6-3A3 3 0 0 1 7.4 9z" fill="${violet}"/>` + line("#15181f", "M9.2 11.8v2.2M8.1 12.9h2.2", 1.2) + `<circle cx="15" cy="12.4" r="0.8" fill="#15181f"/><circle cx="16.4" cy="13.8" r="0.8" fill="#15181f"/>`),
      "qa-security-13e0a605": wrap(green, line(green, "M8.2 11V9.4a3.8 3.8 0 0 1 7.6 0V11") + `<rect x="7.2" y="11" width="9.6" height="7.2" rx="2" fill="none" stroke="${green}" stroke-width="1.6"/>` + `<circle cx="12" cy="14.6" r="1.1" fill="${green}"/>`),
      "hypesquad-bravery": wrap(red, `<path d="M12 4.4c3 3 4.6 5.2 4.6 7.7A4.6 4.6 0 0 1 12 16.7a4.6 4.6 0 0 1-4.6-4.6c0-2.5 1.6-4.7 4.6-7.7z" fill="${red}"/><path d="M12 10.2c1.1 1.2 1.6 2 1.6 2.9a1.6 1.6 0 0 1-3.2 0c0-.9.5-1.7 1.6-2.9z" fill="#15181f"/>`),
      "hypesquad-brilliance": wrap(violet, `<path d="M12 4.2l2 5.4 5.4 2-5.4 2-2 5.4-2-5.4-5.4-2 5.4-2z" fill="${violet}"/>`),
      "hypesquad-balance": wrap(green, line(green, "M12 5.4v13M6.6 8.2h10.8") + line(green, "M8.2 8.2 5.8 13h4.8zM15.8 8.2 13.4 13h4.8z", 1.5)),
      "legacy-username": wrap(blue, `<circle cx="10.2" cy="12" r="3.2" fill="none" stroke="${blue}" stroke-width="1.6"/><path d="M13.4 12v1.4a1.6 1.6 0 0 0 3.2 0V12" fill="none" stroke="${blue}" stroke-width="1.5"/>`),
      "server-owner": wrap(gold, `<path d="m5.4 16.4 1-7 3.2 3 2.4-4.2 2.4 4.2 3.2-3 1 7z" fill="${gold}"/>` + line(gold, "M5.4 18.6h13.2", 1.5)),
      "spark-supporter": wrap(gold, `<path d="M13.2 4 7.4 13h3.4l-1 7 6.2-9.4h-3.6z" fill="${gold}"/>`),
      "gift-giver": wrap(red, `<rect x="5.4" y="9.8" width="13.2" height="8.4" rx="1.4" fill="${red}"/><rect x="4.6" y="7.6" width="14.8" height="2.2" rx="1" fill="${red}"/>` + line("#15181f", "M12 9.8v8.4", 1.4) + `<path d="M12 7.6c-1.4-2.6-4.4-2.4-4.4-.6 0 1.2 1.7 1.6 4.4.6zm0 0c1.4-2.6 4.4-2.4 4.4-.6 0 1.2-1.7 1.6-4.4.6z" fill="${red}"/>`),
    };
  })();
  function badgeTitle(badge) {
    const name = badgeName(badge),
      description = typeof badge === "object" ? badge?.description : "";
    return description ? `${name} — ${description}` : name;
  }
  function badgeIcon(badge) {
    const url = typeof badge === "object" ? badge?.icon_url : "";
    // The CSP allows https images everywhere now, so admin artwork loads from
    // any host. The drawn glyph sits underneath, so a dead URL simply falls
    // back instead of showing a broken image.
    const id = String(typeof badge === "object" ? badge?.id || "" : badge || "");
    const glyph = BADGE_GLYPHS[id];
    const fallback = glyph
      ? `<svg class="badge-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${glyph}</svg>`
      : `<span class="badge-initial">${escapeHtml((badgeName(badge)[0] || "✦").toUpperCase())}</span>`;
    const usable = /^https:\/\//i.test(url || "") || /^data:image\//i.test(url || "") || /^\/assets\//.test(url || "");
    if (!usable) return fallback;
    return `<span class="badge-icon-stack">${fallback}<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" data-badge-art></span>`;
  }
  // The official Guilded account carries this exact pill wherever its name shows.
  function officialTag(user) {
    return user?.is_official === true
      ? '<span class="official-tag" title="Official Guilded account"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m2.3 6.2 2.3 2.2 4.7-4.9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>OFFICIAL</span>'
      : "";
  }
  function userHandle(user) {
    if (!user) return "";
    // The official account is branded by display name; everyone else is identified
    // by the username that is part of their handle.
    const name = user.is_official ? user.name || user.username : user.username || user.name || "member";
    return user.discriminator ? `${name}#${user.discriminator}` : name;
  }
  // display_scope decides where a badge may appear: profile-only badges never
  // sit inline, hidden badges never appear, and ownership badges only show in
  // the server that account owns.
  function visibleBadges(user, where = "inline") {
    const badges = Array.isArray(user?.badges) ? user.badges : [];
    const owner = String(current()?.owner || "");
    const ownsHere = Boolean(owner) && (owner === String(user?.id || "") || owner === String(user?.user_id || ""));
    return badges.filter((badge) => {
      const scope = typeof badge === "object" ? badge.display_scope || "everywhere" : "everywhere";
      if (scope === "hidden") return false;
      if (scope === "profile") return where === "profile";
      if (scope === "owned_servers") return where === "profile" || ownsHere;
      return true;
    });
  }
  function badgeMarkup(user, limit = 3) {
    const badges = visibleBadges(user, "inline");
    return badges
      .slice(0, limit)
      .map((badge) => `<span class="v3-inline-badge" title="${escapeHtml(badgeTitle(badge))}">${badgeIcon(badge)}</span>`)
      .join("");
  }
  function loadServerBadges() {
    return rpc("app_server_badges")
      .then((rows) => {
        const next = {};
        (Array.isArray(rows) ? rows : []).forEach((row) => {
          (next[row.server_id] || (next[row.server_id] = [])).push(row);
        });
        serverBadges = next;
        render();
      })
      .catch((error) => console.error("[Constellation] could not load server badges", error));
  }
  function serverBadgeMarkup(serverId) {
    return (serverBadges[serverId] || [])
      .map((badge) => `<span class="server-badge" title="${escapeHtml(badge.description || badge.name)}"><img src="${escapeHtml(badge.icon_url)}" alt="${escapeHtml(badge.name)}" loading="lazy"></span>`)
      .join("");
  }
  function avatarTrigger(user, id) {
    return `<button class="v3-avatar-trigger" data-action="user-profile" data-id="${escapeHtml(id || user?.id || "")}" title="View ${escapeHtml(user?.name || "member")} profile" aria-label="View ${escapeHtml(user?.name || "member")} profile">${avatar(user)}</button>`;
  }
  function presenceLabel(status) {
    return status === "dnd" ? "Do not disturb" : status === "idle" ? "Idle" : status === "invisible" ? "Offline" : "Online";
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
  function showForcedRename() {
    if (document.querySelector("#forced-rename")) return;
    const wrap = document.createElement("div");
    wrap.id = "forced-rename";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(0,0,0,.6);font-family:inherit";
    wrap.innerHTML = `<form style="background:#2b2d31;color:#f2f3f5;padding:24px;border-radius:8px;width:min(420px,92vw);display:grid;gap:12px">
      <h2 style="margin:0;font-size:20px">Choose a new username</h2>
      <p style="margin:0;color:#b5bac1">Your username needs to be unique before you continue. Letters, numbers, dots, dashes and underscores, 2 to 32 characters.</p>
      <input name="username" required minlength="2" maxlength="32" pattern="[A-Za-z0-9._-]{2,32}" autocomplete="off" style="padding:10px;border-radius:4px;border:0;background:#1e1f22;color:inherit">
      <p class="forced-rename-error" role="alert" style="margin:0;color:#f38ba8;min-height:1em"></p>
      <button type="submit" style="padding:10px;border:0;border-radius:4px;background:#5865f2;color:#fff;cursor:pointer">Save username</button>
    </form>`;
    const form = wrap.querySelector("form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = wrap.querySelector(".forced-rename-error");
      errorEl.textContent = "";
      try {
        await rpc("app_complete_forced_rename", { p_username: form.username.value.trim() });
        wrap.remove();
        if (state?.user) state.user.username = form.username.value.trim();
      } catch (error) {
        errorEl.textContent = errText(error);
      }
    });
    document.body.appendChild(wrap);
    form.username.focus();
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
  const relationApi = (action, payload = {}) =>
    rpc("app_message_relations", { p_action: action, p_payload: payload });
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
  function inviteCodeFromURL() {
    return new URLSearchParams(location.search).get("invite")?.trim() || "";
  }
  function clearInviteFromURL() {
    const url = new URL(location.href);
    url.searchParams.delete("invite");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  function inviteArt(invite) {
    const hasImage = !!safeMedia(invite.avatar_url),
      mark = hasImage ? `<img src="${safeMedia(invite.avatar_url)}" alt="">` : escapeHtml((invite.name || "S")[0].toUpperCase());
    return `<aside class="invite-preview-art"><div class="invite-server-mark ${hasImage ? "has-image" : ""}">${mark}</div></aside>`;
  }
  function renderInviteLanding(code) {
    const invite = invitePreviewInfo,
      inviterAvatar = safeMedia(invite.inviter_avatar)
        ? `<img src="${safeMedia(invite.inviter_avatar)}" alt="">`
        : escapeHtml((invite.inviter_name || "M")[0].toUpperCase());
    if (inviteAuthMode !== "preview") {
      const signingUp = registration,
        usernameSuggestion = inviteDisplayName.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 32);
      $("#app").innerHTML = `<div class="auth invite-auth"><main class="invite-landing"><section class="invite-preview-shell"><section class="invite-preview-copy invite-account-step"><div class="invite-inviter-avatar">${inviterAvatar}</div><p class="invite-kicker">${escapeHtml(invite.inviter_name || "A member")} invited you to join</p><h2>${escapeHtml(invite.name)}</h2><p class="invite-count">${Number(invite.member_count) || 0} ${(Number(invite.member_count) || 0) === 1 ? "member" : "members"}</p><h1 class="invite-auth-heading">${signingUp ? "Create your account" : "Log in to continue"}</h1><p class="invite-auth-copy">Use email to join this community. Your invite will be applied after sign-in.</p><form id="auth-form" class="invite-auth-form">${field("email", "Email address", "", "email")}${signingUp ? `${field("username", "Username", usernameSuggestion)}${field("displayname", "Display name", inviteDisplayName)}` : ""}${field("password", signingUp ? "Password · at least 10 characters" : "Password", "", "password")}<button class="primary invite-continue" type="submit">${signingUp ? "Create account" : "Log in"}</button><div class="error" id="autherror">${escapeHtml(invitePreviewError)}</div><div class="switch">${signingUp ? "Already have an account?" : "New to Guilded?"} <button type="button" data-action="auth-switch">${signingUp ? "Log in" : "Create an account"}</button></div></form><button class="invite-cancel" data-action="invite-back">Back to invite</button></section>${inviteArt(invite)}</section></main></div>`;
      $("#auth-form").autocomplete = "off";
      $("#email").autocomplete = "off";
      $("#email").required = true;
      $("#password").autocomplete = "off";
      $("#password").required = true;
      if (signingUp) {
        $("#password").minLength = 10;
        $("#username").required = true;
        $("#username").pattern = "[a-zA-Z0-9_.-]{3,32}";
      }
      return;
    }
    $("#app").innerHTML = `<div class="auth invite-auth"><main class="invite-landing"><section class="invite-preview-shell"><section class="invite-preview-copy invite-account-step"><div class="invite-inviter-avatar">${inviterAvatar}</div><p class="invite-kicker">Accept ${escapeHtml(invite.inviter_name || "a member")}’s invite to join</p><h2>${escapeHtml(invite.name)}</h2><div class="invite-count">${Number(invite.member_count) || 0} ${(Number(invite.member_count) || 0) === 1 ? "member" : "members"}</div><label class="invite-name-label" for="invite-display-name">What do you want to be called?</label><input id="invite-display-name" maxlength="32" autocomplete="nickname" value="${escapeHtml(inviteDisplayName)}" placeholder="Your display name"><div class="error" id="invite-error">${escapeHtml(invitePreviewError)}</div><button class="primary invite-continue" data-action="invite-signup">Continue</button><button class="invite-cancel" data-action="invite-login">Log in</button></section>${inviteArt(invite)}</section></main></div>`;
    if (!$("#invite-display-name")?.value && inviteDisplayName) $("#invite-display-name").value = inviteDisplayName;
  }
  async function openInvitePreview(code) {
    if (!code) return;
    invitePromptedCode = code;
    const invite = await rpc("app_invite_preview", { p_code: code });
    const hasServerImage = !!safeMedia(invite.avatar_url),
      serverMark = hasServerImage
        ? `<img src="${safeMedia(invite.avatar_url)}" alt="">`
        : escapeHtml((invite.name || "S")[0].toUpperCase()),
      inviterAvatar = safeMedia(invite.inviter_avatar)
        ? `<img src="${safeMedia(invite.inviter_avatar)}" alt="">`
        : escapeHtml((invite.inviter_name || "M")[0].toUpperCase());
    show(
      "",
      `<div class="invite-preview-shell"><button class="invite-close icon-button" data-action="close" aria-label="Close">${icon("close")}</button><section class="invite-preview-copy"><div class="invite-inviter-avatar">${inviterAvatar}</div><p class="invite-kicker">${escapeHtml(invite.inviter_name || "A member")} invited you to join</p><h2>${escapeHtml(invite.name)}</h2><p class="invite-count">${Number(invite.member_count) || 0} ${(Number(invite.member_count) || 0) === 1 ? "member" : "members"}</p><div class="invite-account"><span>${avatar(state.user)}</span><span><small>Joining as</small><strong>${escapeHtml(userHandle(state.user))}</strong></span></div><button class="primary invite-continue" data-action="accept-invite">Continue</button><button class="invite-cancel" data-action="close">Maybe later</button></section><aside class="invite-preview-art"><div class="invite-server-mark ${hasServerImage ? "has-image" : ""}">${serverMark}</div></aside></div>`,
    );
    modal.classList.add("invite-dialog");
    modal.dataset.inviteCode = code;
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
    delete modal.dataset.inviteCode;
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
    const inviteCode = inviteCodeFromURL();
    if (inviteCode) {
      if (invitePreviewCode === inviteCode && invitePreviewInfo) {
        renderInviteLanding(inviteCode);
        return;
      }
      if (invitePreviewCode === inviteCode && invitePreviewError) {
        $("#app").innerHTML = `<div class="auth"><div class="auth-shell"><div class="auth-brand"><span class="mark">G</span>Guilded</div><section class="authcard"><h1>Invite unavailable</h1><p>${escapeHtml(invitePreviewError)}</p><a href="/">Return home</a></section></div></div>`;
        return;
      }
      $("#app").innerHTML = '<div class="auth"><div class="auth-shell"><section class="authcard"><h1>Loading invite</h1><p>Please wait while we check this invitation.</p></section></div></div>';
      if (invitePreviewRequest !== inviteCode) {
        invitePreviewRequest = inviteCode;
        rpc("app_invite_preview", { p_code: inviteCode })
          .then((invite) => {
            invitePreviewCode = inviteCode;
            invitePreviewInfo = invite;
            invitePreviewError = "";
            if (!state) renderAuth();
          })
          .catch((error) => {
            invitePreviewCode = inviteCode;
            invitePreviewInfo = null;
            invitePreviewError = /invalid|expired|unavailable/i.test(error?.message || "")
              ? "This invite is invalid or has expired. Ask a server member for a new link."
              : "We couldn’t load this invite. Check your connection and try again.";
            if (!state) renderAuth();
          });
      }
      return;
    }
    $("#app").innerHTML =
      `<div class="auth"><div class="auth-shell"><div class="auth-brand"><span class="mark">G</span>Guilded</div><form class="authcard" id="auth-form"><h1>${registration ? "Create an account" : "Welcome back"}</h1><p>${registration ? "Choose your name and join the conversation." : "Sign in to your account to continue."}</p>${field("email", "Email address", "", "email")}${registration ? field("username", "Username") : ""}${registration ? field("displayname", "Display name") : ""}${field("password", registration ? "Password · at least 10 characters" : "Password", "", "password")}<button class="primary" type="submit">${registration ? "Create account" : "Sign in"}</button><div class="error" id="autherror"></div><div class="switch">${registration ? "Already have an account?" : "New to Guilded?"} <button type="button" data-action="auth-switch">${registration ? "Sign in" : "Create an account"}</button></div></form></div></div>`;
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
    if (!supabase) {
      state = null;
      if (renderAll) render();
      return;
    }
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    if (!sessionResult.data?.session) {
      state = null;
      sid = null;
      cid = null;
      dm = null;
      if (renderAll) render();
      return;
    }
    if (!profileEnsured) {
      await rpc("ensure_profile");
      profileEnsured = true;
    }
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
    rpc("app_must_rename").then((pending) => { if (pending) showForcedRename(); }).catch((error) => console.error("[Constellation] rename check failed", error));
    if (!badgesSynced) {
      badgesSynced = true;
      // Automatic badge requirements are evaluated once per session; the call
      // is a single RPC and never blocks the first paint.
      rpc("app_sync_badges")
        .then((badges) => {
          if (!Array.isArray(badges)) return;
          const before = JSON.stringify((state.user.badges || []).map((badge) => badge.id || badge));
          const after = JSON.stringify(badges.map((badge) => badge.id));
          state.user.badges = badges;
          if (before !== after && state?.user && !/^\/admin\/?$/.test(location.pathname)) render();
        })
        .catch((error) => console.error("[Constellation] could not sync badges", error));
    }
    if (!serverBadgesLoaded) {
      serverBadgesLoaded = true;
      loadServerBadges();
    }
    const routeServer = new URLSearchParams(location.search).get("server");
    const routeChannel = new URLSearchParams(location.search).get("channel");
    if (routeServer && routeChannel && state.servers.some((server) => server.id === routeServer && server.channels.some((channel) => channel.id === routeChannel))) {
      sid = routeServer;
      cid = routeChannel;
      dm = null;
      page = "chat";
    }
    if (!preferencesLoaded) {
      const preferences = await rpc("app_ui_state", { p_data: null });
      uiPreferences = preferences || {};
      collapsed = Object.fromEntries(
        (preferences?.collapsed || []).map((id) => [id, true]),
      );
      favoriteServers = new Set(
        (preferences?.favorite_servers || []).filter((id) =>
          state.servers.some((server) => server.id === id),
        ),
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
    if (page === "overview" && current()) loadOverviewInfo(current());
    if (renderAll) render();
    const inviteCode = inviteCodeFromURL();
    if (state && inviteCode && invitePromptedCode !== inviteCode) {
      try {
        await openInvitePreview(inviteCode);
      } catch (error) {
        invitePromptedCode = "";
        toast(/invalid|expired|unavailable/i.test(error?.message || "")
          ? "This invite is invalid or has expired."
          : "We couldn’t load this invite. Please try again.");
      }
    }
    if (page === "chat") await loadMessages();
  }
  function rail() {
    const statusEmoji = state.user?.custom_status_emoji || state.user?.status_emoji || "";
    const statusText = state.user?.custom_status || "";
    const profileStatus = statusText ? `<small>${escapeHtml(`${statusEmoji}${statusEmoji ? " " : ""}${statusText}`)}</small>` : "";
    return `<nav class="rail" aria-label="Navigation"><button class="orb brand ${!sid ? "active" : ""}" data-action="home" title="Direct messages" aria-label="Direct messages">${icon("chat")}</button><button class="orb ${serverListOpen ? "active" : ""}" data-action="server-list" title="Server list" aria-label="Server list">${icon("users")}</button><div class="divider"></div>${state.servers.map((server) => `<button class="orb ${server.id === sid ? "active" : ""} ${favoriteServers.has(server.id) ? "favorite" : ""}" data-action="server" data-id="${server.id}" title="${escapeHtml(server.name)}" aria-label="${escapeHtml(server.name)}${favoriteServers.has(server.id) ? ", favorite" : ""}">${safeMedia(server.avatar_url) ? `<img src="${safeMedia(server.avatar_url)}" alt="">` : escapeHtml((server.name || "S")[0].toUpperCase())}</button>`).join("")}<button class="orb" data-action="create-server" title="Create server" aria-label="Create server">${icon("plus", "lg")}</button><span class="rail-spacer"></span><button class="orb rail-bottom" data-action="achievements" title="Badges and achievements" aria-label="Badges and achievements">${icon("trophy")}</button><button class="orb" data-action="friends" title="Friends" aria-label="Friends">${icon("users")}</button><button class="orb" data-action="join-server" title="Discover or join a server" aria-label="Discover or join a server">${icon("compass")}</button><div class="divider"></div><button class="orb" data-action="activity" title="Activity" aria-label="Activity">${icon("sparkles")}</button><div class="legacy-profilebar"><button class="legacy-profile" data-action="profile" title="User settings"><span class="avatar-wrap">${avatar(state.user)}<i class="status-dot ${escapeHtml(state.user?.status || "online")}"></i></span><span class="legacy-profile-name"><strong>${escapeHtml(state.user?.name || "Member")}</strong>${profileStatus}</span></button><button class="icon-button mention-trigger" data-action="activity" title="Activity log" aria-label="Activity log">@</button><button class="icon-button" data-action="profile" title="User settings">${icon("settings")}</button><button class="icon-button" data-action="user-menu" title="More account options">${icon("more")}</button></div></nav>`;
  }
  function serverListRows() {
    const query = serverSearch.trim().toLocaleLowerCase();
    const list = [...(state.servers || [])]
      .filter((server) => (server.name || "").toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(favoriteServers.has(b.id)) - Number(favoriteServers.has(a.id)));
    const favorites = list.filter((server) => favoriteServers.has(server.id));
    const others = list.filter((server) => !favoriteServers.has(server.id));
    const group = (title, servers) => servers.length
      ? `<section class="server-list-group"><h3>${escapeHtml(title)}</h3>${servers.map((server) => `<div class="server-list-row"><button class="server-list-select" data-action="server" data-id="${server.id}"><span class="server-list-avatar">${safeMedia(server.avatar_url) ? `<img src="${safeMedia(server.avatar_url)}" alt="">` : escapeHtml((server.name || "S")[0].toUpperCase())}</span><span><strong>${escapeHtml(server.name)}</strong><small>${(server.members || []).length} ${(server.members || []).length === 1 ? "member" : "members"}</small></span></button><button class="server-list-favorite ${favoriteServers.has(server.id) ? "selected" : ""}" data-action="favorite-server" data-id="${server.id}" aria-pressed="${favoriteServers.has(server.id)}" title="${favoriteServers.has(server.id) ? "Remove from favorites" : "Add to favorites"}">${icon("star", "sm")}</button></div>`).join("")}</section>`
      : "";
    return `${group("Favorites", favorites)}${group("All servers", others)}${list.length ? "" : '<p class="server-list-empty">No servers match your search.</p>'}`;
  }
  function serverListPanel() {
    return `<aside class="server-list-panel" aria-label="Server list"><header><strong>Communities</strong><button class="icon-button" data-action="close-server-list" aria-label="Close server list">${icon("close")}</button></header><input id="server-list-search" type="search" placeholder="Search servers" value="${escapeHtml(serverSearch)}" aria-label="Search servers"><div class="server-list-groups">${serverListRows()}</div><footer><button data-action="create-server">${icon("plus", "sm")} Create a server</button><button data-action="join-server">${icon("invite", "sm")} Join a server</button></footer></aside>`;
  }
  function serverHeader(server) {
    if (!server)
      return `<header class="serverhead"><button class="serverhead-title" data-action="home"><span class="server-avatar">${icon("chat")}</span><span class="server-title">Direct messages<small>Your conversations</small></span></button></header>`;
    const banner = safeMedia(server.banner_url);
    return `<header class="serverhead server-head-managed ${banner ? "has-banner" : ""}" ${banner ? `style="background-image:url('${banner}')"` : ""}><button class="serverhead-title" data-action="server-menu"><span class="server-avatar">${safeMedia(server.avatar_url) ? `<img src="${safeMedia(server.avatar_url)}" alt="">` : escapeHtml(server.name[0].toUpperCase())}</span><span class="server-title">${escapeHtml(server.name)}<small>Server home</small></span>${serverBadgeMarkup(server.id)}${icon("chevron")}</button><div class="serverhead-actions"><button data-action="invite">${icon("invite", "sm")}<span>Invite</span></button>${can("manage_server") ? `<button data-action="settings">${icon("settings", "sm")}<span>Settings</span></button>` : ""}</div></header>`;
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
    const glyph = (channel) => {
      const type = String(channel.type || "TEXT").toUpperCase();
      if (channel.allowed?.length || channel.category_allowed?.length) return "lock";
      if (type === "VOICE") return "mic";
      if (type === "ANNOUNCEMENT" || channel.readonly) return "megaphone";
      if (type === "CALENDAR") return "calendar";
      if (type === "FORUM") return "list";
      if (type === "DOCS") return "audit";
      if (type === "MEDIA") return "image";
      if (type === "LIST") return "check";
      return "hash";
    };
    return groups.map(({ cat, channels }) => {
      const label = cat.id === "uncategorized" ? "Other channels" : ({ "TEXT CHANNELS": "Text Channels", INFORMATION: "Information" }[cat.name] || cat.name);
      return `<div class="cat-head" data-category="${cat.id}" draggable="${can("manage_channels") && cat.id !== "uncategorized"}"><button class="cat-toggle ${collapsed[cat.id] ? "rotated" : ""}" data-action="toggle-category" data-id="${cat.id}">${icon("chevron", "sm")}<span>${escapeHtml(label)}</span></button>${can("manage_channels") && cat.id !== "uncategorized" ? `<span class="cat-actions"><button class="icon-button" data-action="new-channel" data-category="${cat.id}" title="Create channel">${icon("plus", "sm")}</button><button class="icon-button" data-action="edit-category" data-id="${cat.id}" title="Category settings">${icon("settings", "sm")}</button></span>` : ""}</div>${collapsed[cat.id] ? "" : channels.map((channel) => `<div class="channel-wrap" draggable="${can("manage_channels")}" data-channel="${channel.id}"><button class="channel ${cid === channel.id && page === "chat" ? "active" : ""}" data-action="channel" data-id="${channel.id}">${icon(glyph(channel), "sm")}<span class="channel-name">${escapeHtml(channel.name)}</span></button>${can("manage_channels") ? `<span class="channel-actions"><button class="icon-button" data-action="invite" title="Invite people">${icon("invite", "sm")}</button><button class="icon-button" data-action="edit-channel" data-id="${channel.id}" title="Channel settings">${icon("settings", "sm")}</button></span>` : ""}</div>`).join("")}`;
    }).join("");
  }
  function sidebar() {
    const server = current();
    const statusText = state.user?.custom_status || "";
    const statusEmoji = state.user?.custom_status_emoji || state.user?.status_emoji || "";
    const customStatus = statusText || statusEmoji
      ? `<small>${statusEmoji ? `<span class="custom-status-emoji">${escapeHtml(statusEmoji)}</span>` : ""}${statusText ? escapeHtml(statusText) : ""}</small>`
      : "";
    return `<aside class="sidebar">${serverHeader(server)}<button class="sidebar-search" data-action="quick-switch" aria-label="Search channels and members">${icon("search", "sm")}<span>Ctrl+S to search</span></button><nav class="nav" aria-label="Sections and channels">${server ? `<div class="nav-heading">Sections</div><button class="nav-item ${page === "overview" ? "active" : ""}" data-action="overview">${icon("home", "sm")}<span>Overview</span></button><button class="nav-item" data-action="members-page">${icon("users", "sm")}<span>Members</span></button>${can("manage_server") || can("view_audit") ? `<button class="nav-item ${page === "audit" ? "active" : ""}" data-action="audit-page">${icon("audit", "sm")}<span>Audit log</span></button>` : ""}<div class="nav-heading">Channels ${can("manage_channels") ? `<button data-action="new-category" title="Create category">${icon("plus", "sm")}</button>` : ""}</div>${categoryNav(server)}` : `<div class="nav-heading">Direct messages <button data-action="new-dm" title="New conversation">${icon("plus", "sm")}</button></div>${[...new Map([...(state.contacts || []), ...(dm ? [dm] : [])].map((user) => [user.id, user])).values()].map((user) => `<button class="channel ${dm?.id === user.id ? "active" : ""}" data-action="dm" data-id="${user.id}">${avatar(user)}<span class="channel-name">${escapeHtml(user.name)}</span>${officialTag(user)}</button>`).join("")}<button class="channel" data-action="new-dm">${icon("plus", "sm")}<span>New conversation</span></button>`}</nav><footer class="profilebar"><button class="profile-identity" data-action="profile" title="View your profile"><span class="avatar-wrap">${avatar(state.user)}<i class="status-dot ${escapeHtml(state.user.status || "online")}"></i></span><span class="who"><strong>${escapeHtml(state.user.name)}</strong>${customStatus}</span></button><button class="icon-button mention-trigger" data-action="activity" title="Activity log" aria-label="Activity log">@</button><button class="icon-button" data-action="profile" title="User settings">${icon("settings")}</button><button class="icon-button" data-action="user-menu" title="More account options">${icon("more")}</button></footer></aside>`;
  }
  function memberList() {
    const server = current();
    if (!server) return '<aside class="members"></aside>';
    if (rightPanelTab === "threads") {
      const thread = threadData;
      const threadView = thread ? `<section class="thread-panel"><button class="thread-back" data-action="threads-back">‹ Threads</button><div class="thread-title"><strong>Thread</strong>${thread.archived ? '<span class="thread-archived">Archived thread</span>' : ""}</div><article class="thread-root"><strong>${escapeHtml(thread.root?.author?.name || person(thread.root?.sender)?.name || "Member")}</strong><p>${escapeHtml(thread.root?.body || "")}</p></article><div class="thread-replies">${(thread.replies || []).map((reply) => `<article><strong>${escapeHtml(reply.author?.name || person(reply.author_id)?.name || "Member")}</strong><p>${escapeHtml(reply.body)}</p></article>`).join("") || '<p class="muted">No replies yet.</p>'}</div>${!thread.archived || can("manage_messages") ? `<form id="thread-compose" class="thread-compose"><textarea id="thread-message" maxlength="4000" placeholder="Reply to thread"></textarea><button class="primary">Reply</button></form>` : ""}${can("manage_messages") ? `<button class="thread-archive" data-action="thread-archive" data-archived="${!thread.archived}">${thread.archived ? "Unarchive thread" : "Archive thread"}</button>` : ""}</section>` : `<div class="thread-list">${(messageRelations.threads || []).map((item) => { const root=messages.find((message)=>message.id===item.root_message_id); return `<button class="thread-list-item" data-action="thread-open" data-id="${item.id}"><strong>${escapeHtml(root?.body || "Message thread")}</strong><small>${Number(item.reply_count)||0} ${(Number(item.reply_count)||0)===1?"reply":"replies"}${item.archived?" · Archived thread":""}</small></button>`; }).join("") || '<p class="muted thread-empty">No threads in this channel yet.</p>'}</div>`;
      return `<aside class="members thread-sidebar" aria-label="Threads"><div class="member-tabs"><button data-action="right-tab" data-tab="members" aria-label="Members" title="Members">${icon("users")}</button><button class="active" data-action="right-tab" data-tab="threads" aria-label="Threads" title="Threads">${icon("list")}</button></div>${threadView}</aside>`;
    }
    const members = (server.members || []).filter(Boolean), roles = server.roles || [];
    const groups = new Map();
    for (const member of members) {
      const role = topRole(member),
        name = ["invisible", "offline"].includes(member.status)
          ? "Offline"
          : role?.id || "Member";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(member);
    }
    const rank = (id) =>
      id === "Offline" ? 10001 : id === "Member" ? 10000 : roles.findIndex((r) => r.id === id);
    const ordered = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
    const about = page === "overview" ? `<section class="overview-about"><h2>About</h2><p><strong>${members.length}</strong> ${members.length === 1 ? "member" : "members"}</p><p>Created ${overviewInfo.createdAt ? new Date(overviewInfo.createdAt).toLocaleDateString() : "date unavailable"}</p></section>` : "";
    return `<aside class="members" aria-label="Members"><div class="member-tabs"><button class="active" data-action="right-tab" data-tab="members" aria-label="Members" title="Members">${icon("users")}</button><button data-action="right-tab" data-tab="threads" aria-label="Threads" title="Threads">${icon("list")}</button></div>${about}${ordered
      .map(
        ([id, people]) =>
          `<section class="member-group"><h2>${people.length} ${escapeHtml(roles.find((r) => r.id === id)?.name || id)}</h2>${people
            .map((member) => {
              const role = topRole(member);
              const offline = ["invisible", "offline"].includes(member.status);
              return `<button class="member ${offline ? "offline" : ""}" title="@${escapeHtml(userHandle(member))}" data-action="member" data-id="${member.id}"><span class="avatar-wrap">${avatar(member)}<i class="status-dot ${escapeHtml(member.status || "online")}"></i></span><span class="who"><strong><span style="${roleTextStyle(role)}">${escapeHtml(member.name || "Member")}</span>${officialTag(member)}${roleIcon(role)}${badgeMarkup(member, 2)}${botBadge(member)}</strong>${memberStatus(member)}</span></button>`;
            })
            .join("")}</section>`,
      ).join("")}<button class="member-invite" data-action="invite">${icon("invite")}<span>Invite</span></button></aside>`;
  }
  function topbar(title, topic = "", kind = "hash") {
    return `<header class="topbar"><button class="icon-button mobiletoggle" data-action="nav" aria-label="Open navigation">${icon("menu")}</button>${icon(kind)}<strong>${escapeHtml(title)}</strong>${topic ? `<span class="topic">${escapeHtml(topic)}</span>` : '<span class="topic"></span>'}<div class="top-actions"><button class="icon-button" data-action="search-open" title="Search everything" aria-label="Search everything">${icon("search")}</button>${page === "chat" ? `<input class="top-search" id="top-search" aria-label="Search messages" placeholder="Search messages — Enter for everything" value="${escapeHtml(search)}"><button class="icon-button" data-action="pins" title="${pins ? "Show all messages" : "Pinned messages"}">${icon("pin")}</button><button class="icon-button" data-action="channel-menu" title="More channel options">${icon("more")}</button>` : ""}${current() ? `<button class="icon-button" data-action="memberlist" title="Toggle members">${icon("users")}</button>` : ""}</div></header>`;
  }
  function overview() {
    const s = current();
    const banner = safeMedia(s?.banner_url),
      avatarUrl = safeMedia(s?.avatar_url),
      latest = s?.announcements || [];
    const events = overviewInfo.serverId === s?.id ? overviewInfo.events : [];
    const bannerArt = banner ? "" : `<div class="overview-art" aria-hidden="true"><span class="overview-mark">#</span><span class="overview-art-icon art-headphones">${icon("headphones")}</span><span class="overview-art-icon art-sparkles">${icon("sparkles")}</span><span class="overview-art-icon art-megaphone">${icon("megaphone")}</span><span class="overview-art-icon art-trophy">${icon("trophy")}</span><svg class="overview-controller" viewBox="0 0 64 48"><path class="controller-shell" d="M15 9h34c5 0 8 3 10 9l4 14c1 5-3 9-7 8L43 31H21L8 40c-4 1-8-3-7-8l4-14c2-6 5-9 10-9Z"/><path class="controller-detail" d="M18 16v12m-6-6h12"/><circle class="controller-detail" cx="45" cy="19" r="2"/><circle class="controller-detail" cx="51" cy="25" r="2"/></svg></div>`;
    const latestSection = latest.length
      ? `<div class="announcements-heading"><h2>Latest announcements</h2></div><div class="overview-cards">${latest.map((item) => `<button class="overview-card" data-action="channel" data-id="${item.channel_id}"><h3>${escapeHtml(item.body)}</h3><p>${avatar(item.author)} ${escapeHtml(item.author?.name || "Member")} · ${dayLabel(item.created)}</p><small>in ${escapeHtml(item.channel)}</small></button>`).join("")}</div>`
      : "";
    const eventCards = events.length
      ? events.slice(0, 5).map((event) => {
          const response = (event.rsvps || []).find((rsvp) => rsvp.user_id === state.user.id)?.status;
          const going = (event.rsvps || []).filter((rsvp) => rsvp.status === "going").length;
          return `<article class="overview-card"><h3>${escapeHtml(event.title || "Event")}</h3><p>${going} ${going === 1 ? "person" : "people"} going · ${new Date(event.starts_at).toLocaleString()}</p><small>${escapeHtml(event.description || "")}</small><div class="event-rsvp" role="group" aria-label="RSVP to ${escapeHtml(event.title || "event")}"><button class="${response === "going" ? "selected" : ""}" data-action="overview-rsvp" data-channel="${event.channel_id}" data-id="${event.id}" data-status="going" title="Going" aria-label="Going">✓</button><button class="${response === "maybe" ? "selected" : ""}" data-action="overview-rsvp" data-channel="${event.channel_id}" data-id="${event.id}" data-status="maybe" title="Maybe" aria-label="Maybe">?</button><button class="${response === "declined" ? "selected" : ""}" data-action="overview-rsvp" data-channel="${event.channel_id}" data-id="${event.id}" data-status="declined" title="Can't go" aria-label="Can't go">×</button></div></article>`;
        }).join("")
      : '<p class="muted">No upcoming events</p>';
    return `${topbar("Overview", "", "home")}<div class="overview-scroll"><div class="overview-banner" ${banner ? `style="background-image:url('${banner}')"` : ""}>${bannerArt}</div><section class="overview-body"><div class="overview-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="">` : escapeHtml((s?.name || "C")[0].toUpperCase())}</div><h1>${escapeHtml(s?.name)}</h1><p>${escapeHtml(s?.description || "A place for your community to talk and build together.")}</p>${latestSection}<div class="announcements-heading upcoming-heading"><h2>Upcoming events</h2></div><div class="upcoming-events-shell"><div class="overview-cards upcoming-events" id="overview-events">${eventCards}</div>${events.length > 2 ? `<button class="upcoming-events-next" data-action="overview-events-next" aria-label="Show more upcoming events">${icon("chevron", "sm")}</button>` : ""}</div></section></div>`;
  }
  function chatView() {
    const s = current(),
      channel = s?.channels.find((item) => item.id === cid);
    const type = channel?.type?.toUpperCase();
    const channelIcon = type === "VOICE" ? "mic" : type === "CALENDAR" ? "calendar" : type === "FORUM" ? "list" : type === "DOCS" ? "audit" : type === "MEDIA" ? "image" : type === "LIST" ? "check" : channel?.readonly ? "megaphone" : "hash";
    const target = replyTarget && messages.find((item) => item.id === replyTarget);
    return `${topbar(dm ? userHandle(dm) : channel?.name || "Channel", dm ? "Direct message" : channel?.topic || "", dm ? "chat" : channelIcon)}<div class="timeline" id="timeline"></div><form id="compose" class="composer">${target ? `<div class="reply-bar"><span class="reply-connector"></span><span class="reply-context"><span>Replying to</span>${avatar(person(target.sender), "reply-context-avatar")}<strong>${escapeHtml(person(target.sender)?.name || "Member")}</strong></span>${can("private_replies") && !dm ? `<button type="button" class="reply-private ${privateReply?"enabled":""}" data-action="reply-private" aria-label="Private reply" title="Private reply" aria-pressed="${privateReply}">${icon("eye", "sm")}</button>` : ""}<button type="button" class="reply-mention ${replyMention?"enabled":""}" data-action="reply-mention" aria-label="Mention parent author" title="Mention parent author" aria-pressed="${replyMention}">@</button><button type="button" class="reply-cancel" data-action="reply-cancel" aria-label="Cancel reply" title="Cancel reply">${icon("close", "sm")}</button></div>` : ""}<div class="composebox"><button class="icon-button attach" type="button" data-action="attach" title="Add an attachment" aria-label="Add an attachment">${icon("plus", "lg")}</button><input id="chat-attachment" type="file" hidden multiple><textarea id="message" maxlength="4000" aria-label="Message" ${dm?.is_official ? "disabled" : ""} placeholder="Message ${escapeHtml(dm ? "@" + userHandle(dm) : "#" + (channel?.name || "channel"))}"></textarea><button class="icon-button" type="button" data-action="poll-create" title="Create a poll" aria-label="Create a poll">${icon("poll")}</button><button class="icon-button" type="button" data-action="emoji" title="Insert emoji">${icon("smile")}</button><button class="primary send" title="Send message" aria-label="Send message" ${dm?.is_official ? "disabled" : ""}>${icon("send", "sm")}</button></div>${pendingAttachments.length ? `<div class="pending-files">${pendingAttachments.map((x) => `<span>${escapeHtml(x.name)} · ${Math.ceil(x.size / 1024)} KB</span>`).join("")}</div>` : ""}<small>${dm?.is_official ? "Official announcements are read-only." : "Enter to send · Shift + Enter for a new line"}</small></form>`;
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
    if (/^\/admin\/?$/.test(location.pathname)) {
      if (!state?.user?.is_platform_staff) {
        $("#app").innerHTML = '<main class="not-found"><span class="mark">G</span><h1>This page does not exist</h1><p>Check the address and try again.</p><a href="/">Back to Guilded</a></main>';
        return;
      }
      window.renderBadgeIcon = (badge) => badgeIcon(badge);
      if (window.renderStaffPage)
        window.renderStaffPage({
          rpc,
          user: state.user,
          imageApi: ["localhost", "127.0.0.1"].includes(location.hostname)
            ? "/api/image-tools"
            : `${config.supabaseUrl}/functions/v1/image-tools`,
          imageKey: config.supabasePublishableKey,
          getToken: async () =>
            (await supabase.auth.getSession()).data.session?.access_token || "",
          storage: {
            uploadBadgeIcon: async (blob, ext = "png") => {
              const path = `badges/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
              const { error } = await supabase.storage
                .from("community-media")
                .upload(path, blob, {
                  cacheControl: "31536000",
                  contentType: blob.type || `image/${ext}`,
                  upsert: false,
                });
              if (error) throw error;
              return supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
            },
            sign: async (path) => {
              const { data } = await supabase.storage
                .from("attachments")
                .createSignedUrl(path, 3600);
              return data?.signedUrl || "";
            },
            remove: async (path) => {
              const { error } = await supabase.storage
                .from("attachments")
                .remove([path]);
              if (error) throw error;
            },
          },
        });
      else $("#app").innerHTML = '<main class="not-found"><h1>Staff tools unavailable</h1><p>Reload Guilded to try again.</p></main>';
      return;
    }
    if (!state) {
      renderAuth();
      return;
    }
    if (state.user?.suspended_reason) {
      $("#app").innerHTML = `<main class="suspended-screen"><div class="suspended-card"><span class="suspended-mark">!</span><h1>Your account is suspended</h1><p>${escapeHtml(state.user.suspended_reason)}</p><button class="primary" data-action="logout">Sign out</button></div></main>`;
      return;
    }
    const server = current();
    if (page === "overview" && server && overviewInfo.serverId !== server.id && !overviewInfo.loading) loadOverviewInfo(server);
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
      `<div class="layout ${membersVisible ? "" : "members-hidden"} ${serverListOpen ? "server-list-open" : ""} ${uiPreferences.legacy_navigation ? "legacy-nav" : ""}">${rail()}${serverListOpen ? serverListPanel() : ""}${sidebar()}<main class="main">${server ? (page === "overview" ? overview() : page === "audit" && (can("manage_server") || can("view_audit")) ? auditView() : isFeature ? featureView() : chatView()) : dm ? chatView() : `<section class="empty-home"><div class="home-mark">C</div><h1>Your conversations start here</h1><p>Open a server, create your own, or send a direct message.</p><div class="actions"><button class="primary" data-action="create-server">Create a server</button><button class="secondary" data-action="join-server">Join a server</button></div><button data-action="new-dm">Start a direct message</button></section>`}</main>${memberList()}</div>`;
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
    const channelArg = dm ? null : cid;
    // Replies and threads change rarely, so refresh them when the channel
    // changes or every 12 seconds instead of on every poll.
    const needRelations = !dm && (key !== relationsFor || Date.now() - relationsLoadedAt > 12000);
    // Messages, my own reactions and the reply/thread index travel together so
    // opening a channel costs one round trip instead of three.
    const [data, mine, related] = await Promise.all([
      rpc("app_messages", { p_channel: channelArg, p_user: dm?.id || null }),
      rpc("app_my_reactions", { p_channel: channelArg, p_user: dm?.id || null }).catch(() => []),
      needRelations
        ? relationApi("list", { channel: cid })
            .then((result) => {
              relationsFor = key;
              relationsLoadedAt = Date.now();
              return result;
            })
            .catch((error) => {
              console.error("[Constellation] Could not load message replies and threads", error);
              return undefined;
            })
        : Promise.resolve(undefined),
    ]);
    if (key === (dm ? "u" + dm.id : "c" + cid)) {
      const fresh = (Array.isArray(data) ? data : []).filter(
        (item) => item && typeof item.body === "string",
      );
      const optimistic = pendingSends > 0 ? messages.filter((item) => item.pending) : [];
      messages = optimistic.length ? [...fresh, ...optimistic] : fresh;
      myReactions = new Map(
        (Array.isArray(mine) ? mine : [])
          .filter((entry) => entry && entry.message_id && entry.emoji)
          .map((entry) => [`${entry.message_id}:${entry.emoji}`, true]),
      );
      if (related !== undefined)
        messageRelations = {
          replies: Array.isArray(related?.replies) ? related.replies : [],
          threads: Array.isArray(related?.threads) ? related.threads : [],
        };
      else if (dm) messageRelations = { replies: [], threads: [] };
      const attachments = messages.flatMap((item) =>
        (item.attachments || []).map((attachment) => ({ attachment, sender: item.sender })),
      );
      await Promise.all(
        attachments
          .filter(({ attachment, sender }) =>
            (attachment.status || "approved") !== "pending" ||
            (attachment.uploaded_by || sender) === state?.user?.id ||
            Boolean(state?.user?.is_platform_staff),
          )
          .map(async ({ attachment }) => {
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
      if (file.size > 5 * 1024 * 1024)
        throw Error(`${file.name} is larger than the 5 MB limit.`);
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
  function reactionsAfterToggle(list, emoji, removing) {
    const next = [...(list || [])],
      index = next.findIndex((reaction) => reaction.emoji === emoji);
    if (index < 0) return removing ? next : [...next, { emoji, count: 1 }];
    const count = Number(next[index].count) || 0;
    if (removing) {
      if (count > 1) next[index] = { emoji, count: count - 1 };
      else next.splice(index, 1);
    } else next[index] = { emoji, count: count + 1 };
    return next;
  }
  function reactionsWithCount(list, emoji, count) {
    const next = [...(list || [])].filter((reaction) => reaction.emoji !== emoji);
    if (count > 0) next.push({ emoji, count });
    return next.sort((a, b) => a.emoji.localeCompare(b.emoji));
  }
  async function removeMessage(id) {
    const index = messages.findIndex((item) => item.id === id);
    if (index < 0) {
      await api("message/delete", { id });
      return;
    }
    const removed = messages[index];
    messages = messages.filter((item) => item.id !== id);
    renderMessages();
    try {
      await api("message/delete", { id });
    } catch (error) {
      const at = Math.min(index, messages.length);
      messages = [...messages.slice(0, at), removed, ...messages.slice(at)];
      renderMessages();
      toast(errText(error));
    }
  }
  function renderMessages() {
    const root = $("#timeline");
    if (!root) return;
    const channel = current()?.channels.find((item) => item.id === cid),
      key = JSON.stringify([messages, messageRelations, search, pins, cid, dm?.id, replyTarget]);
    if (key === lastMessageKey) return;
    lastMessageKey = key;
    const follow =
      root.scrollHeight - root.scrollTop - root.clientHeight < 90 ||
      !root.innerHTML;
    let previousDate = "", previousSender = "", previousTimestamp = 0;
    const visible = messages.filter(
      (item) =>
        (!pins || item.pinned) &&
        item.body.toLowerCase().includes(search.toLowerCase()),
    );
    const welcome = !visible.length && !search && !pins
      ? `<div class="welcome"><div class="bigicon">${icon(dm ? "chat" : "hash")}</div><h1>${dm ? "A conversation with " + escapeHtml(dm.name) : "Welcome to #" + escapeHtml(channel?.name || "general")}</h1><p>${escapeHtml(dm ? "This is the beginning of your direct messages." : channel?.topic || "This is the beginning of this channel.")}</p></div>`
      : "";
    root.innerHTML = `${welcome}${pins ? '<div class="date">Pinned messages</div>' : ""}${visible
      .map((item) => {
        const user = person(item.sender),
          role = topRole(user),
          day = dayLabel(item.created),
          grouped = item.sender === previousSender && day === previousDate && item.created - previousTimestamp < 300;
        const divider =
          day !== previousDate
            ? `<div class="date">${escapeHtml(day)}</div>`
            : "";
        previousDate = day;
        previousSender = item.sender;
        previousTimestamp = item.created;
        const attachments = (item.attachments || [])
          .map((a) => {
            const pending = (a.status || "approved") === "pending";
            const pendingVisible = (a.uploaded_by || item.sender) === state?.user?.id || Boolean(state?.user?.is_platform_staff);
            if (pending && !pendingVisible)
              return `<span class="file-chip pending" title="This file is waiting for staff review">Awaiting review</span>`;
            const url = attachmentURLs[a.id], label = `${escapeHtml(a.name)} · ${Math.ceil(a.size / 1024)} KB`;
            if (/^image\//.test(a.type) && url)
              return pending
                ? `<span class="attachment-pending"><a href="${url}" target="_blank" rel="noreferrer"><img class="chat-image pending" src="${url}" alt="${escapeHtml(a.name)}"></a><span class="attachment-pending-badge">Pending review</span></span>`
                : `<a href="${url}" target="_blank" rel="noreferrer"><img class="chat-image" src="${url}" alt="${escapeHtml(a.name)}"></a>`;
            return `<a class="file-chip${pending ? " pending" : ""}" href="${url || "#"}" target="_blank" rel="noreferrer">${label}${pending ? " · pending review" : ""}</a>`;
          })
          .join("");
        const replies = (messageRelations?.replies || []).filter((reply) => reply.parent_message_id === item.id);
        let replyRows = "";
        for (const reply of replies) {
          const replyUser = reply.author || person(reply.author_id),
            ownPrivate = reply.visibility === "private" && (reply.author_id === state.user.id || item.sender === state.user.id),
            moderatorPrivate = reply.visibility === "private" && !ownPrivate && can("manage_messages"),
            mentionsMe = (reply.body || "").toLowerCase().includes("@" + (state.user.username || state.user.name || "").toLowerCase()),
            style = ownPrivate ? "private" : moderatorPrivate ? "moderator" : mentionsMe ? "mention" : "normal",
            replyCreated = Math.floor(new Date(reply.created_at || item.created * 1000).getTime() / 1000) || item.created,
            replyDay = dayLabel(replyCreated),
            replyGrouped = reply.author_id === previousSender && replyDay === previousDate && replyCreated - previousTimestamp < 300,
            replyDivider = replyDay !== previousDate ? `<div class="date">${escapeHtml(replyDay)}</div>` : "",
            replyTime = new Date(replyCreated * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
            parentPreview = `<button class="message-reply-preview" data-action="reply-select" data-id="${item.id}" title="Reply to ${escapeHtml(user?.name || "Member")}"><span class="reply-l"></span>${avatar(user, "reply-preview-avatar")}<span class="reply-author">${escapeHtml(user?.name || "Member")}</span><span class="reply-body">${escapeHtml(item.body)}</span></button>`;
          previousDate = replyDay;
          previousSender = reply.author_id;
          previousTimestamp = replyCreated;
          replyRows += `${replyDivider}<article class="message reply-message reply-${style} ${replyGrouped ? "grouped" : ""}" data-reply="${reply.id}" data-parent-message="${item.id}">${replyGrouped ? '<span class="avatar-spacer"></span>' : avatar(replyUser)}<div class="content">${parentPreview}${replyGrouped ? "" : `<span class="name" style="${roleTextStyle(topRole(replyUser))}">${escapeHtml(replyUser?.name || "Member")}</span>${roleIcon(topRole(replyUser))}${botBadge(replyUser)}<time>${escapeHtml(replyTime)}</time>`}<p>${escapeHtml(reply.body)}</p>${ownPrivate ? `<span class="reply-label">${icon("eye", "sm")} Private reply</span>` : moderatorPrivate ? `<span class="reply-label">${icon("eye", "sm")} Moderator view</span>` : ""}</div><div class="msgtools"><button data-action="reply" data-id="${item.id}" title="Reply">${icon("chat", "sm")}</button></div></article>`;
        }
        const thread = messageRelations.threads.find((entry) => entry.root_message_id === item.id);
        const threadMarkup = thread ? `<button class="message-thread-link" data-action="thread-open" data-id="${thread.id}">View ${Number(thread.reply_count)||0} more ${(Number(thread.reply_count)||0)===1?"reply":"replies"}${thread.archived ? " · Archived thread" : ""}</button>` : "";
        const timeLabel = new Date(item.created * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const selected = replyTarget === item.id ? " reply-selected-row" : "";
        return `${divider}<article class="message ${grouped ? "grouped" : ""}${selected}" data-message="${item.id}">${grouped ? '<span class="avatar-spacer"></span>' : avatarTrigger(user, item.sender)}${grouped ? `<time class="group-timestamp" aria-label="${escapeHtml(timeLabel)}">${escapeHtml(timeLabel)}</time>` : ""}<div class="content">${grouped ? "" : `<button class="name v3-name-trigger" data-action="user-profile" data-id="${escapeHtml(item.sender)}" title="@${escapeHtml(userHandle(user))}" style="${roleTextStyle(role)}">${escapeHtml(user?.name || "Member")}</button>${officialTag(user)}${roleIcon(role)}${badgeMarkup(user, 3)}${botBadge(user)}<time>${escapeHtml(timeLabel)}</time>`}${item.pinned ? ` <span class="pinned">${icon("pin", "sm")} Pinned</span>` : ""}<p>${escapeHtml(item.body)}</p>${pollMarkup(item.poll)}${threadMarkup}${attachments}${item.edited ? '<span class="edited">(edited)</span>' : ""}<div>${(item.reactions || []).map((reaction) => `<button class="reaction" data-action="reaction" data-id="${item.id}" data-emoji="${escapeHtml(reaction.emoji)}">${escapeHtml(reaction.emoji)} ${reaction.count}</button>`).join("")}</div></div><div class="msgtools">${["👍", "💜", "✨"].map((emoji) => `<button class="quick-reaction" data-action="reaction" data-id="${item.id}" data-emoji="${emoji}" title="React ${emoji}" aria-label="React ${emoji}">${emoji}</button>`).join("")}<button data-action="bookmark" data-id="${item.id}" title="Bookmark this message" aria-label="Bookmark this message">${icon("bookmark", "sm")}</button><button data-action="reaction-picker" data-id="${item.id}" title="More reactions">${icon("smile", "sm")}</button><button data-action="reply" data-id="${item.id}" title="Reply">${icon("chat", "sm")}</button>${!thread ? `<button data-action="thread-create" data-id="${item.id}" title="Start thread">${icon("list", "sm")}</button>` : ""}${item.sender === state.user.id ? `<button data-action="edit-message" data-id="${item.id}" title="Edit">${icon("edit", "sm")}</button>` : ""}${cid && can("manage_messages") ? `<button data-action="pin" data-id="${item.id}" title="${item.pinned ? "Unpin" : "Pin"}">${icon("pin", "sm")}</button>` : ""}${item.sender === state.user.id || (cid && can("manage_messages")) ? `<button data-action="quick-delete-message" data-id="${item.id}" title="Delete message">${icon("trash", "sm")}</button>` : ""}<button data-action="message-menu" data-id="${item.id}" title="More message options">${icon("more", "sm")}</button></div></article>${replyRows}`;
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
          item.separator
            ? '<div class="context-menu-divider" role="separator"></div>'
            : `<button role="menuitem" class="${item.danger ? "danger" : ""}" data-action="${item.action}" ${item.id ? `data-id="${item.id}"` : ""} ${item.dir ? `data-dir="${item.dir}"` : ""}>${icon(item.icon, "sm")}${escapeHtml(item.label)}</button>`,
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
        { label: favoriteServers.has(s.id) ? "Remove from favorites" : "Add to favorites", action: "favorite-server", icon: "star", id: s.id },
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
  let profileToken = 0;
  function paintProfile(id, profile) {
    const member = current()?.members.find((item) => item.id === id);
    if (!profile) return;
    const mine = id === state.user.id,
      server = current(),
      banner = /^https?:\/\//.test(profile.banner_url || "") ? ` style="background-image:url('${escapeHtml(profile.banner_url)}')"` : "",
      status = profile.status || member?.status || "online",
      badges = visibleBadges(profile, "profile"),
      mutual = Array.isArray(profile.mutual_servers) ? profile.mutual_servers : [],
      roles = member && server ? server.roles.filter((role) => role.position > 0) : [],
      joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Unknown",
      roleSection = roles.length
        ? `<details class="v3-profile-roles" ${can("manage_roles") ? "open" : ""}><summary>Server roles <span>${roles.filter((role) => member.roles?.includes(role.id)).length}</span></summary><div class="v3-role-list">${roles
            .map(
              (role) =>
                `<label class="permission"><span style="${roleTextStyle(role)}">${roleIcon(role)} ${escapeHtml(role.name)}</span><input type="checkbox" data-action="assign-role" data-id="${id}" data-role="${role.id}" ${member.roles?.includes(role.id) ? "checked" : ""} ${!can("manage_roles") && !(mine && role.self_assignable) ? "disabled" : ""}></label>`,
            )
            .join("")}</div></details>`
        : "";
    show(
      "Profile",
      `<div class="v3-profile"><div class="v3-profile-banner"${banner}></div><div class="v3-profile-hero"><span class="avatar-wrap v3-profile-avatar">${avatar(profile)}<i class="status-dot ${escapeHtml(status)}"></i></span><div class="v3-profile-id"><h2 class="v3-profile-name">${escapeHtml(profile.name || "Member")}${officialTag(profile)}${botBadge(profile)}</h2><div class="v3-profile-badges v3-profile-badges-inline">${badges.length ? badges.map((badge) => `<span class="v3-badge" title="${escapeHtml(badgeTitle(badge))}"><span class="v3-badge-icon">${badgeIcon(badge)}</span>${escapeHtml(badgeName(badge))}</span>`).join("") : '<span class="v3-badge muted">No badges yet</span>'}</div><span class="v3-profile-handle">@${escapeHtml(userHandle(profile))}</span><p class="v3-profile-presence"><i class="status-dot ${escapeHtml(status)}"></i>${escapeHtml(presenceLabel(status))}</p></div></div>${profile.custom_status ? `<p class="v3-profile-custom">${escapeHtml(`${profile.custom_status_emoji || ""} ${profile.custom_status}`.trim())}</p>` : ""}<p class="v3-profile-bio">${escapeHtml(profile.bio || "This member has not written a bio yet.")}</p><div class="v3-profile-stats"><div><strong>${escapeHtml(joined)}</strong><small>Joined</small></div><div><strong>${Number(profile.mutual_count) || mutual.length}</strong><small>Mutual servers</small></div>${member ? `<div><strong>${roles.filter((role) => member.roles?.includes(role.id)).length}</strong><small>Roles here</small></div>` : ""}</div>${mutual.length ? `<div class="v3-profile-section"><h3>Shared servers</h3><div class="v3-server-chips">${mutual.slice(0, 8).map((entry) => `<span class="v3-server-chip">${entry.avatar_url ? `<img src="${escapeHtml(entry.avatar_url)}" alt="">` : `<span class="v3-server-mark">${escapeHtml((entry.name || "S")[0].toUpperCase())}</span>`}${escapeHtml(entry.name)}</span>`).join("")}</div></div>` : ""}${roleSection}<div class="v3-profile-actions">${!mine ? `<button class="primary" data-action="dm-member" data-id="${id}">Send message</button>` : `<button class="primary" data-action="profile">Edit profile</button>`}${member && !mine && can("kick_members") ? `<button class="danger" data-action="kick" data-id="${id}">Kick</button>` : ""}${member && !mine && can("ban_members") ? `<button class="danger" data-action="ban" data-id="${id}">Ban</button>` : ""}</div></div>`,
    );
    modal.dataset.profileId = id;
    modal.classList.add("v3-profile-modal");
  }
  // Paint the profile from data we already have, then refine it when the full
  // profile arrives so the card never waits on the network to appear.
  async function memberModal(id) {
    const member = current()?.members.find((item) => item.id === id);
    if (member) paintProfile(id, member);
    const token = ++profileToken;
    try {
      const fresh = await rpc("app_user_profile", { p_user: id });
      if (fresh && token === profileToken && modal.open && modal.dataset.profileId === id)
        paintProfile(id, fresh);
    } catch (error) {
      console.error("[Constellation] could not load profile", error);
    }
  }
  function pollMarkup(poll) {
    if (!poll || !Array.isArray(poll.options)) return "";
    const total = poll.options.reduce((sum, option) => sum + Number(option.votes || 0), 0);
    return `<div class="poll-card"><p class="poll-question">${escapeHtml(poll.question || "")}</p><div class="poll-options">${poll.options.map((option, index) => {
      const pct = total ? Math.round((Number(option.votes || 0) / total) * 100) : 0;
      return `<button type="button" class="poll-option ${option.voted ? "voted" : ""}" data-action="poll-vote" data-id="${escapeHtml(poll.id || "")}" data-option="${index}" ${poll.closed ? "disabled" : ""}><span class="poll-bar" style="width:${pct}%"></span><span class="poll-label">${escapeHtml(option.label)}</span><span class="poll-count">${Number(option.votes || 0)}</span></button>`;
    }).join("")}</div><div class="poll-meta"><small>${total} vote${total === 1 ? "" : "s"}${poll.multiple ? " · multiple choice" : ""}${poll.closed ? " · closed" : ""}</small>${poll.mine && !poll.closed ? `<button type="button" class="poll-close" data-action="poll-close" data-id="${escapeHtml(poll.id || "")}">Close poll</button>` : ""}</div></div>`;
  }
  function pollComposer() {
    if (!cid) { toast("Open a channel first"); return; }
    const rows = [0, 1, 2, 3]
      .map((i) => `<input name="option${i}" maxlength="80" placeholder="Option ${i + 1}${i < 2 ? "" : " (optional)"}" ${i < 2 ? "required" : ""}>`)
      .join("");
    show(
      "Create a poll",
      `<form id="poll-form" class="poll-form"><label for="poll-question">Question</label><input id="poll-question" name="question" maxlength="200" required placeholder="What should we play tonight?"><div class="poll-options">${rows}</div><label class="poll-check"><input type="checkbox" name="multiple"> Allow multiple choices</label><label for="poll-closes">Closes</label><input id="poll-closes" type="datetime-local" name="closes"></form>`,
      `<button data-action="close">Cancel</button><button class="primary" data-action="poll-submit">Publish poll</button>`,
    );
  }
  const SEARCH_HINTS = [
    ["from:", "author"],
    ["in:", "channel"],
    ["before:", "date"],
    ["after:", "date"],
    ["during:", "date"],
    ["has:", "link or file"],
    ["pinned:", "true or false"],
    ["mentions:", "user"],
  ];
  function searchHit(row) {
    const author = row.author || {};
    const when = row.created_at ? new Date(row.created_at).toLocaleString() : "";
    return `<button type="button" class="search-hit" data-action="search-jump" data-target="${escapeHtml(row.target_id || "")}" data-channel="${escapeHtml(row.channel_id || "")}" data-server="${escapeHtml(row.server_id || "")}" data-kind="${escapeHtml(row.kind)}"><span class="search-kind">${escapeHtml(row.kind)}</span><span class="search-hit-main"><strong>${escapeHtml(row.context || "")}</strong><span>${escapeHtml(row.snippet || "")}</span><small>${escapeHtml(author.name || author.username || "Unknown")}${author.discriminator ? `#${escapeHtml(author.discriminator)}` : ""} · ${escapeHtml(when)}</small></span>${row.pinned ? `<span class="search-pin">${icon("pin", "sm")}</span>` : ""}</button>`;
  }
  function renderSearch(focus = false) {
    const hints = SEARCH_HINTS.map(([token, label]) => `<button type="button" class="search-hint" data-action="search-hint" data-fill="${token}"><code>${token}</code>${escapeHtml(label)}</button>`).join("");
    const saved = savedSearchList.length
      ? `<div class="search-saved">${savedSearchList.map((item) => `<span class="saved-chip"><button type="button" data-action="run-saved" data-query="${escapeHtml(item.query)}">${escapeHtml(item.name)}</button><button type="button" class="saved-del" data-action="delete-saved" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">×</button></span>`).join("")}</div>`
      : "";
    const list = searchView === "bookmarks"
      ? bookmarkList.length
        ? bookmarkList.map((row) => searchHit({ ...row, kind: "bookmark" })).join("")
        : `<p class="search-empty">No bookmarks yet. Use the bookmark button on any message.</p>`
      : searchBusy
        ? `<p class="search-empty">Searching…</p>`
        : searchResults.length
          ? searchResults.map(searchHit).join("")
          : `<p class="search-empty">${searchQuery ? "Nothing matched that search." : "Search messages, threads, documents, forums and files."}</p>`;
    show(
      "Search",
      `<form id="search-form" class="search-panel"><div class="search-input-row"><input id="global-search" name="query" autocomplete="off" placeholder="Search everything — try from:alex has:file" value="${escapeHtml(searchQuery)}"><button class="primary" type="submit">Search</button></div><div class="search-hints">${hints}</div><div class="search-toolbar"><div class="search-tabs"><button type="button" data-action="search-view" data-id="results" class="${searchView === "results" ? "active" : ""}">Results</button><button type="button" data-action="search-view" data-id="bookmarks" class="${searchView === "bookmarks" ? "active" : ""}">Bookmarks</button></div><span class="search-save-box"><input id="search-save-name" maxlength="60" placeholder="Name this search"><button type="button" data-action="save-search">Save</button></span></div>${saved}<div class="search-results">${list}</div></form>`,
    );
    if (focus) {
      const input = $("#global-search");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }
  async function openSearch(text = "") {
    searchQuery = String(text || "").trim();
    searchBusy = true;
    renderSearch(true);
    try {
      const [results, saved, marks] = await Promise.all([
        rpc("app_search", { p_query: searchQuery, p_limit: 40 }),
        rpc("app_saved_searches"),
        rpc("app_bookmarks"),
      ]);
      searchResults = Array.isArray(results) ? results : [];
      savedSearchList = Array.isArray(saved) ? saved : [];
      bookmarkList = Array.isArray(marks) ? marks : [];
    } catch (error) {
      toast(errText(error));
    }
    searchBusy = false;
    renderSearch(true);
  }
  function searchJump(server, channel, target) {
    const fromDm = !server && !channel;
    closeModal();
    search = "";
    if (server) {
      sid = server;
      cid = channel || null;
      dm = null;
      page = channel ? "chat" : "overview";
      render();
    } else if (fromDm) {
      page = "chat";
      render();
      toast("Open that conversation from Direct messages");
    }
    if (!target) return;
    let tries = 0;
    const find = () => {
      const node = document.querySelector(`[data-message="${CSS.escape(target)}"]`);
      if (node) {
        node.scrollIntoView({ block: "center" });
        node.classList.add("flash");
        setTimeout(() => node.classList.remove("flash"), 1600);
      } else if (tries++ < 25) {
        setTimeout(find, 120);
      }
    };
    find();
  }
  const HYPESQUAD_QUIZ = [
    {
      q: "A new server opens with no rules yet. What is your first move?",
      a: [["Start a conversation right away", "bravery"], ["Write down how the place should work", "balance"], ["Read every channel before posting", "brilliance"]],
    },
    {
      q: "Someone disagrees with you publicly. You…",
      a: [["Say exactly what you think", "bravery"], ["Ask what they need to feel heard", "balance"], ["Lay out the facts point by point", "brilliance"]],
    },
    {
      q: "Pick the project you would rather lead.",
      a: [["A last-minute rescue", "bravery"], ["A long, reliable rebuild", "balance"], ["Something nobody has tried", "brilliance"]],
    },
    {
      q: "Your favourite kind of community event is…",
      a: [["A friendly tournament", "bravery"], ["A calm co-working night", "balance"], ["A puzzle or trivia hunt", "brilliance"]],
    },
    {
      q: "When a plan breaks, you reach for…",
      a: [["Action first, fix it live", "bravery"], ["The people affected", "balance"], ["The notes on how it was built", "brilliance"]],
    },
  ];
  function openHypesquadQuiz() {
    show(
      "HypeSquad quiz",
      `<p class="quiz-intro">Five questions. The house that fits you best is assigned to your account straight away.</p><form id="hypesquad-quiz-form">${HYPESQUAD_QUIZ.map(
        (item, index) =>
          `<fieldset class="quiz-question"><legend>${index + 1}. ${escapeHtml(item.q)}</legend>${item.a
            .map(([label, house]) => `<label class="permission"><span>${escapeHtml(label)}</span><input type="radio" name="hypesquad-q${index}" value="${house}"></label>`)
            .join("")}</fieldset>`,
      ).join("")}</form>`,
      `<button data-action="close">Cancel</button><button class="primary" data-action="hypesquad-quiz-submit">Reveal my house</button>`,
      true,
    );
  }
  function profileModal() {
    const user = state.user;
    show(
      "User settings",
      `<div class="settings-username"><img class="modifyuser-mark" src="/assets/modifyuser.png" alt="" aria-hidden="true"><span>Your username</span><strong>@${escapeHtml(userHandle(user))}</strong><small>Usernames are permanent. Contact staff if a name needs to be released.</small></div>${field("profile-name", "Display name", user.name)}${field("profile-avatar", "Avatar character", user.avatar || "")}<label for="profile-bio">About me</label><textarea id="profile-bio">${escapeHtml(user.bio || "")}</textarea>${field("profile-custom-status", "Custom status", user.custom_status || "")}<div class="status-emoji-field">${field("profile-custom-emoji", "Status emoji", user.custom_status_emoji || "")}</div><label for="profile-status">Presence</label><select id="profile-status">${["online", "idle", "dnd", "invisible"].map((status) => `<option ${status === user.status ? "selected" : ""}>${status}</option>`).join("")}</select>${(() => {
        const house = ((user.badges || []).find((badge) => /^(?:guilded-house|hypesquad)-/.test(String(badge.id || badge))) || {}).id?.replace(/^(?:guilded-house|hypesquad)-/, "") || user.hypesquad || "";
        return `<label for="profile-hypesquad">HypeSquad house</label><select id="profile-hypesquad"><option value="">Not set</option>${[["bravery", "Bravery"], ["brilliance", "Brilliance"], ["balance", "Balance"]].map(([id, label]) => `<option value="${id}" ${house === id ? "selected" : ""}>${label}</option>`).join("")}</select><button type="button" class="hypesquad-quiz-button" data-action="hypesquad-quiz">Not sure? Take the quiz</button>`;
      })()}<label class="legacy-preference"><input id="profile-legacy-nav" type="checkbox" ${uiPreferences.legacy_navigation ? "checked" : ""}><span><strong>Use legacy navigation</strong><small>Displays servers on an additional bottom navigation bar.</small></span></label><h3 class="v3-settings-subhead">Badges</h3><div class="v3-profile-badges">${(user.badges || []).map((badge) => `<span class="v3-badge" title="${escapeHtml(badgeTitle(badge))}"><span class="v3-badge-icon">${badgeIcon(badge)}</span>${escapeHtml(badgeName(badge))}</span>`).join("") || '<span class="v3-badge muted">No badges yet</span>'}</div>`,
      `<button class="secondary" data-action="view-own-profile">View public profile</button><button class="secondary" data-action="logout">Sign out</button><button class="primary" data-action="save-profile">Save profile</button>`,
    );
    $("#profile-custom-status").maxLength = 80;
    $("#profile-custom-emoji").maxLength = 8;
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
    isPlatformStaff: () => state.user?.is_platform_staff === true,
    reloadServerBadges: async () => { await loadServerBadges(); },
  });
  function settings() {
    settingsUI.open(settingsTab);
  }
  // Badge artwork sits over a drawn glyph, so a blocked or dead icon URL is
  // dropped without an inline handler (and without a CSP violation).
  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (image instanceof HTMLImageElement && image.hasAttribute("data-badge-art"))
        image.remove();
    },
    true,
  );
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
      if (action === "hypesquad-quiz") {
        openHypesquadQuiz();
        return;
      }
      if (action === "poll-create") {
        pollComposer();
        return;
      }
      if (action === "poll-submit") {
        const question = ($("#poll-question")?.value || "").trim();
        const options = [0, 1, 2, 3]
          .map((i) => (document.querySelector(`[name="option${i}"]`)?.value || "").trim())
          .filter(Boolean);
        const multiple = Boolean(document.querySelector('[name="multiple"]')?.checked);
        const closesRaw = $("#poll-closes")?.value || "";
        if (!question || options.length < 2) {
          toast("Add a question and at least two options");
          return;
        }
        try {
          await rpc("app_poll_create", {
            p_channel: cid,
            p_question: question,
            p_options: options,
            p_multiple: multiple,
            p_closes_at: closesRaw ? new Date(closesRaw).toISOString() : null,
          });
          closeModal();
          await refresh();
          toast("Poll published");
        } catch (error) {
          toast(errText(error));
        }
        return;
      }
      if (action === "poll-vote") {
        try {
          await rpc("app_poll_vote", { p_poll: id, p_index: Number(button.dataset.option) });
          await refresh();
        } catch (error) {
          toast(errText(error));
        }
        return;
      }
      if (action === "poll-close") {
        try {
          await rpc("app_poll_close", { p_poll: id });
          await refresh();
        } catch (error) {
          toast(errText(error));
        }
        return;
      }
      if (action === "search-open") {
        openSearch(search);
        return;
      }
      if (action === "search-hint") {
        const input = $("#global-search");
        if (!input) return;
        const token = button.dataset.fill || "";
        input.value = `${input.value.trim()} ${token}`.trim();
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      if (action === "search-view") {
        searchView = button.dataset.id === "bookmarks" ? "bookmarks" : "results";
        renderSearch(false);
        return;
      }
      if (action === "run-saved") {
        openSearch(button.dataset.query || "");
        return;
      }
      if (action === "delete-saved") {
        savedSearchList = (await rpc("app_delete_search", { p_id: button.dataset.id })) || [];
        renderSearch(false);
        return;
      }
      if (action === "save-search") {
        const name = $("#search-save-name")?.value.trim() || "";
        if (!searchQuery) { toast("Run a search before saving it"); return; }
        if (!name) { toast("Name the search first"); return; }
        try {
          savedSearchList = (await rpc("app_save_search", { p_name: name, p_query: searchQuery })) || [];
          toast("Search saved");
          renderSearch(false);
        } catch (error) { toast(errText(error)); }
        return;
      }
      if (action === "search-jump") {
        searchJump(button.dataset.server, button.dataset.channel, button.dataset.target);
        return;
      }
      if (action === "bookmark") {
        try {
          const on = await rpc("app_bookmark_toggle", { p_message: id });
          toast(on ? "Bookmarked" : "Bookmark removed");
        } catch (error) { toast(errText(error)); }
        return;
      }
      if (action === "hypesquad-quiz-submit") {
        const tally = { bravery: 0, brilliance: 0, balance: 0 };
        let answered = 0;
        HYPESQUAD_QUIZ.forEach((_, index) => {
          const picked = document.querySelector(`input[name="hypesquad-q${index}"]:checked`);
          if (picked && tally[picked.value] !== undefined) {
            tally[picked.value] += 1;
            answered += 1;
          }
        });
        if (answered < HYPESQUAD_QUIZ.length) {
          $("#modalerror").textContent = `Answer all ${HYPESQUAD_QUIZ.length} questions to see your house.`;
          return;
        }
        // Ties fall to the first house in the fixed order, so the result is stable.
        const house = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
        const result = await rpc("app_set_hypesquad", { p_house: house });
        if (state?.user) {
          state.user.hypesquad = result?.hypesquad || house;
          if (Array.isArray(result?.badges)) state.user.badges = result.badges;
        }
        render();
        const label = house[0].toUpperCase() + house.slice(1);
        show(
          "Your HypeSquad house",
          `<p class="quiz-intro">You belong in <strong>${escapeHtml(label)}</strong>. The HypeSquad ${escapeHtml(label)} badge is on your profile now, and it will follow you wherever badges appear.</p>`,
          `<button class="primary" data-action="close">Done</button>`,
          true,
        );
        return;
      }
      if (action === "invite-signup") {
        inviteDisplayName = value("invite-display-name").trim();
        if (!inviteDisplayName) {
          $("#invite-error").textContent = "Choose a display name to continue.";
          $("#invite-display-name").focus();
          return;
        }
        invitePreviewError = "";
        inviteAuthMode = "signup";
        registration = true;
        renderAuth();
        return;
      }
      if (action === "invite-login") {
        inviteAuthMode = "login";
        registration = false;
        renderAuth();
        return;
      }
      if (action === "invite-back") {
        inviteAuthMode = "preview";
        registration = false;
        renderAuth();
        return;
      }
      if (action === "invite-dismiss") {
        clearInviteFromURL();
        invitePreviewCode = "";
        invitePreviewInfo = null;
        invitePreviewError = "";
        inviteAuthMode = "preview";
        renderAuth();
        return;
      }
      if (action === "auth-switch") {
        registration = !registration;
        if (inviteCodeFromURL()) inviteAuthMode = registration ? "signup" : "login";
        renderAuth();
        return;
      }
      if (action === "nav") {
        $(".layout")?.classList.toggle("shownav");
        return;
      }
      if (action === "home") {
        serverListOpen = false;
        sid = cid = null;
        dm = null;
        page = "home";
        render();
        return;
      }
      if (action === "friends") {
        const contacts = [...new Map((state.contacts || []).filter(Boolean).map((person) => [person.id, person])).values()];
        show("Friends", contacts.length
          ? contacts.map((contact) => `<button class="friend-entry" data-action="dm" data-id="${contact.id}">${avatar(contact)}<span><strong>${escapeHtml(contact.name || "Member")}</strong>${officialTag(contact)}<small>${escapeHtml(contact.custom_status || "")}</small></span><span class="friend-presence">${escapeHtml(contact.status || "offline")}</span></button>`).join("")
          : '<p class="muted">No friends yet. Start a direct message from the + button.</p>');
        return;
      }
      if (action === "achievements") {
        let badges = state.user?.badges || [];
        try { badges = (await rpc("app_user_profile", { p_user: state.user.id }))?.badges || badges; } catch (error) { console.error("[Constellation] could not load badges", error); }
        show("Badges and achievements", badges.length
          ? `<div class="v3-profile-badges v3-achievement-list">${badges.map((badge) => `<span class="v3-badge" title="${escapeHtml(badgeTitle(badge))}"><span class="v3-badge-icon">${badgeIcon(badge)}</span>${escapeHtml(badgeName(badge))}</span>`).join("")}</div>`
          : '<p class="muted">No badges have been awarded to this account yet.</p>');
        return;
      }
      if (action === "activity") {
        const mentions = await rpc("app_mention_feed");
        show("Activity log", mentions.length
          ? `<div class="mention-feed">${mentions.map((item) => `<button class="mention-entry" data-action="mention-open" data-server="${item.server_id}" data-channel="${item.channel_id}" data-message="${item.message_id}"><strong>${escapeHtml(item.author?.name || "Member")} mentioned you in #${escapeHtml(item.channel_name)}</strong><small>${escapeHtml(item.server_name)} · ${new Date(item.created_at).toLocaleString()}</small><p>${escapeHtml(item.body)}</p></button>`).join("")}</div>`
          : '<div class="activity-empty"><strong>You’re all caught up.</strong><p class="muted">Mentions in channels you can view will appear here.</p></div>');
        return;
      }
      if (action === "mention-open") {
        sid = button.dataset.server;
        cid = button.dataset.channel;
        dm = null;
        page = "chat";
        closeModal();
        render();
        await loadMessages();
        const targetMessage = document.querySelector(`[data-message="${button.dataset.message}"]`);
        targetMessage?.scrollIntoView({ block: "center", behavior: "smooth" });
        targetMessage?.classList.add("mention-highlight");
        window.setTimeout(() => targetMessage?.classList.remove("mention-highlight"), 1800);
        return;
      }
      if (action === "server") {
        serverListOpen = false;
        sid = id;
        cid = null;
        dm = null;
        page = "overview";
        $(".layout")?.classList.remove("shownav");
        render();
        return;
      }
      if (action === "server-list") {
        serverListOpen = !serverListOpen;
        render();
        return;
      }
      if (action === "close-server-list") {
        serverListOpen = false;
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
        $(".layout")?.classList.remove("shownav");
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
        $(".layout")?.classList.remove("shownav");
        closeModal();
        render();
        await loadMessages();
        return;
      }
      if (action === "toggle-category") {
        collapsed[id] = !collapsed[id];
        await saveUiPreferences();
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
      if (action === "right-tab") {
        rightPanelTab = button.dataset.tab === "threads" ? "threads" : "members";
        activeThread = null;
        threadData = null;
        render();
        return;
      }
      if (action === "reply" || action === "reply-select") {
        replyTarget = id;
        privateReply = false;
        render();
        await loadMessages();
        $("#message")?.focus();
        return;
      }
      if (action === "reply-private") {
        privateReply = !privateReply;
        render();
        $("#message")?.focus();
        return;
      }
      if (action === "reply-mention") {
        replyMention = !replyMention;
        render();
        $("#message")?.focus();
        return;
      }
      if (action === "reply-cancel") {
        replyTarget = null;
        privateReply = false;
        render();
        await loadMessages();
        return;
      }
      if (action === "thread-create") {
        const created = await relationApi("thread/create", { channel: cid, message: id });
        await loadMessages();
        activeThread = created.id;
        threadData = await relationApi("thread/open", { channel: cid, thread: created.id });
        rightPanelTab = "threads";
        render();
        return;
      }
      if (action === "thread-open") {
        activeThread = id;
        threadData = await relationApi("thread/open", { channel: cid, thread: id });
        rightPanelTab = "threads";
        render();
        if (innerWidth < 1100) show("Thread", memberList().replace(/^<aside[^>]*>|<\/aside>$/g, ""));
        return;
      }
      if (action === "threads-back") {
        activeThread = null;
        threadData = null;
        render();
        return;
      }
      if (action === "thread-archive") {
        await relationApi("thread/archive", { channel: cid, thread: activeThread, archived: button.dataset.archived === "true" });
        threadData = await relationApi("thread/open", { channel: cid, thread: activeThread });
        await loadMessages();
        render();
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
      if (action === "overview-rsvp") {
        await featureApi("calendar/rsvp", {
          channel: button.dataset.channel,
          id,
          status: button.dataset.status,
        });
        overviewInfo.serverId = null;
        await loadOverviewInfo(current());
        return;
      }
      if (action === "overview-events-next") {
        const track = $("#overview-events");
        track?.scrollBy({ left: track.clientWidth * 0.8, behavior: "smooth" });
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
      if (action === "favorite-server") {
        if (favoriteServers.has(id)) favoriteServers.delete(id);
        else favoriteServers.add(id);
        render();
        try {
          await saveUiPreferences();
        } catch (error) {
          if (favoriteServers.has(id)) favoriteServers.delete(id);
          else favoriteServers.add(id);
          render();
          toast(errText(error));
        }
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
      if (action === "user-menu") {
        const entries = [];
        entries.push(
          { label: "Referral program", action: "guilded-resource", icon: "invite", id: "referral" },
          { label: "Support", action: "guilded-resource", icon: "help", id: "support" },
          { label: "Feedback", action: "guilded-resource", icon: "megaphone", id: "feedback" },
          { label: "Blog", action: "guilded-resource", icon: "list", id: "blog" },
          { label: "Become a partner", action: "guilded-resource", icon: "users", id: "partner" },
          { label: "Follow us on social media", action: "guilded-resource", icon: "sparkles", id: "social" },
          { label: "We're hiring!", action: "guilded-resource", icon: "arrow", id: "jobs" },
        );
        if (state.user?.is_platform_staff)
          entries.push({ label: "Staff panel", action: "staff-panel", icon: "shield" });
        entries.push({ separator: true });
        entries.push({ label: "Log out", action: "logout", icon: "logout" });
        const trigger = button.getBoundingClientRect();
        menu(entries, trigger.left, trigger.top);
        const accountMenu = document.querySelector(".context-menu");
        accountMenu?.classList.add("account-menu");
        if (accountMenu) {
          accountMenu.style.left = `${Math.max(8, Math.min(trigger.left, innerWidth - accountMenu.offsetWidth - 8))}px`;
          accountMenu.style.top = `${Math.max(8, trigger.top - accountMenu.offsetHeight - 8)}px`;
        }
        return;
      }
      if (action === "guilded-resource") {
        if (id === "support" || id === "feedback") {
          const destination = id === "support"
            ? "https://support.guilded.gg/hc/en-us"
            : "https://support.guilded.gg/hc/en-us/requests/new";
          window.open(destination, "_blank", "noopener,noreferrer");
        } else {
          const label = ({ referral: "Referral program", blog: "Blog", partner: "Become a partner", social: "Social media", jobs: "Careers" })[id] || "Guilded resource";
          show(label, '<p class="muted">This destination belonged to Guilded’s external service and is not available inside the localhost app.</p>');
        }
        return;
      }
      if (action === "channel-menu") {
        const items = [{ label: "Pinned messages", action: "pins", icon: "pin" }];
        if (can("manage_channels")) items.push({ label: "Create channel", action: "new-channel", icon: "hash" }, { label: "Create category", action: "new-category", icon: "plus" }, { label: "Channel settings", action: "edit-channel", icon: "settings", id: cid });
        items.push({ label: "Invite people", action: "invite", icon: "invite" });
        menu(items, event.clientX, event.clientY);
        return;
      }
      if (action === "message-menu") {
        const message = messages.find((item) => item.id === id);
        const items = [];
        if (message?.sender === state.user.id) items.push({ label: "Edit", action: "edit-message", icon: "edit", id });
        items.push({ label: "Share message", action: "share-message", icon: "copy", id }, { label: "Copy link", action: "copy-message-link", icon: "copy", id });
        if (cid && can("manage_messages")) items.push({ label: message?.pinned ? "Unpin message" : "Pin message", action: "pin", icon: "pin", id });
        if (message?.sender === state.user.id || (cid && can("manage_messages"))) items.push({ label: "Delete", action: "delete-message", icon: "trash", id, danger: true });
        menu(items, event.clientX, event.clientY);
        return;
      }
      if (action === "share-message" || action === "copy-message-link") {
        const message = messages.find((item) => item.id === id);
        if (!message) return;
        const text = action === "share-message" ? message.body : `${location.origin}/?server=${encodeURIComponent(sid || "")}&channel=${encodeURIComponent(cid || "")}#message-${encodeURIComponent(id)}`;
        await navigator.clipboard.writeText(text);
        toast(action === "share-message" ? "Message copied to clipboard." : "Message link copied.");
        return;
      }
      if (action === "staff-panel") {
        if (!state.user?.is_platform_staff) return;
        location.assign("/admin");
        return;
      }
      if (action === "report-message") {
        const message = messages.find((item) => item.id === id);
        if (!message || message.sender === state.user.id || !cid) return;
        show("Report message", '<label for="report-reason">Why are you reporting this message?</label><textarea id="report-reason" maxlength="2000" required></textarea>', `<button class="secondary" data-action="close">Cancel</button><button class="primary" data-action="submit-message-report" data-id="${id}">Send report</button>`);
        return;
      }
      if (action === "submit-message-report") {
        const message = messages.find((item) => item.id === id);
        const reason = value("report-reason").trim();
        if (!message || !reason) throw Error("Add a reason for this report.");
        await rpc("staff_action", { p_action: "report/create", p_payload: { message_id: id, target_user: message.sender, reason } });
        closeModal();
        toast("Your report was sent to the moderation team.");
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
          '<button class="secondary" data-action="browse-servers">Browse public servers</button><button class="primary" data-action="preview-invite">Continue</button>',
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
      if (action === "preview-invite") {
        const code = value("invite-code").trim();
        if (!code) throw new Error("Enter an invitation code to continue");
        await openInvitePreview(code);
        return;
      }
      if (action === "accept-invite") {
        const code = modal.dataset.inviteCode || "";
        const result = await api("server/join", { code });
        sid = result.id;
        cid = null;
        dm = null;
        page = "overview";
        invitePromptedCode = code;
        clearInviteFromURL();
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
      if (action === "member" || action === "user-profile") {
        memberModal(id);
        return;
      }
      if (action === "assign-role") {
        const role = button.dataset.role,
          enabled = button.checked,
          member = current()?.members.find((item) => item.id === id),
          before = member ? [...(member.roles || [])] : null;
        if (member) {
          member.roles = enabled
            ? [...new Set([...(member.roles || []), role])]
            : (member.roles || []).filter((item) => item !== role);
          paintProfile(id, member);
        }
        try {
          if (id === state.user.id && !can("manage_roles"))
            await rpc("app_role_self", { p_role: role, p_enabled: enabled });
          else
            await api("member/role", { server: sid, user: id, role, enabled });
          if (id === state.user.id)
            refresh().catch((error) => console.error("[Constellation] could not refresh permissions", error));
        } catch (error) {
          if (member && before) {
            member.roles = before;
            paintProfile(id, member);
          }
          toast(errText(error));
        }
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
      if (action === "view-own-profile") {
        closeModal();
        memberModal(state.user.id);
        return;
      }
      if (action === "save-profile") {
        const profileFields = {
            name: value("profile-name"),
            avatar: value("profile-avatar") || state.user.avatar || "G",
            bio: value("profile-bio"),
            status: value("profile-status"),
          },
          statusFields = {
            custom_status: value("profile-custom-status"),
            custom_status_emoji: value("profile-custom-emoji"),
          },
          before = { ...state.user };
        state.user = { ...state.user, ...profileFields, ...statusFields };
        uiPreferences = { ...uiPreferences, legacy_navigation: checked("profile-legacy-nav") };
        closeModal();
        render();
        toast("Profile saved");
        try {
          await api("profile", profileFields);
          await rpc("app_profile_status", {
            p_text: statusFields.custom_status,
            p_emoji: statusFields.custom_status_emoji,
          });
          const house = value("profile-hypesquad");
          if (house !== undefined) {
            const result = await rpc("app_set_hypesquad", { p_house: house });
            if (Array.isArray(result?.badges)) {
              state.user.badges = result.badges;
              state.user.hypesquad = result.hypesquad;
              render();
            }
          }
          await saveUiPreferences();
        } catch (error) {
          state.user = before;
          render();
          toast(errText(error));
        }
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
        const emoji = button.dataset.emoji,
          message = messages.find((item) => item.id === id);
        closeModal();
        if (!message) return;
        const key = id + ":" + emoji,
          before = message.reactions || [],
          wasMine = myReactions.has(key);
        message.reactions = reactionsAfterToggle(before, emoji, wasMine);
        if (wasMine) myReactions.delete(key);
        else myReactions.set(key, true);
        renderMessages();
        try {
          const result = await rpc("app_toggle_reaction", { p_message: id, p_emoji: emoji });
          const current = messages.find((item) => item.id === id);
          if (result && current) {
            current.reactions = reactionsWithCount(current.reactions, emoji, Number(result.count) || 0);
            if (result.mine) myReactions.set(key, true);
            else myReactions.delete(key);
            renderMessages();
          }
        } catch (error) {
          const current = messages.find((item) => item.id === id);
          if (current) current.reactions = before;
          if (wasMine) myReactions.set(key, true);
          else myReactions.delete(key);
          renderMessages();
          toast(errText(error));
        }
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
        const body = value("edit-body").trim(),
          message = messages.find((item) => item.id === id),
          before = message ? { body: message.body, edited: message.edited } : null;
        closeModal();
        if (body.length && message) {
          message.body = body;
          message.edited = true;
          renderMessages();
        }
        try {
          await api("message/edit", { id, body });
        } catch (error) {
          if (message && before) {
            message.body = before.body;
            message.edited = before.edited;
            renderMessages();
          }
          toast(errText(error));
        }
        return;
      }
      if (action === "pin") {
        const message = messages.find((item) => item.id === id),
          wasPinned = Boolean(message?.pinned);
        if (message) {
          message.pinned = !wasPinned;
          renderMessages();
        }
        try {
          await api("message/pin", { id });
        } catch (error) {
          if (message) {
            message.pinned = wasPinned;
            renderMessages();
          }
          toast(errText(error));
        }
        return;
      }
      if (action === "delete-message") {
        if (confirm("Delete this message?")) await removeMessage(id);
        return;
      }
      if (action === "quick-delete-message") {
        await removeMessage(id);
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
    if (event.target.id === "server-list-search") {
      serverSearch = event.target.value;
      const rows = $(".server-list-groups");
      if (rows) rows.innerHTML = serverListRows();
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
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "search-form") return;
    event.preventDefault();
    event.stopPropagation();
    openSearch($("#global-search")?.value || "");
  }, true);
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
              emailRedirectTo: location.origin + location.pathname + location.search + location.hash,
              data: {
                username: value("username"),
                name: value("displayname") || value("username"),
              },
            },
          });
          if (response.error) throw response.error;
          if (!response.data.session) {
            invitePreviewError = inviteCodeFromURL()
              ? "Check your email, then return to this invite to sign in."
              : "Check your email, then sign in.";
            registration = false;
            if (inviteCodeFromURL()) inviteAuthMode = "login";
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
        invitePreviewError = "";
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
      try {
        if (replyTarget) {
          if (pendingAttachments.length) throw Error("Remove attachments before sending a reply.");
          const parent = messages.find((item) => item.id === replyTarget);
          const mention = replyMention && parent ? `@${person(parent.sender)?.username || person(parent.sender)?.name || "member"} ` : "";
          await relationApi("reply/create", { channel: cid, message: replyTarget, body: mention + body, private: privateReply });
          input.value = "";
          replyTarget = null;
          privateReply = false;
          await loadMessages();
          render();
          return;
        }
        // Show the message before the network answers, then reconcile the id.
        const sentAttachments = [...pendingAttachments],
          optimisticBody = body || "Shared a file",
          tempId = "temp-" + (crypto.randomUUID?.() || String(Date.now())),
          optimistic = {
            id: tempId,
            channel_id: dm ? null : cid,
            sender: state.user.id,
            recipient: dm?.id || null,
            body: optimisticBody,
            created: Math.floor(Date.now() / 1000),
            edited: false,
            pinned: false,
            reactions: [],
            attachments: sentAttachments.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              type: attachment.content_type || attachment.type || "application/octet-stream",
              size: attachment.size,
              path: attachment.path,
              status: "pending",
              uploaded_by: state.user.id,
            })),
            pending: true,
          };
        messages = [...messages, optimistic];
        pendingSends += 1;
        input.value = "";
        pendingAttachments = [];
        renderMessages();
        const timeline = $("#timeline");
        if (timeline) timeline.scrollTop = timeline.scrollHeight;
        try {
          const created = await api("message/send", {
            channel: dm ? null : cid,
            user: dm?.id || null,
            body: optimisticBody,
          });
          const sent = messages.find((item) => item.id === tempId);
          if (sent) {
            sent.id = created.id;
            sent.pending = false;
          }
          for (const attachment of sentAttachments)
            await featureApi("attachment/bind", {
              channel: cid,
              id: attachment.id,
              message: created.id,
            });
          if (sentAttachments.length) await loadMessages();
          else renderMessages();
        } catch (error) {
          messages = messages.filter((item) => item.id !== tempId);
          input.value = body;
          pendingAttachments = sentAttachments;
          if (sentAttachments.length) render();
          else renderMessages();
          toast(errText(error));
        } finally {
          pendingSends = Math.max(0, pendingSends - 1);
        }
      } catch (error) {
        toast(errText(error));
      } finally {
        input.focus();
      }
      return;
    }
    if (event.target.id === "thread-compose") {
      event.preventDefault();
      const body = $("#thread-message")?.value || "";
      if (!body.trim() || !activeThread) return;
      try {
        await relationApi("thread/reply", { channel: cid, thread: activeThread, body });
        threadData = await relationApi("thread/open", { channel: cid, thread: activeThread });
        render();
      } catch (error) {
        toast(errText(error));
      }
    }
  });
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest(
      "[data-message],[data-channel],[data-category],.member[data-id],.orb[data-id],.serverhead,.nav,.main,.profilebar,.server-list-panel",
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
        { label: "Share message", action: "share-message", icon: "copy", id },
        { label: "Copy link", action: "copy-message-link", icon: "copy", id },
      ];
      if (message && message.sender !== state.user.id && cid)
        items.push({ label: "Report message", action: "report-message", icon: "shield", id });
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
    else if (target.classList.contains("profilebar"))
      items = [
        { label: "Edit profile", action: "profile", icon: "users" },
        { label: "Activity log", action: "activity", icon: "sparkles" },
        { label: "More account options", action: "user-menu", icon: "more" },
      ];
    else if (target.classList.contains("server-list-panel"))
      items = [
        { label: "Create a server", action: "create-server", icon: "plus" },
        { label: "Join a server", action: "join-server", icon: "invite" },
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
    else
      items = [
        { label: "Start a direct message", action: "new-dm", icon: "chat" },
        { label: "Create a server", action: "create-server", icon: "plus" },
        { label: "Join a server", action: "join-server", icon: "invite" },
      ];
    if (items.length) menu(items, event.clientX, event.clientY);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "top-search") {
      event.preventDefault();
      openSearch(event.target.value || search);
      return;
    }
    if (event.key === "Escape") {
      document.querySelector(".context-menu")?.remove();
      if (modal.open) closeModal();
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      ["k", "s"].includes(event.key.toLowerCase()) &&
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
      render();
    }
  })();
  setInterval(async () => {
    if (!state || document.hidden || pollBusy) return;
    pollBusy = true;
    try {
      if (page === "chat" && !pendingSends) await loadMessages();
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
