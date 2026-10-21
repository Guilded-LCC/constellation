import { chromium } from "playwright";
import pg from "pg";
import fs from "node:fs/promises";
import sharp from "sharp";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("../verification/", import.meta.url));
await fs.mkdir(output, { recursive: true });
const url = process.env.SUPABASE_URL,
  key = process.env.CONSTELLATION_ADMIN_KEY,
  pub = process.env.SUPABASE_PUBLISHABLE_KEY;
const report = {
  phase: "A",
  started: new Date().toISOString(),
  checks: [],
  security: [],
  screenshots: [],
  viewportChecks: [],
  console: [],
  errors: [],
  gaps: [],
};
const admin = async (path, body) => {
  const res = await fetch(url + "/auth/v1/" + path, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok)
    throw Error(
      `Admin request failed: ${res.status} ${json.msg || json.message}`,
    );
  return json;
};
const token = async (email) => {
  const link = await admin("admin/generate_link", {
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:8766/" },
  });
  const res = await fetch(url + "/auth/v1/verify", {
    method: "POST",
    headers: { apikey: pub, "Content-Type": "application/json" },
    body: JSON.stringify({ token_hash: link.hashed_token, type: "magiclink" }),
  });
  const data = await res.json();
  if (!res.ok) throw Error("Verification token failed");
  return data.access_token;
};
async function call(bearer, name, args, deny = false) {
  const res = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: pub,
      Authorization: "Bearer " + bearer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (deny) {
    assert(!res.ok, "Unauthorized RPC unexpectedly succeeded");
    return { status: res.status, message: data.message };
  }
  if (!res.ok) throw Error(`${name}: ${data.message}`);
  return data;
}
let browser, db, fixture, activePage;
try {
  db = new pg.Client({
    connectionString: process.env.CONSTELLATION_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await db.connect();
  try {
    fixture = JSON.parse(await fs.readFile(output + "fixture.json", "utf8"));
    if (fixture.cleaned) throw Error("Start a new disposable verification set");
  } catch {
    const email = `phase-verify-${Date.now()}@example.invalid`,
      fresh = await admin("admin/users", {
        email,
        email_confirm: true,
        user_metadata: {
          name: "Verification Member",
          username: "verify_" + Date.now(),
        },
      });
    fixture = {
      email,
      user: fresh.id,
      servers: [],
      created: new Date().toISOString(),
    };
    await fs.writeFile(
      output + "fixture.json",
      JSON.stringify(fixture, null, 2),
    );
  }
  const existingToken = await token("admin@example.com"),
    freshToken = await token(fixture.email);
  if (!fixture.guest) {
    const email = `phase-guest-${Date.now()}@example.invalid`,
      guest = await admin("admin/users", {
        email,
        email_confirm: true,
        user_metadata: {
          name: "Verification Guest",
          username: "guest_" + Date.now(),
        },
      });
    fixture.guest = guest.id;
    fixture.guestEmail = email;
    await fs.writeFile(
      output + "fixture.json",
      JSON.stringify(fixture, null, 2),
    );
  }
  await db.query(
    "delete from roles where server_id=any($1::uuid[]) and position>0",
    [fixture.servers],
  );
  await db.query(
    "update servers set visibility='private',invite_policy='permission',notification_level='mentions',avatar_url='',banner_url='' where id=any($1::uuid[])",
    [fixture.servers],
  );
  for (const table of ["server_groups", "server_emotes", "server_webhooks"])
    await db.query(`delete from ${table} where server_id=any($1::uuid[])`, [
      fixture.servers,
    ]);
  if (fixture.server)
    await db.query("delete from members where server_id=$1 and user_id=$2", [
      fixture.server,
      fixture.user,
    ]);
  const existingId = (
    await db.query("select id from auth.users where email='admin@example.com'")
  ).rows[0].id;
  if (!fixture.server) {
    const s = await call(existingToken, "app_api", {
      p_action: "server/create",
      p_payload: { name: "UI Verification Lab" },
    });
    fixture.server = s.id;
    fixture.servers.push(s.id);
    await fs.writeFile(
      output + "fixture.json",
      JSON.stringify(fixture, null, 2),
    );
  }
  const baseState = await call(existingToken, "app_state", {}),
    server = baseState.servers.find((s) => s.id === fixture.server),
    channel = server.channels.find((c) => c.name === "general");
  report.missingProfiles = Number(
    (
      await db.query(
        "select count(*) from auth.users u left join public.profiles p on p.id=u.id where p.id is null",
      )
    ).rows[0].count,
  );
  assert.equal(report.missingProfiles, 0);
  assert(
    !(await call(freshToken, "app_state", {})).servers.some(
      (s) => s.id === fixture.server,
    ),
  );
  report.security.push({
    test: "non-member cannot read server settings",
    ...(await call(
      freshToken,
      "app_settings",
      { p_server: fixture.server },
      true,
    )),
  });
  const directWrite = await fetch(
    url + "/rest/v1/roles?id=eq." + server.roles[0].id,
    {
      method: "PATCH",
      headers: {
        apikey: pub,
        Authorization: "Bearer " + freshToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Unauthorized direct write" }),
    },
  );
  assert(!directWrite.ok);
  report.security.push({
    test: "direct roles table write rejected",
    status: directWrite.status,
  });
  const directRead = await fetch(url + "/rest/v1/server_webhooks?select=*", {
    headers: { apikey: pub, Authorization: "Bearer " + freshToken },
  });
  assert(!directRead.ok);
  report.security.push({
    test: "direct webhook table read rejected",
    status: directRead.status,
  });
  const deniedUpload = await fetch(
    url +
      "/storage/v1/object/community-media/servers/" +
      fixture.server +
      "/role-icons/unauthorized.png",
    {
      method: "POST",
      headers: {
        apikey: pub,
        Authorization: "Bearer " + freshToken,
        "Content-Type": "image/png",
      },
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9gAAAABJRU5ErkJggg==",
        "base64",
      ),
    },
  );
  const storageError = await deniedUpload.json();
  assert(!deniedUpload.ok && /row.level security/i.test(storageError.message));
  report.security.push({
    test: "non-manager role-icon upload rejected by Storage RLS",
    status: deniedUpload.status,
    message: storageError.message,
  });
  const unauthorized = await call(
    freshToken,
    "app_roles_save",
    { p_server: fixture.server, p_roles: server.roles },
    true,
  );
  report.security.push({
    test: "non-member cannot save roles",
    ...unauthorized,
  });
  const invite = await call(existingToken, "app_settings", {
    p_server: fixture.server,
    p_action: "invite/create",
    p_data: { hours: 24 },
  });
  await call(freshToken, "app_api", {
    p_action: "server/join",
    p_payload: { code: invite.code },
  });
  report.security.push({
    test: "member without Manage roles cannot save roles",
    ...(await call(
      freshToken,
      "app_roles_save",
      { p_server: fixture.server, p_roles: server.roles },
      true,
    )),
  });
  report.security.push({
    test: "member cannot change server settings",
    ...(await call(
      freshToken,
      "app_settings",
      {
        p_server: fixture.server,
        p_action: "server/save",
        p_data: { name: "Unauthorized" },
      },
      true,
    )),
  });
  report.security.push({
    test: "member cannot create groups",
    ...(await call(
      freshToken,
      "app_settings",
      {
        p_server: fixture.server,
        p_action: "group/save",
        p_data: { name: "Unauthorized" },
      },
      true,
    )),
  });
  report.security.push({
    test: "member cannot read webhook settings",
    ...(await call(
      freshToken,
      "app_webhooks",
      { p_server: fixture.server },
      true,
    )),
  });
  if (
    !(
      await db.query("select 1 from messages where channel_id=$1 and body=$2", [
        channel.id,
        "A community built together.",
      ])
    ).rowCount
  )
    await call(existingToken, "app_api", {
      p_action: "message/send",
      p_payload: { channel: channel.id, body: "A community built together." },
    });
  const image = await sharp(
    Buffer.from(
      '<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" rx="35" fill="#213b4d"/><path d="M150 32 245 85v90l-95 93-95-93V85Z" fill="#f4cf40"/><path d="m101 145 35 35 64-75" fill="none" stroke="#213b4d" stroke-width="19"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  browser = await chromium.launch({ headless: true });
  for (const account of [
    { name: "existing", email: "admin@example.com", server: fixture.server },
    {
      name: "fresh",
      email: fixture.email,
      server: fixture.freshServer || null,
    },
  ]) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      }),
      page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(12000);
    const errors = [],
      consoleOutput = [];
    page.on("console", (m) => {
      consoleOutput.push({ type: m.type(), text: m.text() });
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const measure = async (view) => {
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        dialog: document.querySelector("#modal[open]")?.scrollWidth || 0,
      }));
      assert(
        metrics.document <= metrics.width &&
          metrics.body <= metrics.width &&
          metrics.dialog <= metrics.width,
        JSON.stringify(metrics),
      );
      report.viewportChecks.push({
        account: account.name,
        view,
        ...metrics,
        horizontalOverflow: false,
      });
    };
    const signIn = async () => {
      const link = await admin("admin/generate_link", {
        type: "magiclink",
        email: account.email,
        redirect_to: "http://localhost:8766/",
      });
      await page.goto(link.action_link, { waitUntil: "domcontentloaded" });
      await page.locator(".layout").waitFor();
    };
    await signIn();
    if (!account.server) {
      const bearer = await token(account.email);
      const s = await call(bearer, "app_api", {
        p_action: "server/create",
        p_payload: { name: "Fresh Verification Lab" },
      });
      account.server = s.id;
      fixture.freshServer = s.id;
      fixture.servers.push(s.id);
      await fs.writeFile(
        output + "fixture.json",
        JSON.stringify(fixture, null, 2),
      );
      await page.reload();
      await page.locator(".layout").waitFor();
    }
    // Server names are not unique, so select the fixture server by id instead
    // of by title: two servers may legitimately share a name.
    await page.locator(`.rail button[data-id="${account.server}"]`).click();
    await page.locator('[data-action="server-menu"]').click();
    await page.locator('.context-menu [data-action="settings"]').click();
    await page.locator(".s-shell").waitFor();
    assert(await page.locator('[data-s-action="save"]').isDisabled());
    await page.locator('[data-s-action="tab"][data-id="roles"]').click();
    await page.locator('[data-s-action="add-role"]').click();
    await page.locator("#s-role-name").fill("Initiate");
    assert.equal(
      await page
        .locator(".s-role-choice.selected [data-s-role-name]")
        .textContent(),
      "Initiate",
    );
    await page.locator('[data-s-action="gradient"]').click();
    await page.locator('[data-s-action="preset"][data-id="6"]').click();
    await page.locator('[data-s-role="hoist"]').check();
    await page
      .locator('[data-s-upload="role"]')
      .setInputFiles({
        name: "verification-role.png",
        mimeType: "image/png",
        buffer: image,
      });
    await page.locator(".s-icon-preview img").waitFor();
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    assert.equal(await page.locator(".s-error").count(), 0);
    report.checks.push(
      account.name +
        ": role create, live name, gradient, image upload and transaction save passed",
    );
    const bearer =
      account.name === "existing" ? existingToken : await token(account.email);
    let savedState = await call(bearer, "app_state", {}),
      saved = savedState.servers.find((s) => s.id === account.server),
      savedRole = saved.roles.find((r) => r.name === "Initiate");
    assert(
      savedRole?.color2 && savedRole?.icon_url && savedRole?.hoist,
      JSON.stringify(savedRole),
    );
    await call(bearer, "app_api", {
      p_action: "member/role",
      p_payload: {
        server: account.server,
        user: account.name === "existing" ? existingId : fixture.user,
        role: savedRole.id,
        enabled: true,
      },
    });
    if (account.name === "existing")
      await call(bearer, "app_api", {
        p_action: "member/role",
        p_payload: {
          server: account.server,
          user: fixture.user,
          role: savedRole.id,
          enabled: true,
        },
      });
    await page.locator("#s-role-name").fill("Initiate edited");
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    await page.locator("#s-role-name").fill("Discard me");
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-s-action="cancel"]').click();
    await page.locator(".s-shell").waitFor({ state: "hidden" });
    await page.locator('[data-action="server-menu"]').click();
    await page.locator('.context-menu [data-action="settings"]').click();
    await page.locator('[data-s-action="tab"][data-id="roles"]').click();
    await page
      .locator('[data-s-action="role"]')
      .filter({ hasText: "Initiate edited" })
      .click();
    assert.equal(
      await page.locator("#s-role-name").inputValue(),
      "Initiate edited",
    );
    await page.locator('[data-s-action="add-role"]').click();
    await page.locator("#s-role-name").fill("Disposable role");
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-s-action="delete-role"]').click();
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    assert.equal(
      await page
        .locator(".s-role-choice")
        .filter({ hasText: "Disposable role" })
        .count(),
      0,
    );
    const securityState = (await call(bearer, "app_state", {})).servers.find(
        (s) => s.id === account.server,
      ),
      invalidRoles = structuredClone(securityState.roles);
    invalidRoles[0].name = "Should roll back";
    invalidRoles.at(-1).color = "invalid";
    report.security.push({
      test: account.name + ": invalid batch rejected atomically",
      ...(await call(
        bearer,
        "app_roles_save",
        { p_server: account.server, p_roles: invalidRoles },
        true,
      )),
    });
    const afterInvalid = (await call(bearer, "app_state", {})).servers.find(
      (s) => s.id === account.server,
    );
    assert.equal(afterInvalid.roles[0].name, securityState.roles[0].name);
    if (account.name === "existing") {
      const deniedRoles = structuredClone(afterInvalid.roles);
      deniedRoles.find((r) => r.position === 0).permissions = deniedRoles
        .find((r) => r.position === 0)
        .permissions.filter(
          (p) => p !== "send_messages" && p !== "view_channels",
        );
      await call(bearer, "app_roles_save", {
        p_server: account.server,
        p_roles: deniedRoles,
      });
      report.security.push({
        test: "removing Read messages blocks channel reads server-side",
        ...(await call(
          freshToken,
          "app_messages",
          { p_channel: channel.id },
          true,
        )),
      });
      report.security.push({
        test: "removing Send messages blocks posting server-side",
        ...(await call(
          freshToken,
          "app_api",
          {
            p_action: "message/send",
            p_payload: { channel: channel.id, body: "Must not be saved" },
          },
          true,
        )),
      });
      await call(bearer, "app_roles_save", {
        p_server: account.server,
        p_roles: afterInvalid.roles,
      });
    }
    const names = [
        "Captain",
        "Admin",
        "Mod",
        "Social",
        "Subscriber",
        "Streamer",
        "VIP",
      ],
      colors = [
        "#cc760b",
        "#b0b1ba",
        "#ed7f81",
        "#e880cf",
        "#a3a6b4",
        "#6687ff",
        "#935df1",
      ];
    const extra = names.map((name, i) => ({
      ...savedRole,
      id: crypto.randomUUID(),
      name,
      color: colors[i],
      color2: "",
      position: names.length + 1 - i,
      hoist: false,
    }));
    await call(bearer, "app_roles_save", {
      p_server: account.server,
      p_roles: [...extra, ...afterInvalid.roles],
    });
    await page.locator('[data-s-action="close"]').click();
    await page.reload();
    await page.locator(".layout").waitFor();
    await page.locator(`.rail button[title="${name}"]`).click();
    await page.locator('[data-action="server-menu"]').click();
    await page.locator('.context-menu [data-action="settings"]').click();
    await page.locator('[data-s-action="tab"][data-id="roles"]').click();
    await page
      .locator('[data-s-action="role"]')
      .filter({ hasText: "Initiate edited" })
      .click();
    await page
      .locator('[data-s-action="role"]')
      .filter({ hasText: "Mod" })
      .dragTo(
        page.locator('[data-s-action="role"]').filter({ hasText: "Captain" }),
      );
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    assert.equal(
      (await call(bearer, "app_state", {})).servers.find(
        (s) => s.id === account.server,
      ).roles[0].name,
      "Mod",
    );
    await page
      .locator('[data-s-action="role"]')
      .filter({ hasText: "Mod" })
      .dragTo(
        page.locator('[data-s-action="role"]').filter({ hasText: "Social" }),
      );
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    await page
      .locator('[data-s-action="role"]')
      .filter({ hasText: "Member", exact: false })
      .click();
    assert.equal(
      await page.locator('[data-s-action="delete-role"]').count(),
      0,
    );
    assert.equal(
      await page.locator(".s-role-choice.selected").getAttribute("draggable"),
      "false",
    );
    await page
      .locator('[data-s-action="role"]')
      .filter({ hasText: "Initiate edited" })
      .click();
    for (const width of [1280, 900, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.screenshot({
        path: output + `phase-a-${account.name}-roles-${width}.png`,
      });
      report.screenshots.push(`phase-a-${account.name}-roles-${width}.png`);
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth > innerWidth,
        dialog: document.querySelector("#modal").scrollWidth > innerWidth,
        content:
          document.querySelector(".s-content").scrollWidth >
          document.querySelector(".s-content").clientWidth,
      }));
      assert(
        !Object.values(overflow).some(Boolean),
        JSON.stringify({ width, overflow }),
      );
      await measure("roles");
      await page.locator('[data-s-action="tab"][data-id="overview"]').click();
      await page.screenshot({
        path: output + `phase-a-${account.name}-overview-${width}.png`,
      });
      await page.locator('[data-s-action="tab"][data-id="roles"]').click();
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-s-action="tab"][data-id="groups"]').click();
    await page.locator("#s-group-name").fill("Verification Group");
    await page.locator("#s-group-description").fill("A test group");
    await page.locator('[data-s-action="add-group"]').click();
    await page
      .locator(".s-record")
      .filter({ hasText: "Verification Group" })
      .waitFor();
    const groupDialog = (d) =>
      d.accept(
        d.message() === "Group name"
          ? "Edited Group"
          : "Edited group description",
      );
    page.on("dialog", groupDialog);
    await page
      .locator('[data-s-action="edit-group"]')
      .filter({ visible: true })
      .last()
      .click();
    await page
      .locator(".s-record")
      .filter({ hasText: "Edited Group" })
      .waitFor();
    page.off("dialog", groupDialog);
    page.once("dialog", (d) => d.accept());
    await page
      .locator(".s-record")
      .filter({ hasText: "Edited Group" })
      .locator('[data-s-action="delete-group"]')
      .click();
    await page
      .locator(".s-record")
      .filter({ hasText: "Edited Group" })
      .waitFor({ state: "hidden" });
    await page.locator('[data-s-action="tab"][data-id="emotes"]').click();
    await page.locator("#s-emote-name").fill("verification_icon");
    await page
      .locator('[data-s-upload="emote"]')
      .setInputFiles({
        name: "emote.png",
        mimeType: "image/png",
        buffer: image,
      });
    await page
      .locator(".s-record")
      .filter({ hasText: ":verification_icon:" })
      .waitFor();
    page.once("dialog", (d) => d.accept("edited_icon"));
    await page.locator('[data-s-action="edit-emote"]').click();
    await page
      .locator(".s-record")
      .filter({ hasText: ":edited_icon:" })
      .waitFor();
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-s-action="delete-emote"]').click();
    await page
      .locator(".s-record")
      .filter({ hasText: ":edited_icon:" })
      .waitFor({ state: "hidden" });
    await page.locator('[data-s-action="tab"][data-id="privacy"]').click();
    await page.locator('[data-s-field="visibility"]').selectOption("public");
    await page
      .locator('[data-s-field="invite_policy"]')
      .selectOption("managers");
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    await page
      .locator('[data-s-action="tab"][data-id="notifications"]')
      .click();
    await page
      .locator('[data-s-field="notification_level"]')
      .selectOption("all");
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    await page.locator('[data-s-action="tab"][data-id="overview"]').click();
    await page
      .locator('[data-s-upload="avatar"]')
      .setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: image,
      });
    await page.locator(".s-avatar img").waitFor();
    await page
      .locator('[data-s-upload="banner"]')
      .setInputFiles({
        name: "banner.png",
        mimeType: "image/png",
        buffer: image,
      });
    await page.locator(".s-banner img").waitFor();
    await page
      .locator('[data-s-field="description"]')
      .fill("Verification description saved in Supabase.");
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    const settingsSaved = await call(bearer, "app_settings", {
      p_server: account.server,
    });
    assert.equal(settingsSaved.server.visibility, "public");
    assert.equal(settingsSaved.server.invite_policy, "managers");
    assert.equal(settingsSaved.server.notification_level, "all");
    assert(settingsSaved.server.banner_url && settingsSaved.server.avatar_url);
    for (const width of [1280, 900, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await measure("overview");
      await page.screenshot({
        path: output + `phase-a-${account.name}-overview-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .locator('[data-s-action="remove-media"][data-id="avatar"]')
      .click();
    await page
      .locator('[data-s-action="remove-media"][data-id="banner"]')
      .click();
    await page.locator('[data-s-action="save"]').click();
    await page
      .locator('[data-s-action="save"]:disabled:not([data-saving="true"])')
      .waitFor();
    await page.locator('[data-s-action="tab"][data-id="invites"]').click();
    const beforeInvites = await page
      .locator('[data-s-action="revoke-invite"]')
      .count();
    await page.locator('[data-s-action="create-invite"]').click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll('[data-s-action="revoke-invite"]').length ===
        n + 1,
      beforeInvites,
    );
    await page.locator('[data-s-action="revoke-invite"]').first().click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll('[data-s-action="revoke-invite"]').length ===
        n,
      beforeInvites,
    );
    const guestInvite = await call(bearer, "app_settings", {
      p_server: account.server,
      p_action: "invite/create",
      p_data: { hours: 24 },
    });
    const guestToken = await token(fixture.guestEmail);
    await call(guestToken, "app_api", {
      p_action: "server/join",
      p_payload: { code: guestInvite.code },
    });
    await call(bearer, "app_api", {
      p_action: "member/moderate",
      p_payload: { server: account.server, user: fixture.guest, action: "ban" },
    });
    await refreshBans();
    async function refreshBans() {
      await page.locator('[data-s-action="close"]').click();
      await page.reload();
      await page.locator(".layout").waitFor();
      await page.locator(`.rail button[title="${name}"]`).click();
      await page.locator('[data-action="server-menu"]').click();
      await page.locator('.context-menu [data-action="settings"]').click();
      await page.locator('[data-s-action="tab"][data-id="bans"]').click();
      await page
        .locator(".s-record")
        .filter({ hasText: "Verification Guest" })
        .waitFor();
      await page.locator('[data-s-action="unban"]').click();
      await page
        .locator(".s-record")
        .filter({ hasText: "Verification Guest" })
        .waitFor({ state: "hidden" });
    }
    await db.query(
      "update invites set expires_at=now()-interval '1 minute' where code=$1",
      [guestInvite.code],
    );
    report.security.push({
      test: account.name + ": expired invitation rejected",
      ...(await call(
        guestToken,
        "app_api",
        { p_action: "server/join", p_payload: { code: guestInvite.code } },
        true,
      )),
    });
    await call(guestToken, "app_join_public_server", {
      p_server: account.server,
    });
    await call(guestToken, "app_api", {
      p_action: "server/leave",
      p_payload: { server: account.server },
    });
    const publicSettings = await call(bearer, "app_settings", {
      p_server: account.server,
    });
    await call(bearer, "app_settings", {
      p_server: account.server,
      p_action: "server/save",
      p_data: { ...publicSettings.server, visibility: "private" },
    });
    report.security.push({
      test: account.name + ": private server rejects public join",
      ...(await call(
        guestToken,
        "app_join_public_server",
        { p_server: account.server },
        true,
      )),
    });
    assert(
      !(await call(guestToken, "app_discover_servers", {})).some(
        (s) => s.id === account.server,
      ),
    );
    await call(bearer, "app_settings", {
      p_server: account.server,
      p_action: "server/save",
      p_data: publicSettings.server,
    });
    assert(
      (await call(guestToken, "app_discover_servers", {})).some(
        (s) => s.id === account.server,
      ),
    );
    await page.locator('[data-s-action="tab"][data-id="webhooks"]').click();
    await page.locator("#s-hook-name").fill("Verification hook");
    await page.locator('[data-s-action="create-hook"]').click();
    await page.getByLabel("Webhook URL").waitFor();
    const hookURL = await page.getByLabel("Webhook URL").inputValue();
    assert(hookURL.includes("/incoming-webhook?token="));
    const hookToken = new URL(hookURL).searchParams.get("token");
    const posted = await call(bearer, "app_webhook_post", {
      p_token: hookToken,
      p_content: "Webhook database permission check.",
    });
    assert(posted.id);
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-s-action="delete-hook"]').click();
    await page
      .locator('[data-s-action="delete-hook"]')
      .waitFor({ state: "hidden" });
    report.security.push({
      test: account.name + ": revoked webhook token cannot post",
      ...(await call(
        bearer,
        "app_webhook_post",
        { p_token: hookToken, p_content: "Should fail" },
        true,
      )),
    });
    report.checks.push(
      account.name +
        ": groups and emotes create/edit/delete, privacy, notification default, avatar/banner upload/remove, expiring invites create/revoke, webhook configuration and database posting passed",
    );
    const postChannel = (await call(bearer, "app_state", {})).servers
      .find((s) => s.id === account.server)
      .channels.find((c) => c.name === "general");
    await call(bearer, "app_api", {
      p_action: "message/send",
      p_payload: {
        channel: postChannel.id,
        body: "The gradient role and icon are saved in Supabase.",
      },
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-s-action="close"]').click();
    await page.reload();
    await page.locator(".layout").waitFor();
    await page.locator(`.rail button[title="${name}"]`).click();
    await page
      .locator('[data-action="channel"]')
      .filter({ hasText: "general" })
      .first()
      .click();
    await page.locator(".message").first().waitFor();
    for (const width of [1280, 900, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await measure("chat");
      await page.screenshot({
        path: output + `phase-a-${account.name}-chat-${width}.png`,
      });
      if (width < 700) await page.locator('[data-action="nav"]').click();
      await page.locator('[data-action="server-menu"]').click();
      await measure("dropdown");
      await page.screenshot({
        path: output + `phase-a-${account.name}-dropdown-${width}.png`,
      });
      await page.locator('.context-menu [data-action="settings"]').click();
      await page.locator('[data-s-action="close"]').click();
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('.rail [data-action="profile"]').click();
    await page.locator('[data-action="logout"]').click();
    await page.locator("#auth-form").waitFor();
    await signIn();
    assert.deepEqual(errors, []);
    report.console.push({
      account: account.name,
      output: consoleOutput,
      pageErrors: errors,
    });
    report.checks.push(
      account.name +
        ": edit, discard, delete, hard refresh and sign-out/sign-in passed; empty console",
    );
    const evidence = await context.newPage();
    await evidence.setViewportSize({ width: 1280, height: 800 });
    await evidence.setContent(
      `<html><body style="margin:0;padding:40px;background:#1c1e24;color:#e7eaf1;font:16px Consolas,monospace"><h1>Chromium console capture — ${account.name}</h1><p>Captured from the localhost browser during the Phase A flow.</p><p>Console errors: ${errors.length} · Captured console entries: ${consoleOutput.length}</p><pre>${JSON.stringify(consoleOutput, null, 2).replaceAll("<", "&lt;")}</pre><h2>Uncaught page errors</h2><pre>${JSON.stringify(errors, null, 2)}</pre><p>Viewport checks: 1280×800, 900×800, 390×800 — no horizontal overflow.</p></body></html>`,
    );
    await evidence.screenshot({
      path: output + `phase-a-${account.name}-console-1280.png`,
    });
    await evidence.close();
    await context.close();
  }
  report.status = "BLOCKED";
  report.gaps.push(
    "Incoming webhook Edge Function deployment requires a Supabase management access token. The supplied project secret receives HTTP 401 from the management API.",
  );
} catch (error) {
  report.status = "FAIL";
  report.errors.push(error.stack);
  if (activePage) {
    await activePage
      .screenshot({ path: output + "phase-a-failure.png" })
      .catch(() => {});
    report.visibleError = await activePage
      .locator(".s-error")
      .allTextContents()
      .catch(() => []);
  }
  console.error(error.message);
} finally {
  await browser?.close();
  await db?.end();
  await fs.writeFile(
    output + "phase-a-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks,
        securityTests: report.security.length,
        viewportChecks: report.viewportChecks.length,
        console: report.console,
        errors: report.errors,
        gaps: report.gaps,
      },
      null,
      2,
    ),
  );
}
