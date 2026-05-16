// worker.js – Craftlandia Ügyfélkapu Cloudflare Worker
// Bind a D1 database as DB in wrangler.toml

const DISCORD_CLIENT_ID = '1246462744870256731';
const DISCORD_CLIENT_SECRET = 'cwudpxlbWiMXtlqH2K_4LMatgoLTB-qS';
const REDIRECT_URI = 'https://craftlandia-ugyfelkapu.koalabalazsnemeth.workers.dev/api/auth/discord/callback';
const FRONTEND_URL = 'https://craftlandia-ugyfelkapu.pages.dev';
const FRONTEND_ORIGIN = 'https://craftlandia-ugyfelkapu.pages.dev';
const JWT_SECRET = 'k2M5tRqS8vW3uI1oE7aB6fZ9yX0dP4hG';

// ─── Router ────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') return corsResponse(request);

    try {
      // Public routes
      if (path === '/auth/discord/callback') return handleDiscordCallback(request, url, env);
      if (path === '/stats' && method === 'GET') return handleStats(request, env);
      if (path === '/eu-projects' && method === 'GET') return handleEuProjects(request, url, env);

      // Auth-protected routes
      const user = await verifyToken(request, env);
      if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, request);

      if (path === '/ceg/alapit' && method === 'POST') return handleCegAlapit(request, user, env);
      if (path === '/ado/bevallas' && method === 'POST') return handleAdoBevallas(request, user, env);
      if (path === '/okmany/igenyel' && method === 'POST') return handleOkmanyIgenyel(request, user, env);
      if (path === '/uzenetek' && method === 'GET') return handleUzenetek(request, user, env);
      if (path === '/uzenetek/read-all' && method === 'POST') return handleUzenetReadAll(request, user, env);
      if (path.startsWith('/uzenetek/') && method === 'POST') return handleUzenetRead(request, path, user, env);
      if (path.startsWith('/uzenetek/') && method === 'DELETE') return handleUzenetDelete(request, path, user, env);

      if (path === '/lakcim/bejelent' && method === 'POST') return handleLakcimBejelent(request, user, env);
      if (path === '/panasz/benyujt' && method === 'POST') return handlePanaszBenyujt(request, user, env);
      if (path === '/eu/apply' && method === 'POST') return handleEuApply(request, user, env);
      if (path === '/eu/my-applications' && method === 'GET') return handleGetMyEuApplications(request, user, env);
      if (path === '/my-companies' && method === 'GET') return handleGetMyCompanies(request, user, env);

      // Admin/PM routes
      if (path === '/admin/candidate' && method === 'POST') return handleAddCandidate(request, user, env);
      if (path === '/admin/inject-funds' && method === 'POST') return handleInjectFunds(request, user, env);
      if (path === '/admin/users' && method === 'GET') return handleGetUsers(request, user, env);

      return jsonResponse({ error: 'Not Found' }, 404, request);
    } catch (e) {
      console.error('Worker Error:', e);
      return jsonResponse({ error: 'Internal Server Error', detail: e.message }, 500, request);
    }
  }
};

// ─── Discord OAuth ─────────────────────────────────────────
async function handleDiscordCallback(request, url, env) {
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  // Exchange code for token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return new Response('Token exchange failed', { status: 400 });

  // Fetch Discord user
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const discordUser = await userRes.json();

  // Upsert user in D1
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
    discordUser.avatar || '',
    discordUser.email || ''
  ).run();


  // Get user with role
  const dbUser = await env.DB.prepare('SELECT role FROM users WHERE discord_id = ?').bind(discordUser.id).first();
  const role = dbUser?.role || 'citizen';

  // Create JWT session token
  const sessionToken = await createJWT({ 
    sub: discordUser.id, 
    username: discordUser.username,
    role: role
  }, env);

  // Redirect back to frontend with token + user info
  const userParam = encodeURIComponent(JSON.stringify({
    id: discordUser.id,
    username: discordUser.username,
    global_name: discordUser.global_name,
    avatar: discordUser.avatar,
    role: role
  }));
  const targetUrl = FRONTEND_URL.endsWith('/') ? FRONTEND_URL : FRONTEND_URL + '/';
  return Response.redirect(`${targetUrl}index.html?token=${sessionToken}&user=${userParam}`, 302);
}

// ─── JWT helpers (simple HMAC-SHA256) ────────────────────
async function createJWT(payload, env) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 86400000 }));
  const sig = await hmacSHA256(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${sig}`;
}

async function verifyToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const [header, body, sig] = token.split('.');
    const expectedSig = await hmacSHA256(`${header}.${body}`, JWT_SECRET);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function hmacSHA256(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── Stats (public) ────────────────────────────────────────
async function handleStats(request, env) {
  const [cegs, users, funds, cases] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM cegek').first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM users').first(),
    env.DB.prepare('SELECT SUM(amount) as n FROM eu_projects WHERE status = "paid"').first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM ugyiratok').first(),
  ]);
  return jsonResponse({
    companies: cegs?.n || 0,
    citizens: users?.n || 0,
    eu_funds: funds?.n || 0,
    cases_handled: cases?.n || 0,
  }, 200, request);
}

// ─── EU Projects (public) ──────────────────────────────────
async function handleEuProjects(request, url, env) {
  const status = url.searchParams.get('status') || '';
  const category = url.searchParams.get('category') || '';
  let query = 'SELECT * FROM eu_projects WHERE 1=1';
  const bindings = [];
  if (status) { query += ' AND status = ?'; bindings.push(status); }
  if (category) { query += ' AND category = ?'; bindings.push(category); }
  query += ' ORDER BY date DESC';
  const projects = await env.DB.prepare(query).bind(...bindings).all();
  return jsonResponse({ projects: projects.results || [] }, 200, request);
}

// ─── Cégalapítás ───────────────────────────────────────────
async function handleCegAlapit(request, user, env) {
  const body = await request.json();
  const ugy_szam = 'CEG-' + Date.now().toString(36).toUpperCase();

  await env.DB.prepare(`
    INSERT INTO cegek (ugy_szam, discord_id, ceg_nev, tarsasagi_forma, alaptoke, telepules, utca, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.ceg_nev, body.tarsasagi_forma, body.alaptoke, body.telepules, body.utca).run();

  await insertUzenet(env, user.sub, 'Bazsi City Önkormányzat',
    `Cégalapítási kérelem befogadva – ${body.ceg_nev}`,
    `Tisztelt Kérelmező!\n\nA(z) ${body.ceg_nev} (${body.tarsasagi_forma.toUpperCase()}) bejegyzési kérelme (${ugy_szam}) rendszerünkbe érkezett. Az elbírálás várható ideje 5 munkanap.\n\nCraftlandia Cégjegyzék`,
    'ceg'
  );

  return jsonResponse({ ugy_szam }, 200, request);
}

// ─── Adóbevallás ───────────────────────────────────────────
async function handleAdoBevallas(request, user, env) {
  const body = await request.json();
  const hivatkozas = 'ADO-' + Date.now().toString(36).toUpperCase();

  await env.DB.prepare(`
    INSERT INTO adobevallasok (hivatkozas, discord_id, tipus, adoev, adoszam, bevetel, koltseg, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))
  `).bind(hivatkozas, user.sub, body.tipus, body.adoev, body.adoszam, body.bevetel, body.koltseg || 0).run();

  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'adobevallas', ?, datetime('now'))`).bind(user.sub, hivatkozas).run();

  await insertUzenet(env, user.sub, 'Craftlandia Adóhivatal',
    `Adóbevallás visszaigazolás – ${hivatkozas}`,
    `Tisztelt Adózó!\n\nA(z) ${body.adoev}. évi adóbevallása (${hivatkozas}) sikeresen befogadva. Feldolgozás: 10 munkanap.\n\nCraftlandia Adóhivatal`,
    'ado'
  );

  return jsonResponse({ hivatkozas }, 200, request);
}

// ─── Okmányigénylés ────────────────────────────────────────
async function handleOkmanyIgenyel(request, user, env) {
  const body = await request.json();
  const ugy_szam = 'OKM-' + Date.now().toString(36).toUpperCase();

  await env.DB.prepare(`
    INSERT INTO okmany_igenylasek (ugy_szam, discord_id, tipus, nev, szuldat, anyja_neve, szulhely, kezbesites, postacim, dij, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.tipus, body.nev, body.szuldat, body.anyja_neve, body.szulhely, body.kezbesites, body.postacim, body.dij).run();

  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'okmany', ?, datetime('now'))`).bind(user.sub, ugy_szam).run();

  await insertUzenet(env, user.sub, 'Craftlandia Okmányiroda',
    `Okmányigénylés befogadva – ${ugy_szam}`,
    `Tisztelt ${body.nev}!\n\n${body.tipus} típusú okmányigénylését (${ugy_szam}) rögzítettük. Az okmány elkészüléséről újabb üzenetben értesítjük.\n\nCraftlandia Belügyminisztérium`,
    'ertesites'
  );

  return jsonResponse({ ugy_szam }, 200, request);
}

// ─── Lakcímbejelentés ──────────────────────────────────────
async function handleLakcimBejelent(request, user, env) {
  const body = await request.json();
  const ugy_szam = 'LAK-' + Date.now().toString(36).toUpperCase();

  await env.DB.prepare(`
    INSERT INTO lakcim_bejelentesek (ugy_szam, discord_id, nev, telepules, utca, irsz, tipus, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.nev, body.telepules, body.utca, body.irsz, body.tipus || 'allando').run();

  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'lakcim', ?, datetime('now'))`).bind(user.sub, ugy_szam).run();

  await insertUzenet(env, user.sub, 'Bazsi City Lakcímnyilvántartó',
    `Lakcímbejelentés rögzítve – ${ugy_szam}`,
    `Tisztelt ${body.nev}!\n\nLakcímbejelentési kérelmét (${ugy_szam}) befogadtuk. Az adatok ellenőrzése után postázzuk az új lakcímkártyát.\n\nKözponti Lakcímnyilvántartó`,
    'ertesites'
  );

  return jsonResponse({ ugy_szam }, 200, request);
}

// ─── Panasz benyújtás ──────────────────────────────────────
async function handlePanaszBenyujt(request, user, env) {
  const body = await request.json();
  const ugy_szam = 'PAN-' + Date.now().toString(36).toUpperCase();

  await env.DB.prepare(`
    INSERT INTO panaszok (ugy_szam, discord_id, panasz_tipus, szerv_neve, leiras, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, body.panasz_tipus, body.szerv_neve, body.leiras).run();

  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'panasz', ?, datetime('now'))`).bind(user.sub, ugy_szam).run();

  await insertUzenet(env, user.sub, 'Craftlandia Jogorvoslati Hivatal',
    `Panaszbejelentés érkezett – ${ugy_szam}`,
    `Tisztelt Polgár!\n\nAz Ön által benyújtott panaszt (${ugy_szam}) rögzítettük. Az ügy kivizsgálása megkezdődött.\n\nCraftlandia Ombudsman Hivatala`,
    'hatarozat'
  );

  return jsonResponse({ ugy_szam }, 200, request);
}

// ─── Üzenetek ──────────────────────────────────────────────
async function handleUzenetek(request, user, env) {
  const msgs = await env.DB.prepare(`
    SELECT * FROM uzenetek WHERE discord_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(user.sub).all();
  return jsonResponse({ messages: msgs.results || [] }, 200, request);
}

async function handleUzenetReadAll(request, user, env) {
  await env.DB.prepare(`UPDATE uzenetek SET read = 1 WHERE discord_id = ?`).bind(user.sub).run();
  return jsonResponse({ ok: true }, 200, request);
}

async function handleUzenetRead(request, path, user, env) {
  const id = path.split('/')[2];
  await env.DB.prepare(`UPDATE uzenetek SET read = 1 WHERE id = ? AND discord_id = ?`).bind(id, user.sub).run();
  return jsonResponse({ ok: true }, 200, request);
}

async function handleUzenetDelete(request, path, user, env) {
  const id = path.split('/')[2];
  await env.DB.prepare(`DELETE FROM uzenetek WHERE id = ? AND discord_id = ?`).bind(id, user.sub).run();
  return jsonResponse({ ok: true }, 200, request);
}

// ─── Helper: insert message ────────────────────────────────
async function insertUzenet(env, discord_id, from_name, subject, body, category) {
  await env.DB.prepare(`
    INSERT INTO uzenetek (discord_id, from_name, subject, body, category, read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
  `).bind(discord_id, from_name, subject, body, category).run();
}

// ─── Admin Handlers ────────────────────────────────────────
async function handleAddCandidate(request, user, env) {
  if (user.role !== 'pm' && user.role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403, request);
  const body = await request.json();
  
  await env.DB.prepare(`
    INSERT INTO candidates (discord_id, name, party, slogan, statement, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(body.discord_id, body.name, body.party || '', body.slogan || '', body.statement || '').run();

  return jsonResponse({ ok: true }, 200, request);
}

async function handleInjectFunds(request, user, env) {
  if (user.role !== 'pm' && user.role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403, request);
  const body = await request.json();
  
  // Update EU funds statistics (mocked as inserting a project or updating a global pool)
  // Here we insert a treasury log and create a "Fund Injection" project to show in the list
  const project_id = 'TREASURY-' + Date.now().toString(36).toUpperCase();
  
  await env.DB.prepare(`
    INSERT INTO treasury_log (discord_id, amount, source, reason, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(user.sub, body.amount, body.source || 'Központi Költségvetés', body.reason || '').run();

  // Optionally add to eu_projects to reflect in the UI
  await env.DB.prepare(`
    INSERT INTO eu_projects (project_id, name, municipality, category, amount, paid, status, progress, description, date)
    VALUES (?, ?, 'Országos', 'economy', ?, ?, 'paid', 100, ?, date('now'))
  `).bind(project_id, `Forrásinjekció: ${body.source}`, body.amount, body.amount, body.reason || 'Kincstári forrásbővítés').run();

  return jsonResponse({ ok: true }, 200, request);
}

async function handleGetUsers(request, user, env) {
  if (user.role !== 'pm' && user.role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403, request);
  const users = await env.DB.prepare('SELECT discord_id, username, global_name, role, polgarsag FROM users LIMIT 100').all();
  return jsonResponse({ users: users.results || [] }, 200, request);
}

async function handleGetMyCompanies(request, user, env) {
  const cegek = await env.DB.prepare('SELECT * FROM cegek WHERE discord_id = ? AND status = "approved"').bind(user.sub).all();
  return jsonResponse({ companies: cegek.results || [] }, 200, request);
}

// ─── EU Pályázatok (Támogatások) ───────────────────────────
async function handleEuApply(request, user, env) {
  const body = await request.json();
  const ugy_szam = 'TAM-' + Date.now().toString(36).toUpperCase();

  // Ellenőrizzük, hogy a kiválasztott cég az övé-e és jóvá van-e hagyva
  const ceg = await env.DB.prepare('SELECT id, ceg_nev FROM cegek WHERE id = ? AND discord_id = ? AND status = "approved" LIMIT 1')
    .bind(body.ceg_id, user.sub)
    .first();
    
  if (!ceg) {
    return jsonResponse({ error: 'Érvénytelen vagy nem jóváhagyott vállalkozás.' }, 403, request);
  }

  await env.DB.prepare(`
    INSERT INTO eu_applications (ugy_szam, discord_id, ceg_id, project_name, amount, description, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(ugy_szam, user.sub, ceg.id, body.project_name, body.amount, body.description).run();

  await env.DB.prepare(`INSERT INTO ugyiratok (discord_id, tipus, hivatkozas, created_at) VALUES (?, 'tamogatas', ?, datetime('now'))`).bind(user.sub, ugy_szam).run();

  await insertUzenet(env, user.sub, 'Craftlandia Kormány',
    `Támogatási pályázat befogadva – ${ugy_szam}`,
    `Tisztelt ${ceg.ceg_nev}!\n\nA(z) "${body.project_name}" elnevezésű EU-s támogatási pályázatát (${ugy_szam}) rendszerünk rögzítette. Az elbírálás folyamatban.\n\nKormányzati Pályázati Iroda`,
    'ertesites'
  );

  return jsonResponse({ ugy_szam }, 200, request);
}

async function handleGetMyEuApplications(request, user, env) {
  const apps = await env.DB.prepare(`
    SELECT a.*, c.ceg_nev 
    FROM eu_applications a
    JOIN cegek c ON a.ceg_id = c.id
    WHERE a.discord_id = ?
    ORDER BY a.created_at DESC
  `).bind(user.sub).all();
  return jsonResponse({ applications: apps.results || [] }, 200, request);
}

// ─── Response helpers ──────────────────────────────────────
function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null;
  const requestHeaders = request ? request.headers.get('Access-Control-Request-Headers') : null;
  
  // Define allowed patterns
  const isAllowed = !origin || 
                    origin.includes('localhost') || 
                    origin.includes('127.0.0.1') || 
                    origin.includes('pages.dev') ||
                    origin.includes('craftlandia.gov');

  // For CORS with credentials, we MUST return the specific origin, not '*'
  const allowedOrigin = isAllowed && origin ? origin : FRONTEND_ORIGIN;

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': requestHeaders || 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getCorsHeaders(request),
  });
}

function corsResponse(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}