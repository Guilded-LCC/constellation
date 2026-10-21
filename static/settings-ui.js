/* Server settings drafts live only in memory. Save commits roles in one database transaction. */
window.createSettingsUI = function ({
  supabase,
  rpc,
  api,
  current,
  can,
  icon,
  escapeHtml: e,
  roleIcon,
  roleTextStyle,
  safeMedia,
  refresh,
  toast,
  errText,
  modal,
  isPlatformStaff = () => false,
  reloadServerBadges = async () => {},
}) {
  let tab = "overview",
    roles = [],
    server = {},
    data = {},
    selected = null,
    baseline = "",
    error = "",
    drag = null,
    busy = false,
    openServer = null,
    hookURL = "",
    picker = null,
    serverBadgesList = [];
  const $ = (s) => modal.querySelector(s);
  const tabs = [
    ["overview", "Overview"],
    ["roles", "Roles"],
    ["groups", "Groups"],
    ["emotes", "Emotes"],
    ["privacy", "Privacy"],
    ["notifications", "Notifications"],
    ["webhooks", "Webhooks"],
    ["invites", "Invites"],
    ["bans", "Bans"],
    ["badges", "Badges"],
  ];
  // Server badges are a platform-staff control, so members never see the tab.
  const visibleTabs = () => tabs.filter(([id]) => id !== "badges" || isPlatformStaff());
  const groups = {
    General: [
      [
        "administrator",
        "Administrator",
        "Grants every permission and bypasses channel overrides",
      ],
      [
        "manage_server",
        "Update server",
        "Allows you to update the server’s settings and manage invites",
      ],
      [
        "manage_roles",
        "Manage roles",
        "Allows you to update lower-ranked roles",
      ],
      [
        "create_invites",
        "Invite members",
        "Allows you to directly invite members to the server",
      ],
      ["kick_members", "Kick members", "Remove members from this server"],
      ["ban_members", "Ban members", "Ban members from this server"],
      [
        "manage_groups",
        "Manage groups",
        "Create, edit and delete server groups",
      ],
      ["manage_emotes", "Manage emotes", "Upload and manage custom emotes"],
      [
        "manage_webhooks",
        "Manage webhooks",
        "Create and manage incoming webhooks",
      ],
      ["view_audit", "View audit log", "Read changes made in this server"],
    ],
    Chat: [
      ["view_channels", "Read messages", "Read channels you have access to"],
      ["send_messages", "Send messages", "Post messages in chat channels"],
      ["add_reactions", "Add reactions", "React to messages"],
      ["manage_messages", "Manage messages", "Delete and pin messages"],
      ["private_replies", "Private replies", "Send replies visible only to participants and moderators"],
      [
        "manage_channels",
        "Manage channels",
        "Create and organize channels and categories",
      ],
      ["upload_media", "Upload media", "Attach files and images to messages"],
      [
        "mention_roles",
        "Mention roles",
        "Notify members by mentioning their roles",
      ],
    ],
    Voice: [
      ["join_voice", "Join voice", "Join voice channels"],
      ["speak", "Speak", "Share audio in supported voice channels"],
      ["manage_voice", "Manage voice", "Manage participants in voice channels"],
    ],
    Forums: [
      ["create_topics", "Create topics", "Start forum discussions"],
      ["reply_topics", "Reply to topics", "Reply to open discussions"],
      ["manage_topics", "Manage topics", "Pin, lock and moderate topics"],
    ],
    Docs: [
      ["create_docs", "Create docs", "Create and edit your documents"],
      [
        "manage_docs",
        "Manage docs",
        "Edit and delete documents by other members",
      ],
    ],
    Calendar: [
      ["create_events", "Create events", "Create and edit your events"],
      ["manage_events", "Manage events", "Manage all calendar events"],
    ],
    Lists: [
      [
        "manage_lists",
        "Manage list items",
        "Create, edit, assign and reorder list items",
      ],
    ],
  };
  const solids = [
    "#ff5b72",
    "#ff9b55",
    "#f6c500",
    "#83d139",
    "#39c977",
    "#24c6bf",
    "#37aaff",
    "#6575ff",
    "#aaaac0",
    "#8f65e9",
    "#d564ed",
    "#ed8fce",
    "#f6d190",
    "#95f0d5",
  ];
  const gradients = [
    ["#ff587b", "#ad58ff"],
    ["#f7d83e", "#10b8da"],
    ["#91dc35", "#e9c537"],
    ["#ff9e61", "#f976d7"],
    ["#a65cff", "#e65bea"],
    ["#9f79ff", "#62e8cf"],
    ["#1dded6", "#198cff"],
    ["#5274ff", "#a7bbff"],
    ["#acb2c2", "#e8e5ee"],
    ["#1bcf64", "#a7f9bd"],
    ["#ffc051", "#ffdeaa"],
    ["#ee5ce1", "#ffb6ed"],
    ["#a97be9", "#daa7ff"],
    ["#40e8cc", "#acfff1"],
  ];
  const snap = () => JSON.stringify({ roles, server });
  const dirty = () => snap() !== baseline;
  const role = () => roles.find((r) => r.id === selected);
  const input = (key, label, value = "", extra = "") =>
    `<label class="s-label" for="s-${key}">${label}</label><input class="s-underline" id="s-${key}" data-s-field="${key}" value="${e(value)}" ${extra}>`;
  const toggle = (key, title, description, enabled, permission = false) =>
    `<label class="s-toggle-row"><span><strong>${title}</strong><small>${description}</small></span><input type="checkbox" ${permission ? "data-s-permission" : "data-s-role"}="${key}" ${enabled ? "checked" : ""}><i aria-hidden="true"></i></label>`;
  function updateDirty() {
    const b = $('[data-s-action="save"]');
    if (b) {
      b.disabled = !dirty() || busy;
      b.dataset.saving = String(busy);
      b.textContent = busy ? "Saving…" : "Save changes";
      b.classList.toggle("dirty", dirty());
    }
  }
  function close(force = false) {
    if (!force && dirty() && !confirm("Discard your unsaved changes?")) return;
    modal.close();
    modal.className = "";
    openServer = null;
    hookURL = "";
  }
  function render() {
    const content =
      tab === "roles"
        ? rolesPage()
        : tab === "overview"
          ? overviewPage()
          : tab === "badges"
            ? badgesPage()
            : otherPage();
    modal.className = "settings-dialog s-settings";
    modal.innerHTML = `<div class="s-shell"><aside class="s-nav"><div class="s-nav-scroll"><h3>Server settings</h3>${visibleTabs().map(([id, label], i) => `${i === 7 ? '<h3 class="s-user-management">User management</h3>' : ""}<button data-s-action="tab" data-id="${id}" class="${id === tab ? "active" : ""}">${label}</button>`).join("")}</div><footer><button class="s-save" data-s-action="save" ${dirty() ? "" : "disabled"}>Save changes</button><button class="s-cancel" data-s-action="cancel">Cancel</button></footer></aside><main class="s-content"><h2>${visibleTabs().find((t) => t[0] === tab)?.[1] || "Server settings"}</h2>${error ? `<p class="s-error" role="alert">${e(error)}</p>` : ""}${content}</main></div><button class="s-close" data-s-action="close" aria-label="Close settings">${icon("close")}</button>`;
    if (!modal.open) modal.showModal();
    updateDirty();
  }
  const blankRoleGlyph = (item) => (item.position === 0 ? icon("user") : "");
  function rolesPage() {
    const r = role();
    const colorPicker = (key, label) =>
      `<button class="s-color-end" data-s-action="open-picker" data-id="${key}" aria-label="Edit ${label} color">+</button>${picker === key ? `<div class="s-color-popover"><label>${label}<input type="color" data-s-role="${key}" value="${e(r[key])}"></label><label>Hex<input maxlength="7" pattern="#[0-9a-fA-F]{6}" data-s-hex="${key}" value="${e(r[key])}"></label>${r.color2 ? `<label>Angle<input type="number" min="0" max="360" data-s-role="gradient_angle" value="${r.gradient_angle ?? 90}">°</label>` : ""}<button data-s-action="close-picker">Done</button></div>` : ""}`;
    return `<div class="s-roles"><nav class="s-role-list" aria-label="Server roles" title="Members display the highest role on this list. Drag roles to reorder.">${can("manage_roles") ? `<button class="s-add-role" data-s-action="add-role">${icon("plus", "sm")} Add another role</button>` : ""}${roles.map((item) => `<button class="s-role-choice ${selected === item.id ? "selected" : ""}" data-s-action="role" data-id="${item.id}" data-s-drag-role="${item.id}" draggable="${item.position > 0 && can("manage_roles")}"><span class="s-role-glyph">${roleIcon(item) || blankRoleGlyph(item)}</span><span data-s-role-name="${item.id}" style="${roleTextStyle(item)}">${e(item.position === 0 ? "Member" : item.name)}</span></button>`).join("")}</nav>${
      r
        ? `<section class="s-role-form"><label class="s-label" for="s-role-name">Role name</label><input class="s-underline" id="s-role-name" data-s-role="name" maxlength="40" value="${e(r.name)}" ${r.position === 0 ? "disabled" : ""}><h3>Role color</h3><div class="s-segments"><button class="${!r.color2 ? "selected" : ""}" data-s-action="solid">Solid</button><button class="${r.color2 ? "selected" : ""}" data-s-action="gradient">Gradient <b>NEW!</b></button></div><div class="s-color-tools"><div class="s-rainbow">${colorPicker("color", "First")}${r.color2 ? colorPicker("color2", "Second") : ""}</div><div class="s-swatches">${solids
            .map((c, i) => {
              const pair = gradients[i],
                bg = r.color2
                  ? `linear-gradient(90deg,${pair[0]},${pair[1]})`
                  : c;
              return `<button aria-label="Color preset ${i + 1}" class="${r.color === (r.color2 ? pair[0] : c) ? "chosen" : ""}" style="background:${bg}" data-s-action="preset" data-id="${i}"></button>`;
            })
            .join(
              "",
            )}</div></div>${r.position > 0 ? `<h3>Role icon</h3><div class="s-icon-tools"><span class="s-icon-preview" title="Upload a square image, at least 64×64px. Images are cropped to a square.">${roleIcon(r) || `<span class="s-placeholder">${icon("image")}</span>`}</span><label class="s-outline">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" data-s-upload="role" hidden></label><button class="s-outline" data-s-action="emote-picker">Choose emote</button></div>${roleIcon(r) ? `<button class="s-remove" data-s-action="remove-icon">Remove image</button>` : ""}<div class="s-emote-picker" hidden>${["😀", "🛡️", "⚔️", "⭐", "🔥", "💎", "🎮", "🏆", "👑", "🚀"].map((x) => `<button data-s-action="emoji" data-id="${x}">${x}</button>`).join("")}${(data.emotes || []).map((x) => `<button data-s-action="custom-emote" data-id="${x.id}"><img src="${safeMedia(x.image_url)}" alt="${e(x.name)}"></button>`).join("")}</div><h3>Role settings</h3>${toggle("self_assignable", "Self-assignable", "Allows members to assign this role to themselves", r.self_assignable)}${toggle("mentionable", "Mentionable", "Allow members to notify others by mentioning this role", r.mentionable)}${toggle("hoist", "Display Separately", "If enabled, members with this role will display separately from other online members", r.hoist)}` : ""}<h4>Bulk permission actions</h4><div class="s-bulk"><button class="s-outline" data-s-action="disable-all">Disable all</button><button class="s-outline" data-s-action="enable-all">Enable all</button></div>${Object.entries(
            groups,
          )
            .map(
              ([name, perms]) =>
                `<h3 class="s-permission-heading">${name} permissions</h3>${perms.map(([key, title, desc]) => toggle(key, title, desc, (r.permissions || []).includes(key), true)).join("")}`,
            )
            .join(
              "",
            )}${r.position > 0 ? '<button class="s-delete" data-s-action="delete-role">Delete role</button>' : ""}</section>`
        : "<p>Select a role.</p>"
    }</div>`;
  }
  function media(kind) {
    const url = safeMedia(server[kind + "_url"]);
    return `<section class="s-media"><h3>${kind === "avatar" ? "Avatar" : "Banner"}</h3><div class="s-media-row"><div class="s-media-preview s-${kind}">${url ? `<img src="${url}" alt="Server ${kind}">` : kind === "avatar" ? e((server.name || "S")[0]) : ""}</div><div>${kind === "avatar" ? "<p>We recommend a square image at least 256x256px.</p>" : ""}<label class="s-outline">Upload Image<input type="file" accept="image/png,image/jpeg,image/webp" data-s-upload="${kind}" hidden></label><button class="s-remove" data-s-action="remove-media" data-id="${kind}">Remove</button></div></div>${kind === "banner" ? "<p>For best results, upload a 1920x300px image.</p>" : ""}</section>`;
  }
  function overviewPage() {
    return `<div class="s-overview">${media("avatar")}${media("banner")}<div class="s-divider"></div>${input("name", "Server name", server.name, 'maxlength="80"')}<label class="s-label" for="s-description">Description</label><textarea class="s-underline" id="s-description" data-s-field="description" maxlength="500">${e(server.description)}</textarea></div>`;
  }
  async function loadServerBadges() {
    const rows = await rpc("app_server_badges");
    serverBadgesList = (Array.isArray(rows) ? rows : []).filter(
      (row) => row.server_id === openServer,
    );
  }
  function badgesPage() {
    const on = serverBadgesList.some((badge) => badge.id === "internal-employee");
    return `<div class="s-narrow"><p class="s-muted">Server badges appear beside this server’s name for every member who can see it.</p><label class="s-check"><input type="checkbox" data-s-action="internal-employee" ${on ? "checked" : ""}> Internal Employee</label><p class="s-muted">Reserved for Guilded’s staff servers. The badge is granted the moment this is switched on.</p><div class="s-badge-preview">${serverBadgesList.length ? serverBadgesList.map((badge) => `<span class="s-badge-row"><span class="server-badge" title="${e(badge.description || badge.name)}"><img src="${e(badge.icon_url)}" alt="${e(badge.name)}"></span><span>${e(badge.name)}</span></span>`).join("") : '<span class="s-muted">No server badges on this server yet.</span>'}</div></div>`;
  }
  function otherPage() {
    if (tab === "privacy")
      return `<div class="s-narrow"><label class="s-label">Server visibility</label><select data-s-field="visibility"><option value="private" ${server.visibility === "private" ? "selected" : ""}>Private — invitation required</option><option value="public" ${server.visibility === "public" ? "selected" : ""}>Public — anyone can find and join</option></select><label class="s-label">Who can invite</label><select data-s-field="invite_policy"><option value="permission" ${server.invite_policy === "permission" ? "selected" : ""}>Members with Invite members permission</option><option value="managers" ${server.invite_policy === "managers" ? "selected" : ""}>Server managers only</option></select></div>`;
    if (tab === "notifications")
      return `<div class="s-narrow"><p class="s-muted">Default notification level for this server.</p><select data-s-field="notification_level">${[
        ["all", "All messages"],
        ["mentions", "Only mentions"],
        ["none", "Nothing"],
      ]
        .map(
          ([id, name]) =>
            `<option value="${id}" ${server.notification_level === id ? "selected" : ""}>${name}</option>`,
        )
        .join("")}</select></div>`;
    if (tab === "groups")
      return `<p class="s-muted">Organize your community into groups.</p><div class="s-inline"><input id="s-group-name" placeholder="Group name" maxlength="50"><input id="s-group-description" placeholder="Description (optional)"><button class="s-outline" data-s-action="add-group">Create group</button></div>${(data.groups || []).map((g) => `<div class="s-record"><div><strong>${e(g.name)}</strong><small>${e(g.description)}</small></div><button data-s-action="edit-group" data-id="${g.id}">Edit</button><button class="danger" data-s-action="delete-group" data-id="${g.id}">Delete</button></div>`).join("")}`;
    if (tab === "emotes")
      return `<p class="s-muted">Upload a square image and choose a name. Use letters, numbers and underscores.</p><div class="s-inline"><input id="s-emote-name" placeholder="Emote name" maxlength="32"><label class="s-outline">Upload emote<input type="file" accept="image/png,image/jpeg,image/webp" data-s-upload="emote" hidden></label></div>${(data.emotes || []).map((x) => `<div class="s-record"><img class="s-emote" src="${safeMedia(x.image_url)}" alt="${e(x.name)}"><strong>:${e(x.name)}:</strong><button data-s-action="edit-emote" data-id="${x.id}">Rename</button><button class="danger" data-s-action="delete-emote" data-id="${x.id}">Delete</button></div>`).join("")}`;
    if (tab === "invites")
      return `<div class="s-inline"><select id="s-invite-hours"><option value="24">Expires in 1 day</option><option value="168" selected>Expires in 7 days</option><option value="720">Expires in 30 days</option></select><button class="s-outline" data-s-action="create-invite">Create invite</button></div>${(data.invites || []).map((i) => `<div class="s-record"><div><code>${e(i.code)}</code><small>Expires ${i.expires_at ? e(new Date(i.expires_at).toLocaleString()) : "never"}</small></div><button class="danger" data-s-action="revoke-invite" data-id="${e(i.code)}">Revoke</button></div>`).join("")}`;
    if (tab === "bans")
      return (
        (current()?.bans || [])
          .map(
            (m) =>
              `<div class="s-record"><strong>${e(m.name || "Member")}</strong><button data-s-action="unban" data-id="${m.id}">Unban</button></div>`,
          )
          .join("") || '<p class="s-muted">No banned members.</p>'
      );
    return `<p class="s-muted">Incoming webhook endpoint is live. Secret URLs are shown once; keep them private.</p><div class="s-inline"><input id="s-hook-name" placeholder="Webhook name" maxlength="50"><select id="s-hook-channel">${(current()?.channels || []).map((c) => `<option value="${c.id}">#${e(c.name)}</option>`).join("")}</select><button class="s-outline" data-s-action="create-hook">Create webhook</button></div>${hookURL ? `<p class="s-hint">Copy this secret URL now. It is shown once.</p><input readonly aria-label="Webhook URL" value="${e(hookURL)}">` : ""}${(data.webhooks?.hooks || []).map((h) => `<div class="s-record"><strong>${e(h.name)}</strong><span>#${e(current()?.channels?.find((c) => c.id === h.channel_id)?.name || "channel")}</span><button class="danger" data-s-action="delete-hook" data-id="${h.id}">Delete</button></div>`).join("")}`;
  }
  async function load() {
    data = await rpc("app_settings", { p_server: openServer });
    if (can("manage_webhooks"))
      data.webhooks = await rpc("app_webhooks", { p_server: openServer });
    server = { ...data.server };
    roles = structuredClone(current()?.roles || []).map((r) => ({
      ...r,
      name: r.position === 0 ? "Member" : r.name,
    }));
    if (!roles.some((r) => r.id === selected)) selected = roles[0]?.id;
    baseline = snap();
  }
  async function open(next = "overview") {
    try {
      if (openServer === current()?.id && modal.open) {
        tab = next;
        render();
        return;
      }
      openServer = current()?.id;
      if (!openServer) return;
      tab = visibleTabs().some((t) => t[0] === next) ? next : "overview";
      error = "";
      await load();
      if (isPlatformStaff()) await loadServerBadges();
      render();
    } catch (err) {
      toast(errText(err));
    }
  }
  async function save() {
    if (!dirty() || busy) return;
    busy = true;
    updateDirty();
    try {
      if (JSON.stringify(roles) !== JSON.stringify(JSON.parse(baseline).roles))
        await rpc("app_roles_save", { p_server: openServer, p_roles: roles });
      if (
        JSON.stringify(server) !== JSON.stringify(JSON.parse(baseline).server)
      )
        await rpc("app_settings", {
          p_server: openServer,
          p_action: "server/save",
          p_data: server,
        });
      await refresh();
      await load();
      error = "";
      render();
      toast("Changes saved");
    } catch (err) {
      error = errText(err);
      render();
    } finally {
      busy = false;
      updateDirty();
    }
  }
  async function mutate(action, payload) {
    const settingsData = await rpc("app_settings", {
      p_server: openServer,
      p_action: action,
      p_data: payload,
    });
    data = { ...settingsData, webhooks: data.webhooks };
    error = "";
    render();
  }
  async function upload(kind, file) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    )
      throw Error("Choose a PNG, JPG or WebP image up to 10 MB.");
    const bitmap = await createImageBitmap(file);
    if (Math.min(bitmap.width, bitmap.height) < (kind === "role" ? 64 : 32)) {
      bitmap.close();
      throw Error(
        "This image is too small. Role icons must be at least 64×64px.",
      );
    }
    const canvas = document.createElement("canvas"),
      aspect = kind === "banner" ? 1920 / 300 : 1;
    canvas.width = kind === "banner" ? 1920 : kind === "role" ? 96 : 512;
    canvas.height = kind === "banner" ? 300 : canvas.width;
    let w = bitmap.width,
      h = bitmap.height;
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
    canvas
      .getContext("2d")
      .drawImage(
        bitmap,
        (bitmap.width - w) / 2,
        (bitmap.height - h) / 2,
        w,
        h,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.92),
    );
    const path = `servers/${openServer}/${kind === "role" ? "role-icons" : kind === "emote" ? "emotes" : kind}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from("community-media")
      .upload(path, blob, { contentType: "image/webp" });
    if (uploadError) throw uploadError;
    const url = supabase.storage.from("community-media").getPublicUrl(path)
      .data.publicUrl;
    if (kind === "role") {
      role().icon_url = url;
      role().emoji = "";
      render();
    } else if (kind === "emote") {
      const name = $("#s-emote-name")?.value.trim();
      if (!/^[a-zA-Z0-9_]{2,32}$/.test(name || ""))
        throw Error(
          "Choose an emote name with 2–32 letters, numbers or underscores.",
        );
      await mutate("emote/save", { name, image_url: url });
    } else {
      server[kind + "_url"] = url;
      render();
    }
    updateDirty();
  }
  modal.addEventListener("cancel", (event) => {
    if (!modal.classList.contains("s-settings")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        modal.open &&
        modal.classList.contains("s-settings") &&
        event.key === "Escape"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
    },
    true,
  );
  modal.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-s-action]");
    if (!b) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = b.dataset.id;
    try {
      switch (b.dataset.sAction) {
        case "close":
        case "cancel":
          close();
          break;
        case "tab":
          tab = id;
          error = "";
          if (tab === "badges" && isPlatformStaff()) await loadServerBadges();
          render();
          break;
        case "internal-employee": {
          const enabled = !serverBadgesList.some((badge) => badge.id === "internal-employee");
          try {
            await rpc("staff_action", {
              p_action: "server/features",
              p_payload: { server_id: openServer, flag: "INTERNAL_EMPLOYEE_ONLY", enabled },
            });
            await loadServerBadges();
            await reloadServerBadges();
            error = "";
            render();
            refresh();
          } catch (err) {
            error = errText(err);
            render();
          }
          break;
        }
        case "role":
          selected = id;
          render();
          break;
        case "add-role": {
          const r = {
            id: crypto.randomUUID(),
            name: "New role",
            color: "#f6c500",
            color2: "",
            emoji: "",
            permissions: [
              "view_channels",
              "send_messages",
              "upload_media",
              "add_reactions",
            ],
            position: Math.max(0, ...roles.map((r) => r.position)) + 1,
            icon_url: "",
            self_assignable: false,
            mentionable: false,
            hoist: false,
            gradient_angle: 90,
          };
          roles.unshift(r);
          selected = r.id;
          render();
          $("#s-role-name")?.focus();
          $("#s-role-name")?.select();
          break;
        }
        case "delete-role":
          if (
            role()?.position > 0 &&
            confirm("Delete this role and remove it from all members?")
          ) {
            roles = roles.filter((r) => r.id !== selected);
            selected = roles[0]?.id;
            render();
          }
          break;
        case "solid":
          role().color2 = "";
          render();
          break;
        case "gradient":
          role().color2 = role().color2 || "#37c9df";
          render();
          break;
        case "open-picker":
          picker = id;
          render();
          break;
        case "close-picker":
          picker = null;
          render();
          break;
        case "preset": {
          const r = role();
          if (r.color2) [r.color, r.color2] = gradients[Number(id)];
          else r.color = solids[Number(id)];
          render();
          break;
        }
        case "remove-icon":
          role().icon_url = "";
          role().emoji = "";
          render();
          break;
        case "emote-picker":
          $(".s-emote-picker").hidden = !$(".s-emote-picker").hidden;
          break;
        case "emoji":
          role().emoji = id;
          role().icon_url = "";
          render();
          break;
        case "custom-emote": {
          const emote = data.emotes.find((x) => x.id === id);
          if (emote) {
            role().icon_url = emote.image_url;
            role().emoji = "";
            render();
          }
          break;
        }
        case "remove-media":
          server[id + "_url"] = "";
          render();
          break;
        case "enable-all":
          role().permissions = Object.values(groups)
            .flat()
            .map((p) => p[0]);
          render();
          break;
        case "disable-all":
          role().permissions = [];
          render();
          break;
        case "save":
          await save();
          break;
        case "add-group":
          await mutate("group/save", {
            name: $("#s-group-name").value,
            description: $("#s-group-description").value,
          });
          break;
        case "edit-group": {
          const g = data.groups.find((g) => g.id === id),
            name = prompt("Group name", g?.name);
          if (name)
            await mutate("group/save", {
              id,
              name,
              description: prompt("Description", g.description) || "",
            });
          break;
        }
        case "delete-group":
          if (confirm("Delete this group?"))
            await mutate("group/delete", { id });
          break;
        case "edit-emote": {
          const x = data.emotes.find((x) => x.id === id),
            name = prompt("Emote name", x?.name);
          if (name)
            await mutate("emote/save", { id, name, image_url: x.image_url });
          break;
        }
        case "delete-emote":
          if (confirm("Delete this emote?"))
            await mutate("emote/delete", { id });
          break;
        case "create-invite":
          await mutate("invite/create", {
            hours: Number($("#s-invite-hours").value),
          });
          break;
        case "revoke-invite":
          await mutate("invite/revoke", { code: id });
          break;
        case "create-hook":
          data.webhooks = await rpc("app_webhooks", {
            p_server: openServer,
            p_action: "create",
            p_data: {
              name: $("#s-hook-name").value,
              channel: $("#s-hook-channel").value,
            },
          });
          hookURL =
            supabase.supabaseUrl +
            "/functions/v1/webhook-post?token=" +
            data.webhooks.token;
          render();
          break;
        case "delete-hook":
          if (
            confirm("Delete this webhook? Its secret URL will stop working.")
          ) {
            data.webhooks = await rpc("app_webhooks", {
              p_server: openServer,
              p_action: "delete",
              p_data: { id },
            });
            hookURL = "";
            render();
          }
          break;
        case "unban":
          await api("member/moderate", {
            server: openServer,
            user: id,
            action: "unban",
          });
          await refresh();
          render();
          break;
      }
      updateDirty();
    } catch (err) {
      error = errText(err);
      render();
    }
  });
  modal.addEventListener("input", (event) => {
    const t = event.target;
    if (t.dataset.sField) {
      server[t.dataset.sField] = t.value;
      updateDirty();
    } else if (t.dataset.sHex) {
      const value = t.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(value)) role()[t.dataset.sHex] = value;
      updateDirty();
    } else if (t.dataset.sRole) {
      const r = role();
      if (!r) return;
      r[t.dataset.sRole] =
        t.type === "checkbox"
          ? t.checked
          : t.type === "number"
            ? Number(t.value)
            : t.value;
      const name = $(`[data-s-role-name="${r.id}"]`);
      if (name) {
        name.textContent = r.name;
        name.setAttribute("style", roleTextStyle(r));
      }
      updateDirty();
    } else if (t.dataset.sPermission) {
      const r = role();
      r.permissions = t.checked
        ? [...new Set([...r.permissions, t.dataset.sPermission])]
        : r.permissions.filter((p) => p !== t.dataset.sPermission);
      updateDirty();
    }
  });
  modal.addEventListener("change", async (event) => {
    const kind = event.target.dataset.sUpload;
    if (!kind) return;
    event.stopImmediatePropagation();
    try {
      await upload(kind, event.target.files?.[0]);
    } catch (err) {
      error = errText(err);
      render();
    }
  });
  modal.addEventListener("dragstart", (event) => {
    const t = event.target.closest("[data-s-drag-role]");
    if (t && role()?.position !== 0) {
      drag = t.dataset.sDragRole;
      event.dataTransfer.setData("text/plain", drag);
    }
  });
  modal.addEventListener("dragover", (event) => {
    if (drag && event.target.closest("[data-s-drag-role]"))
      event.preventDefault();
  });
  modal.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-s-drag-role]");
    if (!drag || !target) return;
    event.preventDefault();
    const source = roles.find((r) => r.id === drag),
      dest = roles.find((r) => r.id === target.dataset.sDragRole);
    if (source?.position > 0 && dest?.position > 0) {
      roles = roles.filter((r) => r.id !== drag);
      roles.splice(
        roles.findIndex((r) => r.id === dest.id),
        0,
        source,
      );
      roles.forEach(
        (r, i) => (r.position = r.position === 0 ? 0 : roles.length - i - 1),
      );
      render();
    }
    drag = null;
  });
  return { open, close };
};
