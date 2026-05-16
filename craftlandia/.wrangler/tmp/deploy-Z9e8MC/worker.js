var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var DISCORD_CLIENT_ID = "1246462744870256731";
var DISCORD_CLIENT_SECRET = "cwudpxlbWiMXtlqH2K_4LMatgoLTB-qS";
var REDIRECT_URI = "https://craftlandia-ugyfelkapu.koalabalazsnemeth.workers.dev/api/auth/discord/callback";
var FRONTEND_URL = "https://craftlandia-ugyfelkapu.pages.dev/";
var FRONTEND_ORIGIN = "https://craftlandia-ugyfelkapu.pages.dev";
var JWT_SECRET = "k2M5tRqS8vW3uI1oE7aB6fZ9yX0dP4hG";
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace("/api", "");
    const method = request.method;
    if (method === "OPTIONS") return corsResponse(request);
    try {
      if (path === "/auth/discord/callback") return handleDiscordCallback(request, url, env);
      if (path === "/stats" && method === "GET") return handleStats(env);
      if (path === "/eu-projects" && method === "GET") return handleEuProjects(url, env);
      const user = await verifyToken(request, env);
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401, request);
      if (path === "/ceg/alapit" && method === "POST") return handleCegAlapit(request, user, env);
      if (path === "/ado/bevallas" && method === "POST") return handleAdoBevallas(request, user, env);
      if (path === "/okmany/igenyel" && method === "POST") return handleOkmanyIgenyel(request, user, env);
      if (path === "/uzenetek" && method === "GET") return handleUzenetek(user, env);
      if (path === "/uzenetek/read-all" && method === "POST") return handleUzenetReadAll(user, env);
      if (path.startsWith("/uzenetek/") && method === "POST") return handleUzenetRead(path, user, env);
      if (path.startsWith("/uzenetek/") && method === "DELETE") return handleUzenetDelete(path, user, env);
      if (path === "/lakcim/bejelent" && method === "POST") return handleLakcimBejelent(request, user, env);
      if (path === "/panasz/benyujt" && method === "POST") return handlePanaszBenyujt(request, user, env);
      if (path === "/admin/candidate" && method === "POST") return handleAddCandidate(request, user, env);
      if (path === "/admin/inject-funds" && method === "POST") return handleInjectFunds(request, user, env);
      if (path === "/admin/users" && method === "GET") return handleGetUsers(user, env);
      return jsonResponse({ error: "Not Found" }, 404, request);
    } catch (e) {
      console.error(e);
      return jsonResponse({ error: "Internal Server Error", detail: e.message }, 500, request);
    }
  }
};
async function handleDiscordCallback(request, url, env) {
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return new Response("Token exchange failed", { status: 400 });
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const discordUser = await userRes.json();
  await env.DB.prepare(`
    INSERT INTO users (discord_id, username, global_name, avatar, email, created_at, last_login)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(discord_id) DO UPDATE SET
      username = excluded.username,
      global_name = excluded.global_name,
      avatar = excluded.avatar,
      last_login = datetime('now')
  `).bind(
    discordUser.id,
    discordUser.username,
    discordUser.global_name || discordUser.username,
    discordUser.avatar || "",
    discordUser.email || ""
  ).run();
  const dbUser = await env.DB.prepare("SELECT role FROM users WHERE discord_id = ?").bind(discordUser.id).first();
  const role = dbUser?.role || "citizen";
  const sessionToken = await createJWT({
    sub: discordUser.id,
    username: discordUser.username,
    role
  }, env);
  const userParam = encodeURIComponent(JSON.stringify({
    id: discordUser.id,
    username: discordUser.username,
    global_name: discordUser.global_name,
    avatar: discordUser.avatar,
    role
  }));
  const targetUrl = FRONTEND_URL.endsWith("/") ? FRONTEND_URL : FRONTEND_URL + "/";
  return Response.redirect(`${targetUrl}index.html?token=${sessionToken}&user=${userParam}`, 302);
}
__name(handleDiscordCallback, "handleDiscordCallback");
async function createJWT(payload, env) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 864e5 }));
  const sig = await hmacSHA256(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${sig}`;
}
__name(createJWT, "createJWT");
async function verifyToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const [header, body, sig] = token.split(".");
    const expectedSig = await hmacSHA256(`${header}.${body}`, JWT_SECRET);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyToken, "verifyToken");
async function hmacSHA256(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(hmacSHA256, "hmacSHA256");
async function handleStats(env) {
  const [cegs, users, funds, cases] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as n FROM cegek").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM users").first(),
    env.DB.prepare('SELECT SUM(amount) as n FROM eu_projects WHERE status = "paid"').first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM ugyiratok").first()
  ]);
  return jsonResponse({
    companies: cegs?.n || 0,
    citizens: users?.n || 0,
    eu_funds: funds?.n || 0,
    cases_handled: cases?.n || 0
  });
}
__name(handleStats, "handleStats");
async function handleEuProjects(url, env) {
  const status = url.searchParams.get("status") || "";
  const category = url.searchParams.get("category") || "";
  let query = "SELECT * FROM eu_projects WHERE 1=1";
  const bindings = [];
  if (status) {
    query += " AND status = ?";
    bindings.push(status);
  }
  if (category) {
    query += " AND category = ?";
    bindings.push(category);
  }
  query += " ORDER BY date DESC";
  const projects = await env.DB.prepare(query).bind(...bindings).all();
  return jsonResponse({ projects: projects.results || [] });
}
__name(handleEuProjects, "handleEuProjects");
async function handleCegAlapit(request, user, env) {
  const body = await request.json();
  const ugy_szam = "CEG-" + Date.now().toString(36).toUpperCase();
  await env.DB.prepare(`
    INSERT INTO cegek (ugy_szam, discord_id, ceg_nev, tarsasagi_forma, alaptoke, telepules, utca, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.ceg_nev, body.tarsasagi_forma, body.alaptoke, body.telepules, body.utca).run();
  await insertUzenet(
    env,
    user.sub,
    "Bazsi City \xD6nkorm\xE1nyzat",
    `C\xE9galap\xEDt\xE1si k\xE9relem befogadva \u2013 ${body.ceg_nev}`,
    `Tisztelt K\xE9relmez\u0151!

A(z) ${body.ceg_nev} (${body.tarsasagi_forma.toUpperCase()}) bejegyz\xE9si k\xE9relme (${ugy_szam}) rendszer\xFCnkbe \xE9rkezett. Az elb\xEDr\xE1l\xE1s v\xE1rhat\xF3 ideje 5 munkanap.

Craftlandia C\xE9gjegyz\xE9k`,
    "ceg"
  );
  return jsonResponse({ ugy_szam });
}
__name(handleCegAlapit, "handleCegAlapit");
async function handleAdoBevallas(request, user, env) {
  const body = await request.json();
  const hivatkozas = "ADO-" + Date.now().toString(36).toUpperCase();
  await env.DB.prepare(`
    INSERT INTO adobevallasok (hivatkozas, discord_id, tipus, adoev, adoszam, bevetel, koltseg, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))
  `).bind(hivatkozas, user.sub, body.tipus, body.adoev, body.adoszam, body.bevetel, body.koltseg || 0).run();
  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'adobevallas', ?, datetime('now'))`).bind(user.sub, hivatkozas).run();
  await insertUzenet(
    env,
    user.sub,
    "Craftlandia Ad\xF3hivatal",
    `Ad\xF3bevall\xE1s visszaigazol\xE1s \u2013 ${hivatkozas}`,
    `Tisztelt Ad\xF3z\xF3!

A(z) ${body.adoev}. \xE9vi ad\xF3bevall\xE1sa (${hivatkozas}) sikeresen befogadva. Feldolgoz\xE1s: 10 munkanap.

Craftlandia Ad\xF3hivatal`,
    "ado"
  );
  return jsonResponse({ hivatkozas });
}
__name(handleAdoBevallas, "handleAdoBevallas");
async function handleOkmanyIgenyel(request, user, env) {
  const body = await request.json();
  const ugy_szam = "OKM-" + Date.now().toString(36).toUpperCase();
  await env.DB.prepare(`
    INSERT INTO okmany_igenylasek (ugy_szam, discord_id, tipus, nev, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.tipus, body.nev).run();
  await insertUzenet(
    env,
    user.sub,
    "Craftlandia Okm\xE1nyiroda",
    `Okm\xE1nyig\xE9nyl\xE9s befogadva \u2013 ${ugy_szam}`,
    `Tisztelt K\xE9relmez\u0151!

Az okm\xE1nyig\xE9nyl\xE9si k\xE9relm\xE9t (${ugy_szam}) befogadtuk. Az elk\xE9sz\xEDt\xE9s \xE9s k\xE9zbes\xEDt\xE9s v\xE1rhat\xF3 ideje: 10\u201330 munkanap.

Craftlandia Okm\xE1nyiroda`,
    "ertesites"
  );
  return jsonResponse({ ugy_szam });
}
__name(handleOkmanyIgenyel, "handleOkmanyIgenyel");
async function handleLakcimBejelent(request, user, env) {
  const body = await request.json();
  const ugy_szam = "LAK-" + Date.now().toString(36).toUpperCase();
  await env.DB.prepare(`
    INSERT INTO lakcim_bejelentesek (ugy_szam, discord_id, nev, telepules, utca, irsz, tipus, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.nev, body.telepules, body.utca, body.irsz, body.tipus || "allando").run();
  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'lakcim', ?, datetime('now'))`).bind(user.sub, ugy_szam).run();
  await insertUzenet(
    env,
    user.sub,
    "Bel\xFCgyminiszt\xE9rium",
    `Lakc\xEDmbejelent\xE9s visszaigazol\xE1s \u2013 ${ugy_szam}`,
    `Tisztelt ${body.nev}!

Lakc\xEDmbejelent\xE9si k\xE9relm\xE9t (${ugy_szam}) r\xF6gz\xEDtett\xFCk. Az adatok ellen\u0151rz\xE9se folyamatban van. Amennyiben minden adat helyes, az \xFAj lakc\xEDmk\xE1rty\xE1t 15 munkanapon bel\xFCl post\xE1zzuk.

Bel\xFCgyminiszt\xE9rium Nyilv\xE1ntart\xF3 Hivatal`,
    "ertesites"
  );
  return jsonResponse({ ugy_szam });
}
__name(handleLakcimBejelent, "handleLakcimBejelent");
async function handlePanaszBenyujt(request, user, env) {
  const body = await request.json();
  const ugy_szam = "PAN-" + Date.now().toString(36).toUpperCase();
  await env.DB.prepare(`
    INSERT INTO panaszok (ugy_szam, discord_id, panasz_tipus, szerv_neve, leiras, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.tipus, body.hivatal, body.leiras).run();
  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'panasz', ?, datetime('now'))`).bind(user.sub, ugy_szam).run();
  await insertUzenet(
    env,
    user.sub,
    "\xC1llami Sz\xE1mvev\u0151sz\xE9k",
    `Panaszbefogad\xE1s \u2013 ${ugy_szam}`,
    `Tisztelt Bejelent\u0151!

A(z) ${body.hivatal} elleni panasz\xE1t (${ugy_szam}) befogadtuk. Az \xFCgy kivizsg\xE1l\xE1sa megkezd\u0151d\xF6tt. V\xE1rhat\xF3 v\xE1laszad\xE1si hat\xE1rid\u0151: 30 nap.

\xC1llami Sz\xE1mvev\u0151sz\xE9k Jogorvoslati F\u0151oszt\xE1ly`,
    "hatarozat"
  );
  return jsonResponse({ ugy_szam });
}
__name(handlePanaszBenyujt, "handlePanaszBenyujt");
async function handleUzenetek(user, env) {
  const msgs = await env.DB.prepare(`
    SELECT * FROM uzenetek WHERE discord_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(user.sub).all();
  return jsonResponse({ messages: msgs.results || [] });
}
__name(handleUzenetek, "handleUzenetek");
async function handleUzenetReadAll(user, env) {
  await env.DB.prepare(`UPDATE uzenetek SET read = 1 WHERE discord_id = ?`).bind(user.sub).run();
  return jsonResponse({ ok: true });
}
__name(handleUzenetReadAll, "handleUzenetReadAll");
async function handleUzenetRead(path, user, env) {
  const id = path.split("/")[2];
  await env.DB.prepare(`UPDATE uzenetek SET read = 1 WHERE id = ? AND discord_id = ?`).bind(id, user.sub).run();
  return jsonResponse({ ok: true });
}
__name(handleUzenetRead, "handleUzenetRead");
async function handleUzenetDelete(path, user, env) {
  const id = path.split("/")[2];
  await env.DB.prepare(`DELETE FROM uzenetek WHERE id = ? AND discord_id = ?`).bind(id, user.sub).run();
  return jsonResponse({ ok: true });
}
__name(handleUzenetDelete, "handleUzenetDelete");
async function insertUzenet(env, discord_id, from_name, subject, body, category) {
  await env.DB.prepare(`
    INSERT INTO uzenetek (discord_id, from_name, subject, body, category, read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
  `).bind(discord_id, from_name, subject, body, category).run();
}
__name(insertUzenet, "insertUzenet");
async function handleAddCandidate(request, user, env) {
  if (user.role !== "pm" && user.role !== "admin") return jsonResponse({ error: "Forbidden" }, 403);
  const body = await request.json();
  await env.DB.prepare(`
    INSERT INTO candidates (discord_id, name, party, slogan, statement, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(body.discord_id, body.name, body.party || "", body.slogan || "", body.statement || "").run();
  return jsonResponse({ ok: true });
}
__name(handleAddCandidate, "handleAddCandidate");
async function handleInjectFunds(request, user, env) {
  if (user.role !== "pm" && user.role !== "admin") return jsonResponse({ error: "Forbidden" }, 403);
  const body = await request.json();
  const project_id = "TREASURY-" + Date.now().toString(36).toUpperCase();
  await env.DB.prepare(`
    INSERT INTO treasury_log (discord_id, amount, source, reason, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(user.sub, body.amount, body.source || "K\xF6zponti K\xF6lts\xE9gvet\xE9s", body.reason || "").run();
  await env.DB.prepare(`
    INSERT INTO eu_projects (project_id, name, municipality, category, amount, paid, status, progress, description, date)
    VALUES (?, ?, 'Orsz\xE1gos', 'economy', ?, ?, 'paid', 100, ?, date('now'))
  `).bind(project_id, `Forr\xE1sinjekci\xF3: ${body.source}`, body.amount, body.amount, body.reason || "Kincst\xE1ri forr\xE1sb\u0151v\xEDt\xE9s").run();
  return jsonResponse({ ok: true });
}
__name(handleInjectFunds, "handleInjectFunds");
async function handleGetUsers(user, env) {
  if (user.role !== "pm" && user.role !== "admin") return jsonResponse({ error: "Forbidden" }, 403);
  const users = await env.DB.prepare("SELECT discord_id, username, global_name, role, polgarsag FROM users LIMIT 100").all();
  return jsonResponse({ users: users.results || [] });
}
__name(handleGetUsers, "handleGetUsers");
function getCorsHeaders(request) {
  const origin = request ? request.headers.get("Origin") : null;
  const allowed = origin && (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("craftlandia.gov"));
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed ? origin : FRONTEND_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function jsonResponse(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getCorsHeaders(request)
  });
}
__name(jsonResponse, "jsonResponse");
function corsResponse(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}
__name(corsResponse, "corsResponse");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
