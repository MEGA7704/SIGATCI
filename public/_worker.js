const SESSION_COOKIE = 'sigat_session';
const SESSION_TTL = 60 * 60 * 8; // 8 heures
const LOGIN_WINDOW = 60 * 15;
const LOGIN_MAX_ATTEMPTS = 5;
const PBKDF2_ITERATIONS = 100000;
const SERVICE_TYPES = Object.freeze(['PEF','CANTONNEMENT','DIRECTION_DEPARTEMENTALE','DIRECTION_REGIONALE']);
const PARENT_TYPE = Object.freeze({
  PEF:'CANTONNEMENT',
  CANTONNEMENT:'DIRECTION_DEPARTEMENTALE',
  DIRECTION_DEPARTEMENTALE:'DIRECTION_REGIONALE',
  DIRECTION_REGIONALE:null
});
// Compatibilité avec les anciennes bases dont organization_type est limité aux 3 anciens types.
function legacyStoredType(type){return type==='DIRECTION_DEPARTEMENTALE'?'DIRECTION_REGIONALE':type;}
function canonicalType(row){return row?.service_type||row?.organization_type||null;}

const SERVICE_CODE_PREFIX = Object.freeze({
  PEF:'PEF',
  CANTONNEMENT:'CEF',
  DIRECTION_DEPARTEMENTALE:'DDEF',
  DIRECTION_REGIONALE:'DREF'
});

function randomServiceCodeCandidate(type){
  const prefix=SERVICE_CODE_PREFIX[type]||'SIGAT';
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  return `${prefix}-${suffix}`;
}

async function generateUniqueServiceCode(env,type){
  for(let i=0;i<20;i++){
    const candidate=randomServiceCodeCandidate(type);
    const existing=await env.SIGAT_DB.prepare('SELECT id FROM organizations WHERE code=? LIMIT 1').bind(candidate).first();
    if(!existing)return candidate;
  }
  const e=new Error('Impossible de générer un code unique pour cette structure. Veuillez réessayer.');
  e.code='SERVICE_CODE_GENERATION_FAILED';
  throw e;
}

let schemaReady = false;

async function tableExists(env, table) {
  const row = await env.SIGAT_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(table).first();
  return !!row;
}

async function columnsOf(env, table) {
  const r = await env.SIGAT_DB.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((r.results || []).map(c => c.name));
}

async function runDdl(env, sql) {
  // D1 est plus fiable ici avec prepare().run() qu'avec exec() pour une seule instruction DDL.
  // Cela évite les erreurs de découpage/incomplete input déjà observées sur certains déploiements.
  const statement = String(sql || '').trim().replace(/;\s*$/, '');
  if (!statement) return;
  await env.SIGAT_DB.prepare(statement).run();
}

async function addColumnIfMissing(env, table, cols, name, definition) {
  if (!cols.has(name)) {
    await runDdl(env, `ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    cols.add(name);
  }
}

async function ensureRuntime(env) {
  if (!env.SIGAT_DB) {
    const e = new Error('Binding D1 SIGAT_DB absent.');
    e.code = 'D1_BINDING_MISSING';
    throw e;
  }
  if (!env.SIGAT_KV) {
    const e = new Error('Binding KV SIGAT_KV absent.');
    e.code = 'KV_BINDING_MISSING';
    throw e;
  }
  if (schemaReady) return;

  // Initialisation légère : uniquement les tables indispensables à l'authentification,
  // à la hiérarchie, aux abonnements et à la sécurité. Les tables métier sont créées
  // à la demande afin d'éviter un gros bootstrap D1 à chaque nouvel isolate Cloudflare.
  const ddl = [
    `CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      organization_type TEXT NOT NULL DEFAULT 'PEF',
      service_type TEXT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      region TEXT,
      department TEXT,
      locality TEXT,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS roles (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL DEFAULT '',
      phone TEXT,
      role_code TEXT NOT NULL DEFAULT 'MEMBER',
      password_hash TEXT,
      password_salt TEXT,
      password_iterations INTEGER NOT NULL DEFAULT 100000,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      force_password_change INTEGER NOT NULL DEFAULT 0,
      session_version INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'FREE',
      price INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL DEFAULT CURRENT_DATE,
      end_date TEXT NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'TRIAL',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS subscription_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      old_plan TEXT,
      new_plan TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      mode_activation TEXT,
      activated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username_or_email TEXT NOT NULL,
      request_type TEXT NOT NULL DEFAULT 'USER',
      status TEXT NOT NULL DEFAULT 'PENDING',
      handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      handled_at TEXT,
      notes TEXT,
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      description TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, setting_key)
    )`
  ];
  for (const sql of ddl) await runDdl(env, sql);

  await env.SIGAT_DB.prepare("INSERT OR IGNORE INTO roles(code,label) VALUES('SUPER_ADMIN','Super Admin')").run();
  await env.SIGAT_DB.prepare("INSERT OR IGNORE INTO roles(code,label) VALUES('ORGANIZATION_ADMIN','Administrateur de structure')").run();
  await env.SIGAT_DB.prepare("INSERT OR IGNORE INTO roles(code,label) VALUES('MEMBER','Membre')").run();
  await env.SIGAT_DB.prepare("INSERT OR IGNORE INTO roles(code,label) VALUES('READ_ONLY','Consultation')").run();

  // Réparation douce des bases des versions précédentes.
  const orgCols = await columnsOf(env, 'organizations');
  await addColumnIfMissing(env, 'organizations', orgCols, 'parent_id', 'INTEGER');
  await addColumnIfMissing(env, 'organizations', orgCols, 'organization_type', "TEXT DEFAULT 'PEF'");
  await addColumnIfMissing(env, 'organizations', orgCols, 'service_type', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'code', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'name', "TEXT DEFAULT ''");
  await addColumnIfMissing(env, 'organizations', orgCols, 'region', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'department', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'locality', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'phone', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'email', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'status', "TEXT DEFAULT 'PENDING'");
  await addColumnIfMissing(env, 'organizations', orgCols, 'created_at', 'TEXT');
  await addColumnIfMissing(env, 'organizations', orgCols, 'updated_at', 'TEXT');
  await env.SIGAT_DB.prepare("UPDATE organizations SET service_type=organization_type WHERE service_type IS NULL OR trim(service_type)='' ").run();

  // V1.39 : sécurité hiérarchique. On détache les anciens rattachements devenus incompatibles
  // avec l’ordre PEF → Cantonnement → Direction Départementale → Direction Régionale.
  // Aucune donnée métier n’est supprimée ; seul le lien parent invalide est remis à NULL.
  await env.SIGAT_DB.prepare(`
    UPDATE organizations
    SET parent_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE parent_id IS NOT NULL
      AND (
        COALESCE(service_type,organization_type)='DIRECTION_REGIONALE'
        OR (
          SELECT COALESCE(p.service_type,p.organization_type)
          FROM organizations p
          WHERE p.id=organizations.parent_id
        ) <> CASE COALESCE(service_type,organization_type)
          WHEN 'PEF' THEN 'CANTONNEMENT'
          WHEN 'CANTONNEMENT' THEN 'DIRECTION_DEPARTEMENTALE'
          WHEN 'DIRECTION_DEPARTEMENTALE' THEN 'DIRECTION_REGIONALE'
          ELSE ''
        END
      )
  `).run();

  const userCols = await columnsOf(env, 'users');
  await addColumnIfMissing(env, 'users', userCols, 'organization_id', 'INTEGER');
  await addColumnIfMissing(env, 'users', userCols, 'username', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'email', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'display_name', "TEXT DEFAULT ''");
  await addColumnIfMissing(env, 'users', userCols, 'phone', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'role_code', "TEXT DEFAULT 'MEMBER'");
  await addColumnIfMissing(env, 'users', userCols, 'password_hash', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'password_salt', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'password_iterations', 'INTEGER DEFAULT 100000');
  await addColumnIfMissing(env, 'users', userCols, 'status', "TEXT DEFAULT 'ACTIVE'");
  await addColumnIfMissing(env, 'users', userCols, 'force_password_change', 'INTEGER DEFAULT 0');
  await addColumnIfMissing(env, 'users', userCols, 'session_version', 'INTEGER DEFAULT 1');
  await addColumnIfMissing(env, 'users', userCols, 'last_login_at', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'created_at', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'updated_at', 'TEXT');
  await addColumnIfMissing(env, 'users', userCols, 'deleted_at', 'TEXT');

  // Index légers uniquement. Les erreurs d'index sur une ancienne base ne doivent pas bloquer la connexion.
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)'
  ]) {
    try { await runDdl(env, sql); } catch (e) { console.warn('index init', e?.message || e); }
  }
  schemaReady = true;
}

async function ensureModuleTable(env, table) {
  // table provient exclusivement de MODULES (liste blanche).
  if (await tableExists(env, table)) return;
  await runDdl(env, `CREATE TABLE IF NOT EXISTS ${table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reference TEXT,
    title TEXT NOT NULL,
    event_date TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    data_json TEXT NOT NULL DEFAULT '{}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`);
  try { await runDdl(env, `CREATE INDEX IF NOT EXISTS idx_${table}_org ON ${table}(organization_id)`); } catch {}
  try { await runDdl(env, `CREATE INDEX IF NOT EXISTS idx_${table}_date ON ${table}(event_date)`); } catch {}
}

async function apiHealth(env) {
  // Diagnostic + auto-réparation légère. Cette route initialise uniquement le noyau
  // nécessaire à l'authentification puis tente de créer le Super Admin à partir
  // des secrets Cloudflare. Elle ne charge aucune donnée métier.
  const result = {
    worker: true,
    version: '1.51-activites-minef',
    dbBinding: !!env.SIGAT_DB,
    kvBinding: !!env.SIGAT_KV,
    superAdminUsernameConfigured: !!env.SIGAT_SUPERADMIN_USERNAME,
    superAdminPasswordConfigured: !!env.SIGAT_SUPERADMIN_PASSWORD,
    superAdminEmailConfigured: !!env.SIGAT_SUPERADMIN_EMAIL,
    dbReachable: false,
    kvReachable: false,
    bootstrapAttempted: false,
    runtimeReady: false,
    coreSchemaPresent: false,
    superAdminExists: false,
    bootstrapStage: 'not-started'
  };

  if (env.SIGAT_KV) {
    try {
      await env.SIGAT_KV.get('__sigat_health__');
      result.kvReachable = true;
    } catch (e) {
      result.kvError = String(e?.message || e).slice(0,500);
    }
  }

  if (env.SIGAT_DB) {
    try {
      const r = await env.SIGAT_DB.prepare('SELECT 1 AS ok').first();
      result.dbReachable = !!r;
    } catch (e) {
      result.dbError = String(e?.message || e).slice(0,500);
    }
  }

  // Ne tenter le bootstrap que si D1 et KV répondent.
  if (result.dbReachable && result.kvReachable) {
    result.bootstrapAttempted = true;
    try {
      result.bootstrapStage = 'ensure-runtime';
      await ensureRuntime(env);
      result.runtimeReady = true;

      result.bootstrapStage = 'ensure-superadmin';
      await ensureSuperAdmin(env);
      result.bootstrapStage = 'completed';
    } catch (e) {
      result.runtimeReady = schemaReady;
      result.bootstrapErrorCode = e?.code || 'BOOTSTRAP_FAILED';
      result.bootstrapError = String(e?.message || e).slice(0,800);
    }
  }

  if (env.SIGAT_DB && result.dbReachable) {
    try {
      const usersTable = await env.SIGAT_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1").first();
      const orgTable = await env.SIGAT_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations' LIMIT 1").first();
      result.coreSchemaPresent = !!usersTable && !!orgTable;
      if (usersTable) {
        try {
          const su = await env.SIGAT_DB.prepare("SELECT id FROM users WHERE role_code='SUPER_ADMIN' AND (deleted_at IS NULL OR deleted_at='') LIMIT 1").first();
          result.superAdminExists = !!su;
        } catch (e) {
          result.superAdminCheckError = String(e?.message || e).slice(0,500);
        }
      }
    } catch (e) {
      result.schemaCheckError = String(e?.message || e).slice(0,500);
    }
  }

  return ok(result);
}

const MODULES = Object.freeze({
  personnel: 'agents',
  documents: 'administrative_documents',
  absences: 'absences',
  stages: 'internships',
  convocations: 'convocations',
  convocation_pv: 'convocation_minutes',
  offense_pv: 'offense_minutes',
  missions: 'missions',
  controles: 'controls',
  infractions: 'offenses',
  saisies: 'seizures',
  'exploitation-forestiere': 'forest_perimeters',
  'produits-secondaires': 'secondary_operators',
  'transformation-bois': 'wood_processing_units',
  sensibilisations: 'awareness_actions',
  'activites-minef': 'minef_activities',
  reboisement: 'plantations',
  'ressources-naturelles': 'natural_resources',
  'feux-brousse': 'fire_incidents',
  faune: 'wildlife_observations',
  conflits: 'human_wildlife_conflicts',
  formations: 'training_sessions',
  materiel: 'equipment',
  finances: 'budgets',
  rapports: 'reports',
  archives: 'archives'
});

const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders
  }
});

const ok = (data = {}) => json({ ok: true, ...data });
const bad = (message, status = 400, code = 'BAD_REQUEST') => json({ ok: false, code, message }, status);

function securityHeaders(response) {
  const h = new Headers(response.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}


function constantTimeStringEqual(a, b) {
  const aa = new TextEncoder().encode(String(a ?? ''));
  const bb = new TextEncoder().encode(String(b ?? ''));
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

function getIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function bytesToBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToBase64(arr).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function randomPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

async function hashPassword(password, saltB64 = null, iterations = PBKDF2_ITERATIONS) {
  const salt = saltB64 ? base64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt),
    iterations
  };
}

async function verifyPassword(password, user) {
  if (!user?.password_hash || !user?.password_salt) return false;
  try {
    const derived = await hashPassword(password, user.password_salt, Number(user.password_iterations || PBKDF2_ITERATIONS));
    const a = base64ToBytes(derived.hash);
    const b = base64ToBytes(user.password_hash);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  } catch {
    return false;
  }
}

async function audit(env, request, data) {
  try {
    await env.SIGAT_DB.prepare(`
      INSERT INTO audit_logs(organization_id,user_id,actor_user_id,action,target_type,target_id,description,ip_address,user_agent)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).bind(
      data.organization_id ?? null,
      data.user_id ?? null,
      data.actor_user_id ?? null,
      data.action,
      data.target_type ?? null,
      data.target_id != null ? String(data.target_id) : null,
      data.description ?? null,
      getIp(request),
      request.headers.get('User-Agent') || null
    ).run();
  } catch (e) {
    console.error('audit error', e);
  }
}

async function ensureSuperAdmin(env) {
  // S'assurer que le rôle existe même sur une base partiellement initialisée.
  await env.SIGAT_DB.prepare("INSERT OR IGNORE INTO roles(code,label) VALUES('SUPER_ADMIN','Super Admin')").run();
  const existing = await env.SIGAT_DB.prepare("SELECT id FROM users WHERE role_code='SUPER_ADMIN' AND deleted_at IS NULL LIMIT 1").first();
  if (existing) return existing.id;

  const username = String(env.SIGAT_SUPERADMIN_USERNAME || '').trim();
  const password = String(env.SIGAT_SUPERADMIN_PASSWORD || '');
  const email = env.SIGAT_SUPERADMIN_EMAIL ? String(env.SIGAT_SUPERADMIN_EMAIL).trim().toLowerCase() : null;
  if (!username || !password) {
    const e = new Error('Variables SIGAT_SUPERADMIN_USERNAME / SIGAT_SUPERADMIN_PASSWORD non configurées.');
    e.code = 'SUPERADMIN_SECRET_MISSING';
    throw e;
  }

  // Éviter qu'un compte métier portant déjà le même identifiant provoque une
  // erreur UNIQUE opaque au moment du bootstrap.
  const conflict = await env.SIGAT_DB.prepare("SELECT id,role_code FROM users WHERE lower(username)=lower(?) AND deleted_at IS NULL LIMIT 1").bind(username).first();
  if (conflict) {
    const e = new Error('L’identifiant Super Admin configuré est déjà utilisé par un autre compte.');
    e.code = 'SUPERADMIN_USERNAME_CONFLICT';
    throw e;
  }

  const hp = await hashPassword(password);
  const r = await env.SIGAT_DB.prepare(`
    INSERT INTO users(organization_id,username,email,display_name,role_code,password_hash,password_salt,password_iterations,status,force_password_change,session_version)
    VALUES(NULL,?,?,?,?,?,?,?,?,0,1)
  `).bind(username, email, 'Super Admin SIGAT', 'SUPER_ADMIN', hp.hash, hp.salt, hp.iterations, 'ACTIVE').run();
  return r?.meta?.last_row_id || null;
}
async function rateLimitState(env, key) {
  const raw = await env.SIGAT_KV.get(key);
  return raw ? Number(raw) || 0 : 0;
}

async function incrementRateLimit(env, key) {
  const current = await rateLimitState(env, key);
  await env.SIGAT_KV.put(key, String(current + 1), { expirationTtl: LOGIN_WINDOW });
}

async function clearRateLimit(env, key) {
  await env.SIGAT_KV.delete(key);
}

async function createSession(env, user) {
  const token = randomToken(36);
  const csrf = randomToken(24);
  const session = {
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role_code,
    sessionVersion: user.session_version,
    csrf,
    createdAt: Date.now()
  };
  await env.SIGAT_KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return { token, csrf };
}

async function destroySession(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await env.SIGAT_KV.delete(`session:${token}`);
}

function sessionCookie(token, maxAge = SESSION_TTL) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function expiredCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function currentSubscription(env, organizationId) {
  if (!organizationId) return null;
  const sub = await env.SIGAT_DB.prepare('SELECT * FROM subscriptions WHERE organization_id=? LIMIT 1').bind(organizationId).first();
  if (!sub) return null;
  const today = new Date();
  const end = new Date(`${sub.end_date}T23:59:59Z`);
  const expired = today > end || sub.status === 'EXPIRED' || sub.status === 'SUSPENDED';
  const daysRemaining = Math.max(0, Math.ceil((end - today) / 86400000));
  return { ...sub, expired, daysRemaining };
}

async function getSession(env, request, { allowExpired = true } = {}) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const raw = await env.SIGAT_KV.get(`session:${token}`);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  const user = await env.SIGAT_DB.prepare(`
    SELECT u.id,u.organization_id,u.username,u.email,u.display_name,u.phone,u.role_code,u.status,u.force_password_change,u.session_version,
           o.name AS organization_name,o.code AS organization_code,COALESCE(o.service_type,o.organization_type) AS organization_type,o.status AS organization_status,o.parent_id
    FROM users u LEFT JOIN organizations o ON o.id=u.organization_id
    WHERE u.id=? AND u.deleted_at IS NULL
  `).bind(s.userId).first();
  if (!user || user.status !== 'ACTIVE' || Number(user.session_version) !== Number(s.sessionVersion)) return null;
  if (user.role_code !== 'SUPER_ADMIN' && user.organization_status !== 'ACTIVE') return null;
  const subscription = user.role_code === 'SUPER_ADMIN' ? null : await currentSubscription(env, user.organization_id);
  if (!allowExpired && subscription?.expired) return { denied: 'SUBSCRIPTION_EXPIRED', token, session: s, user, subscription };
  return { token, session: s, user, subscription };
}

function requireCsrf(request, auth) {
  const provided = request.headers.get('X-CSRF-Token') || '';
  return provided && auth?.session?.csrf && provided === auth.session.csrf;
}

async function accessibleOrganizationIds(env, user, rootOrganizationId = null) {
  if (user.role_code === 'SUPER_ADMIN') return [];
  const ownId = Number(user.organization_id);
  const requestedRoot = rootOrganizationId == null ? ownId : Number(rootOrganizationId);
  // Vérifier d'abord que la racine demandée appartient bien au sous-arbre autorisé de l'utilisateur.
  const allowedRows = await env.SIGAT_DB.prepare(`
    WITH RECURSIVE tree(id) AS (
      SELECT id FROM organizations WHERE id=?
      UNION ALL
      SELECT o.id FROM organizations o JOIN tree t ON o.parent_id=t.id WHERE o.status<>'CLOSED'
    ) SELECT id FROM tree
  `).bind(ownId).all();
  const allowed = new Set((allowedRows.results||[]).map(r=>Number(r.id)));
  if (!allowed.has(requestedRoot)) return [];
  const rows = await env.SIGAT_DB.prepare(`
    WITH RECURSIVE tree(id) AS (
      SELECT id FROM organizations WHERE id=?
      UNION ALL
      SELECT o.id FROM organizations o JOIN tree t ON o.parent_id=t.id WHERE o.status<>'CLOSED'
    ) SELECT id FROM tree
  `).bind(requestedRoot).all();
  return (rows.results||[]).map(r=>Number(r.id));
}

function makeInClause(ids) {
  return { sql: ids.map(() => '?').join(','), binds: ids };
}

async function parseJson(request) {
  try { return await request.json(); } catch { return null; }
}

function validPassword(p) {
  return typeof p === 'string' && p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
}

async function apiLogin(env, request) {
  await ensureSuperAdmin(env);
  const body = await parseJson(request);
  if (!body) return bad('Requête invalide.');
  const identifier = normalizeIdentifier(body.identifier);
  const password = String(body.password || '');
  if (!identifier || !password) return bad('Identifiant et mot de passe requis.');

  const ipKey = `login:ip:${getIp(request)}`;
  const userKey = `login:user:${identifier}`;
  if ((await rateLimitState(env, ipKey)) >= LOGIN_MAX_ATTEMPTS || (await rateLimitState(env, userKey)) >= LOGIN_MAX_ATTEMPTS) {
    return bad('Trop de tentatives. Veuillez réessayer plus tard.', 429, 'RATE_LIMITED');
  }

  const user = await env.SIGAT_DB.prepare(`
    SELECT u.*,o.status AS organization_status,o.name AS organization_name,COALESCE(o.service_type,o.organization_type) AS organization_type
    FROM users u LEFT JOIN organizations o ON o.id=u.organization_id
    WHERE (lower(u.username)=? OR lower(u.email)=?) AND u.deleted_at IS NULL LIMIT 1
  `).bind(identifier, identifier).first();

  let valid = false;
  if (user) valid = await verifyPassword(password, user);

  // Récupération sûre du Super Admin : le secret Cloudflare reste la source de
  // secours. Cela permet de réparer automatiquement un hash ancien/incomplet ou
  // un compte créé par une version précédente, sans publier le secret.
  const secretUser = normalizeIdentifier(env.SIGAT_SUPERADMIN_USERNAME);
  const secretEmail = normalizeIdentifier(env.SIGAT_SUPERADMIN_EMAIL);
  const secretPassword = String(env.SIGAT_SUPERADMIN_PASSWORD || '');
  const isConfiguredSuperIdentity = !!user && user.role_code === 'SUPER_ADMIN' &&
    (identifier === secretUser || (!!secretEmail && identifier === secretEmail));
  if (!valid && isConfiguredSuperIdentity && secretPassword && constantTimeStringEqual(password, secretPassword)) {
    const hp = await hashPassword(secretPassword);
    await env.SIGAT_DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,status='ACTIVE',session_version=COALESCE(session_version,1)+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(hp.hash,hp.salt,hp.iterations,user.id).run();
    user.password_hash = hp.hash;
    user.password_salt = hp.salt;
    user.password_iterations = hp.iterations;
    user.status = 'ACTIVE';
    user.session_version = Number(user.session_version || 1) + 1;
    valid = true;
  }

  if (!user || !valid) {
    await incrementRateLimit(env, ipKey);
    await incrementRateLimit(env, userKey);
    await audit(env, request, { action: 'LOGIN_FAILED', user_id: user?.id, organization_id: user?.organization_id, description: 'Échec de connexion' });
    return bad('Identifiant ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') return bad('Ce compte n’est pas actif.', 403, 'ACCOUNT_DISABLED');

  // Compatibilité avec les inscriptions réalisées par les anciennes versions :
  // si l'Administrateur d'une structure encore PENDING se connecte avec le bon mot de passe,
  // SIGAT active automatiquement la structure et démarre son plan FREE.
  if (user.role_code === 'ORGANIZATION_ADMIN' && user.organization_status === 'PENDING' && user.organization_id) {
    await env.SIGAT_DB.prepare("UPDATE organizations SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'").bind(user.organization_id).run();
    await createFreeSubscription(env, user.organization_id, user.id);
    user.organization_status = 'ACTIVE';
    await audit(env, request, { action: 'ORGANIZATION_AUTO_ACTIVATED_ON_LOGIN', user_id: user.id, actor_user_id: user.id, organization_id: user.organization_id, target_type: 'organization', target_id: user.organization_id, description: 'Ancienne inscription PENDING activée automatiquement lors de la connexion de son Administrateur' });
  }

  if (user.role_code !== 'SUPER_ADMIN' && user.organization_status !== 'ACTIVE') return bad('Votre structure n’est pas active.', 403, 'ORG_INACTIVE');

  await clearRateLimit(env, ipKey);
  await clearRateLimit(env, userKey);
  const sess = await createSession(env, user);
  await env.SIGAT_DB.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').bind(user.id).run();
  await audit(env, request, { action: 'LOGIN_SUCCESS', user_id: user.id, actor_user_id: user.id, organization_id: user.organization_id, description: 'Connexion réussie' });
  const subscription = user.role_code === 'SUPER_ADMIN' ? null : await currentSubscription(env, user.organization_id);
  return json({
    ok: true,
    csrf: sess.csrf,
    role: user.role_code,
    forcePasswordChange: !!user.force_password_change,
    subscription,
    redirect: user.role_code === 'SUPER_ADMIN' ? '/superadmin/dashboard/' : '/dashboard/'
  }, 200, { 'Set-Cookie': sessionCookie(sess.token) });
}
async function apiLogout(env, request) {
  const auth = await getSession(env, request);
  await destroySession(env, request);
  if (auth?.user) await audit(env, request, { action: 'LOGOUT', user_id: auth.user.id, actor_user_id: auth.user.id, organization_id: auth.user.organization_id });
  return json({ ok: true }, 200, { 'Set-Cookie': expiredCookie() });
}

async function apiSession(env, request) {
  const auth = await getSession(env, request, { allowExpired: true });
  if (!auth || auth.denied) return bad('Session invalide.', 401, 'UNAUTHENTICATED');
  const u = auth.user;
  return ok({
    csrf: auth.session.csrf,
    user: {
      id: u.id, username: u.username, email: u.email, displayName: u.display_name,
      role: u.role_code, organizationId: u.organization_id, organizationName: u.organization_name,
      organizationCode: u.organization_code, organizationType: u.organization_type,
      forcePasswordChange: !!u.force_password_change
    },
    subscription: auth.subscription
  });
}

async function apiRegister(env, request) {
  const body = await parseJson(request);
  if (!body) return bad('Requête invalide.');
  const type = String(body.organizationType || '').toUpperCase();
  if (!SERVICE_TYPES.includes(type)) return bad('Type de structure invalide.');
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim();
  const email = normalizeIdentifier(body.email);
  const displayName = String(body.displayName || '').trim();
  const password = String(body.password || '');
  if (!name || !username || !displayName || !password) return bad('Veuillez remplir les champs obligatoires.');
  if (!validPassword(password)) return bad('Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule et un chiffre.');

  // Le rattachement hiérarchique n'est plus demandé pendant l'inscription.
  // Chaque administrateur choisit volontairement son service supérieur après activation,
  // depuis Paramètres > Rattachement hiérarchique.
  const parentId = null;

  // Le code du service est généré exclusivement côté serveur afin qu’il soit automatique, aléatoire et unique.
  const code = await generateUniqueServiceCode(env, type);
  const userDup = await env.SIGAT_DB.prepare('SELECT id FROM users WHERE lower(username)=? OR lower(email)=?').bind(username.toLowerCase(), email).first();
  if (userDup) return bad('Cet identifiant ou cet e-mail est déjà utilisé.');

  const hp = await hashPassword(password);
  // Nouvelle politique SIGAT : toute structure inscrite est immédiatement ACTIVE.
  // Le rattachement hiérarchique est volontaire et se fait ensuite par son Administrateur.
  const orgRes = await env.SIGAT_DB.prepare(`
    INSERT INTO organizations(parent_id,organization_type,service_type,code,name,region,department,locality,phone,email,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,'ACTIVE')
  `).bind(parentId, legacyStoredType(type), type, code, name, body.region || null, body.department || null, body.locality || null, body.phone || null, body.organizationEmail || null).run();
  const organizationId = orgRes.meta.last_row_id;
  const userRes = await env.SIGAT_DB.prepare(`
    INSERT INTO users(organization_id,username,email,display_name,phone,role_code,password_hash,password_salt,password_iterations,status,force_password_change,session_version)
    VALUES(?,?,?,?,?,'ORGANIZATION_ADMIN',?,?,?,'ACTIVE',0,1)
  `).bind(organizationId, username, email || null, displayName, body.userPhone || null, hp.hash, hp.salt, hp.iterations).run();
  const userId = userRes.meta.last_row_id;

  // Démarrer automatiquement le plan FREE de 20 jours dès l'inscription.
  await createFreeSubscription(env, organizationId, userId);

  // Ouvrir immédiatement une session sécurisée pour le nouvel Administrateur.
  const newUser = {
    id: userId,
    organization_id: organizationId,
    role_code: 'ORGANIZATION_ADMIN',
    session_version: 1
  };
  const sess = await createSession(env, newUser);
  await env.SIGAT_DB.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').bind(userId).run();
  await audit(env, request, { action: 'ORGANIZATION_REGISTERED', organization_id: organizationId, user_id: userId, actor_user_id: userId, target_type: 'organization', target_id: organizationId, description: `${type} ${name} — activation automatique` });
  await audit(env, request, { action: 'LOGIN_SUCCESS_AFTER_REGISTER', organization_id: organizationId, user_id: userId, actor_user_id: userId, description: 'Session ouverte automatiquement après inscription' });

  const subscription = await currentSubscription(env, organizationId);
  return json({
    ok: true,
    message: 'Inscription réussie. Votre espace SIGAT est actif et votre session est ouverte.',
    csrf: sess.csrf,
    role: 'ORGANIZATION_ADMIN',
    forcePasswordChange: false,
    subscription,
    organizationCode: code,
    redirect: '/dashboard/'
  }, 200, { 'Set-Cookie': sessionCookie(sess.token) });
}

async function apiPasswordResetRequest(env, request) {
  const body = await parseJson(request);
  const ident = normalizeIdentifier(body?.identifier);
  const requestType = String(body?.requestType || '').toUpperCase();
  if (!ident || !['ADMINISTRATOR','USER'].includes(requestType)) return bad('Informations incomplètes.');
  const user = await env.SIGAT_DB.prepare(`SELECT id,organization_id,role_code FROM users WHERE (lower(username)=? OR lower(email)=?) AND deleted_at IS NULL LIMIT 1`).bind(ident, ident).first();
  if (user) {
    const typeOk = requestType === 'ADMINISTRATOR' ? user.role_code === 'ORGANIZATION_ADMIN' : ['MEMBER','READ_ONLY'].includes(user.role_code);
    if (typeOk) {
      await env.SIGAT_DB.prepare(`INSERT INTO password_reset_requests(organization_id,user_id,username_or_email,request_type) VALUES(?,?,?,?)`).bind(user.organization_id, user.id, ident, requestType).run();
      await audit(env, request, { action: 'PASSWORD_RESET_REQUESTED', organization_id: user.organization_id, user_id: user.id, target_type: 'user', target_id: user.id });
    }
  }
  return ok({ message: 'Votre demande a été prise en compte. Si les informations correspondent à un compte SIGAT, elle sera traitée par l’administrateur compétent.' });
}

async function apiChangePassword(env, request) {
  const auth = await getSession(env, request);
  if (!auth) return bad('Session invalide.', 401);
  if (!requireCsrf(request, auth)) return bad('Jeton CSRF invalide.', 403, 'CSRF');
  const body = await parseJson(request);
  const current = String(body?.currentPassword || '');
  const next = String(body?.newPassword || '');
  if (!validPassword(next)) return bad('Le nouveau mot de passe ne respecte pas les exigences de sécurité.');
  const full = await env.SIGAT_DB.prepare('SELECT * FROM users WHERE id=?').bind(auth.user.id).first();
  if (!await verifyPassword(current, full)) return bad('Ancien mot de passe incorrect.', 403);
  const hp = await hashPassword(next);
  await env.SIGAT_DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,force_password_change=0,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(hp.hash, hp.salt, hp.iterations, auth.user.id).run();
  await destroySession(env, request);
  await audit(env, request, { action: 'PASSWORD_CHANGED', organization_id: auth.user.organization_id, user_id: auth.user.id, actor_user_id: auth.user.id, target_type: 'user', target_id: auth.user.id });
  return json({ ok: true, message: 'Mot de passe modifié. Veuillez vous reconnecter.' }, 200, { 'Set-Cookie': expiredCookie() });
}

async function apiDashboard(env, request) {
  const auth = await getSession(env, request, { allowExpired: false });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.denied) return bad('Abonnement expiré.', 402, auth.denied);
  if (auth.user.role_code === 'SUPER_ADMIN') return bad('Utilisez le tableau de bord Super Admin.', 403);
  const url = new URL(request.url);
  const scopeOrg = url.searchParams.get('scopeOrg') ? Number(url.searchParams.get('scopeOrg')) : Number(auth.user.organization_id);
  const ids = await accessibleOrganizationIds(env, auth.user, scopeOrg);
  if (!ids.length) return bad('Structure hors de votre périmètre hiérarchique.', 403, 'OUT_OF_SCOPE');
  const { sql, binds } = makeInClause(ids);
  const summary = {};
  const wanted = ['agents','missions','controls','offenses','seizures','awareness_actions','plantations','fire_incidents','training_sessions'];
  for (const table of wanted) {
    if (!await tableExists(env, table)) { summary[table] = 0; continue; }
    const r = await env.SIGAT_DB.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE organization_id IN (${sql}) AND archived_at IS NULL`).bind(...binds).first();
    summary[table] = Number(r?.c || 0);
  }
  const scope = await env.SIGAT_DB.prepare(`SELECT id,name,code,COALESCE(service_type,organization_type) AS organization_type,parent_id FROM organizations WHERE id=?`).bind(scopeOrg).first();
  const children = await env.SIGAT_DB.prepare("SELECT COUNT(*) AS c FROM organizations WHERE parent_id=? AND status<>'CLOSED'").bind(scopeOrg).first();
  const breakdownRows = await env.SIGAT_DB.prepare(`SELECT COALESCE(service_type,organization_type) AS type,COUNT(*) AS c FROM organizations WHERE id IN (${sql}) AND id<>? GROUP BY COALESCE(service_type,organization_type)`).bind(...binds,scopeOrg).all();
  const breakdown = Object.fromEntries((breakdownRows.results||[]).map(r=>[r.type,Number(r.c||0)]));
  return ok({ summary, childOrganizations: Number(children?.c || 0), hierarchyBreakdown: breakdown, organization: { id:scope.id,name:scope.name,code:scope.code,type:scope.organization_type }, viewingOwn:Number(scopeOrg)===Number(auth.user.organization_id) });
}


async function apiHierarchy(env, request) {
  const auth = await getSession(env, request, { allowExpired: false });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.denied) return bad('Abonnement expiré.', 402, auth.denied);
  if (auth.user.role_code === 'SUPER_ADMIN') return bad('Route réservée aux structures métier.', 403);
  const url = new URL(request.url);
  const scopeOrg = url.searchParams.get('scopeOrg') ? Number(url.searchParams.get('scopeOrg')) : Number(auth.user.organization_id);
  const allowed = await accessibleOrganizationIds(env, auth.user, scopeOrg);
  if (!allowed.length) return bad('Structure hors de votre périmètre hiérarchique.',403,'OUT_OF_SCOPE');
  const root = await env.SIGAT_DB.prepare(`SELECT id,name,code,COALESCE(service_type,organization_type) AS organization_type FROM organizations WHERE id=?`).bind(scopeOrg).first();
  const rows = await env.SIGAT_DB.prepare(`
    SELECT o.id,o.code,o.name,COALESCE(o.service_type,o.organization_type) AS organization_type,o.status,o.parent_id,
           p.name AS parent_name,s.plan,s.end_date,s.status AS subscription_status,
           (SELECT COUNT(*) FROM organizations c WHERE c.parent_id=o.id AND c.status<>'CLOSED') AS direct_children
    FROM organizations o LEFT JOIN organizations p ON p.id=o.parent_id LEFT JOIN subscriptions s ON s.organization_id=o.id
    WHERE o.parent_id=? AND o.status<>'CLOSED' ORDER BY o.name
  `).bind(scopeOrg).all();
  return ok({ root, items: rows.results });
}


async function apiHierarchyAssignment(env, request) {
  const auth = await getSession(env, request, { allowExpired: true });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.user.role_code !== 'ORGANIZATION_ADMIN') return bad('Seul l’Administrateur de la structure peut gérer le rattachement hiérarchique.', 403, 'ADMIN_REQUIRED');
  const org = await env.SIGAT_DB.prepare(`
    SELECT o.id,o.code,o.name,COALESCE(o.service_type,o.organization_type) AS organization_type,o.parent_id,
           p.name AS parent_name,p.code AS parent_code,COALESCE(p.service_type,p.organization_type) AS parent_type
    FROM organizations o LEFT JOIN organizations p ON p.id=o.parent_id
    WHERE o.id=?
  `).bind(auth.user.organization_id).first();
  if (!org) return bad('Structure introuvable.', 404);
  const expected = PARENT_TYPE[org.organization_type] || null;
  let options = [];
  if (expected) {
    const rows = await env.SIGAT_DB.prepare(`
      SELECT id,code,name,COALESCE(service_type,organization_type) AS organization_type,region,department,locality,status
      FROM organizations
      WHERE id<>? AND COALESCE(service_type,organization_type)=? AND status='ACTIVE'
      ORDER BY name COLLATE NOCASE
    `).bind(org.id, expected).all();
    options = rows.results || [];
  }
  return ok({
    organization: {
      id: org.id, code: org.code, name: org.name, type: org.organization_type,
      parentId: org.parent_id || null, parentName: org.parent_name || null,
      parentCode: org.parent_code || null, parentType: org.parent_type || null
    },
    expectedParentType: expected,
    options
  });
}

async function apiHierarchyAssignmentSave(env, request) {
  const auth = await getSession(env, request, { allowExpired: true });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.user.role_code !== 'ORGANIZATION_ADMIN') return bad('Seul l’Administrateur de la structure peut gérer le rattachement hiérarchique.', 403, 'ADMIN_REQUIRED');
  if (!requireCsrf(request, auth)) return bad('Jeton CSRF invalide.', 403, 'CSRF');
  const body = await parseJson(request);
  const org = await env.SIGAT_DB.prepare(`SELECT id,name,COALESCE(service_type,organization_type) AS organization_type,parent_id FROM organizations WHERE id=?`).bind(auth.user.organization_id).first();
  if (!org) return bad('Structure introuvable.', 404);
  const expected = PARENT_TYPE[org.organization_type] || null;
  const requested = body?.parentId;
  const parentId = requested === null || requested === '' || requested === undefined ? null : Number(requested);

  if (!expected) {
    if (parentId !== null) return bad('Une Direction Régionale ne peut pas être rattachée à un service supérieur dans la hiérarchie SIGAT actuelle.');
  } else if (parentId !== null) {
    if (!Number.isInteger(parentId) || parentId <= 0 || parentId === Number(org.id)) return bad('Service supérieur invalide.');
    const parent = await env.SIGAT_DB.prepare(`
      SELECT id,name,COALESCE(service_type,organization_type) AS organization_type,status
      FROM organizations WHERE id=?
    `).bind(parentId).first();
    if (!parent || parent.status !== 'ACTIVE') return bad('Le service supérieur sélectionné est introuvable ou inactif.');
    if (parent.organization_type !== expected) return bad(`Rattachement incompatible : ce service doit être lié à un service de type ${expected}.`);
  }

  const previousParent = org.parent_id || null;
  await env.SIGAT_DB.prepare(`UPDATE organizations SET parent_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parentId, org.id).run();
  await audit(env, request, {
    action: parentId ? 'HIERARCHY_LINK_SET' : 'HIERARCHY_LINK_REMOVED',
    organization_id: org.id, user_id: auth.user.id, actor_user_id: auth.user.id,
    target_type: 'organization', target_id: org.id,
    description: `Rattachement modifié : ${previousParent ?? 'aucun'} -> ${parentId ?? 'aucun'}`
  });
  return ok({ message: parentId ? 'Rattachement hiérarchique enregistré.' : 'Rattachement hiérarchique supprimé.' });
}

async function apiLoad(env, request) {
  const auth = await getSession(env, request, { allowExpired: false });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.denied) return bad('Abonnement expiré.', 402, auth.denied);
  if (auth.user.role_code === 'SUPER_ADMIN') return bad('Utilisez les routes Super Admin.', 403);
  const url = new URL(request.url);
  const module = url.searchParams.get('module') || '';
  const table = MODULES[module];
  if (!table) return bad('Module non autorisé.');
  await ensureModuleTable(env, table);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit') || 25)));
  const search = String(url.searchParams.get('search') || '').trim();
  const forestType = module === 'exploitation-forestiere' ? String(url.searchParams.get('forestType') || '').trim().toUpperCase() : '';
  const woodType = module === 'transformation-bois' ? String(url.searchParams.get('woodType') || '').trim().toUpperCase() : '';
  const ownedOnly = url.searchParams.get('ownedOnly') === '1';
  const scopeOrg = url.searchParams.get('scopeOrg') ? Number(url.searchParams.get('scopeOrg')) : Number(auth.user.organization_id);
  const ids = ownedOnly ? [Number(auth.user.organization_id)] : await accessibleOrganizationIds(env, auth.user, scopeOrg);
  if (!ids.length) return bad('Structure hors de votre périmètre hiérarchique.',403,'OUT_OF_SCOPE');
  const { sql, binds } = makeInClause(ids);
  let where = `r.organization_id IN (${sql}) AND r.archived_at IS NULL`;
  const params = [...binds];
  if (search) {
    const q = `%${search}%`;
      if (module === 'sensibilisations') {
      where += ` AND (r.title LIKE ? OR r.reference LIKE ? OR r.status LIKE ? OR json_extract(COALESCE(r.data_json,'{}'), '$.type_sensibilisation') LIKE ? OR json_extract(COALESCE(r.data_json,'{}'), '$.theme') LIKE ? OR json_extract(COALESCE(r.data_json,'{}'), '$.lieu') LIKE ? OR json_extract(COALESCE(r.data_json,'{}'), '$.cible') LIKE ? OR json_extract(COALESCE(r.data_json,'{}'), '$.agent_charge') LIKE ?)`;
      params.push(q,q,q,q,q,q,q,q);
    } else if (['exploitation-forestiere','transformation-bois','feux-brousse','faune','missions','infractions','formations','offense_pv','activites-minef'].includes(module)) {
      where += ` AND (r.title LIKE ? OR r.reference LIKE ? OR r.status LIKE ? OR COALESCE(r.data_json,'{}') LIKE ?)`;
      params.push(q,q,q,q);
    } else {
      where += ' AND (r.title LIKE ? OR r.reference LIKE ? OR r.status LIKE ?)';
      params.push(q, q, q);
    }
  }
  if (module === 'activites-minef') {
    const year = String(url.searchParams.get('year') || '').trim();
    const activityDate = String(url.searchParams.get('activityDate') || '').trim();
    const activityType = String(url.searchParams.get('activityType') || '').trim();
    const activityCategory = String(url.searchParams.get('activityCategory') || '').trim();
    const organizer = String(url.searchParams.get('organizer') || '').trim();
    if (/^\d{4}$/.test(year)) {
      where += ` AND substr(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_activite'), r.event_date, ''),1,4) = ?`;
      params.push(year);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
      where += ` AND COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_activite'), r.event_date, '') = ?`;
      params.push(activityDate);
    }
    if (activityType) {
      where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.type_activite'),'')) = LOWER(?)`;
      params.push(activityType);
    }
    if (activityCategory) {
      where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.categorie_minef'),'')) = LOWER(?)`;
      params.push(activityCategory);
    }
    if (organizer) {
      where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.organisateur'),'')) LIKE LOWER(?)`;
      params.push(`%${organizer}%`);
    }
  }

  if (module === 'sensibilisations') {
    const year = String(url.searchParams.get('year') || '').trim();
    const activityDate = String(url.searchParams.get('activityDate') || '').trim();
    const awarenessType = String(url.searchParams.get('awarenessType') || '').trim();
    if (/^\d{4}$/.test(year)) {
      where += ` AND substr(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_activite'), r.event_date, ''),1,4) = ?`;
      params.push(year);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
      where += ` AND COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_activite'), r.event_date, '') = ?`;
      params.push(activityDate);
    }
    if (awarenessType) {
      where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.type_sensibilisation'), json_extract(COALESCE(r.data_json,'{}'), '$.theme'), r.title, '')) = LOWER(?)`;
      params.push(awarenessType);
    }
  }

  if (module === 'exploitation-forestiere') {
    if (forestType === 'RECHERCHE_PARCELLAIRE') {
      where += ` AND (json_extract(COALESCE(r.data_json,'{}'), '$._forest_type') = ? OR json_extract(COALESCE(r.data_json,'{}'), '$._forest_type') IS NULL)`;
      params.push('RECHERCHE_PARCELLAIRE');
    } else if (['PEPINIERE','PLANTATION_CREEE','REBOISEMENT'].includes(forestType)) {
      where += ` AND json_extract(COALESCE(r.data_json,'{}'), '$._forest_type') = ?`;
      params.push(forestType);
    }
    const year = String(url.searchParams.get('year') || '').trim();
    const activityDate = String(url.searchParams.get('activityDate') || '').trim();
    const sousPrefecture = String(url.searchParams.get('sousPrefecture') || '').trim();
    const localite = String(url.searchParams.get('localite') || '').trim();
    const essence = String(url.searchParams.get('essence') || '').trim();
    const reboisementType = String(url.searchParams.get('reboisementType') || '').trim();
    if (/^\d{4}$/.test(year)) {
      where += ` AND substr(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_activite'), r.event_date, ''),1,4) = ?`;
      params.push(year);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
      where += ` AND COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_activite'), r.event_date, '') = ?`;
      params.push(activityDate);
    }
    for (const [key,value] of [['sous_prefecture',sousPrefecture],['localite',localite],['essence',essence]]) {
      if (value) { where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.${key}'),'')) LIKE LOWER(?)`; params.push(`%${value}%`); }
    }
    if (reboisementType) {
      where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.type_reboisement'),'')) = LOWER(?)`;
      params.push(reboisementType);
    }
  }
  if (module === 'transformation-bois') {
    if (woodType === 'EXPLOITANTS_SECONDAIRES' || woodType === 'PRODUITS_QTE') {
      where += ` AND json_extract(COALESCE(r.data_json,'{}'), '$._wood_type') = ?`;
      params.push(woodType);
    } else if (woodType === 'UNITES_BOIS') {
      where += ` AND (json_extract(COALESCE(r.data_json,'{}'), '$._wood_type') = ? OR json_extract(COALESCE(r.data_json,'{}'), '$._wood_type') IS NULL)`;
      params.push('UNITES_BOIS');
    }
    const year = String(url.searchParams.get('year') || '').trim();
    const activityDate = String(url.searchParams.get('activityDate') || '').trim();
    const localite = String(url.searchParams.get('localite') || '').trim();
    const natureProduit = String(url.searchParams.get('natureProduit') || '').trim();
    const operatorStatus = String(url.searchParams.get('operatorStatus') || '').trim();
    const exercantType = String(url.searchParams.get('exercantType') || '').trim();
    const region = String(url.searchParams.get('region') || '').trim();
    const departement = String(url.searchParams.get('departement') || '').trim();
    if (/^\d{4}$/.test(year)) {
      where += ` AND substr(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_delivrance'), r.event_date, ''),1,4) = ?`;
      params.push(year);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
      where += ` AND COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.date_delivrance'), r.event_date, '') = ?`;
      params.push(activityDate);
    }
    for (const [key,value] of [['localite',localite],['nature_produit',natureProduit],['region',region],['departement',departement]]) {
      if (value) { where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.${key}'),'')) LIKE LOWER(?)`; params.push(`%${value}%`); }
    }
    if (operatorStatus) { where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.statut_operateur'),'')) = LOWER(?)`; params.push(operatorStatus); }
    if (exercantType) { where += ` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.type_exercant'),'')) = LOWER(?)`; params.push(exercantType); }
  }
  if (module === 'feux-brousse') {
    const fireType = String(url.searchParams.get('fireType') || '').trim().toUpperCase();
    if (fireType === 'DEGATS') {
      where += ` AND (json_extract(COALESCE(r.data_json,'{}'), '$._fire_type')='DEGATS' OR json_extract(COALESCE(r.data_json,'{}'), '$._fire_type') IS NULL)`;
    } else if (['REDYNAMISE','CREE','RENOUVELE'].includes(fireType)) {
      where += ` AND json_extract(COALESCE(r.data_json,'{}'), '$._fire_type')=?`; params.push(fireType);
    }
    const department=String(url.searchParams.get('department')||'').trim(), sous=String(url.searchParams.get('sousPrefecture')||'').trim(), village=String(url.searchParams.get('village')||'').trim(), activityDate=String(url.searchParams.get('activityDate')||'').trim(), nature=String(url.searchParams.get('natureDegats')||'').trim();
    for(const [key,value] of [['departement',department],['sous_prefecture',sous],['village',village],['nature_degats',nature]]) if(value){where+=` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'),'$.${key}'),'')) LIKE LOWER(?)`;params.push(`%${value}%`)}
    if(/^\d{4}-\d{2}-\d{2}$/.test(activityDate)){where+=` AND COALESCE(json_extract(COALESCE(r.data_json,'{}'),'$.date_constat'),r.event_date,'')=?`;params.push(activityDate)}
  }
  if (module === 'faune') {
    const faunaType=String(url.searchParams.get('faunaType')||'').trim().toUpperCase();
    if(faunaType==='OBSERVATIONS'){where+=` AND (json_extract(COALESCE(r.data_json,'{}'),'$._fauna_type')='OBSERVATIONS' OR json_extract(COALESCE(r.data_json,'{}'),'$._fauna_type') IS NULL)`}
    else if(faunaType==='CONFLITS'){where+=` AND json_extract(COALESCE(r.data_json,'{}'),'$._fauna_type')='CONFLITS'`}
    const activityDate=String(url.searchParams.get('activityDate')||'').trim(), species=String(url.searchParams.get('species')||'').trim(), zone=String(url.searchParams.get('zone')||'').trim(), sous=String(url.searchParams.get('sousPrefecture')||'').trim(), village=String(url.searchParams.get('village')||'').trim(), conflict=String(url.searchParams.get('conflictType')||'').trim();
    for(const [key,value] of [['especes_animales',species],['zone_observation',zone],['sous_prefecture',sous],['village',village],['type_conflit',conflict]]) if(value){where+=` AND LOWER(COALESCE(json_extract(COALESCE(r.data_json,'{}'),'$.${key}'),'')) LIKE LOWER(?)`;params.push(`%${value}%`)}
    if(/^\d{4}-\d{2}-\d{2}$/.test(activityDate)){where+=` AND COALESCE(json_extract(COALESCE(r.data_json,'{}'),'$.date_observation'),r.event_date,'')=?`;params.push(activityDate)}
  }
  if (module === 'missions') {
    const missionType=String(url.searchParams.get('missionType')||'').trim().toUpperCase();
    if(['DISPOSITION','REALISEE'].includes(missionType)){where+=` AND json_extract(COALESCE(r.data_json,'{}'),'$._mission_type')=?`;params.push(missionType)}
  }
  if (module === 'infractions') {
    const missionType=String(url.searchParams.get('missionType')||'').trim().toUpperCase();
    if(missionType==='REPRESSION'){where+=` AND (json_extract(COALESCE(r.data_json,'{}'),'$._offense_type')='REPRESSION' OR json_extract(COALESCE(r.data_json,'{}'),'$._mission_type')='REPRESSION')`}
  }
  if (module === 'offense_pv') {
    const sourceOffenseId=Number(url.searchParams.get('sourceOffenseId')||0);
    if(sourceOffenseId>0){where+=` AND CAST(json_extract(COALESCE(r.data_json,'{}'),'$._source_offense_id') AS INTEGER)=?`;params.push(sourceOffenseId)}
  }
  if (module === 'stages') {
    const stageType = String(url.searchParams.get('stageType') || '').toUpperCase();
    if (stageType === 'MISE_STAGE') {
      where += ` AND json_extract(COALESCE(r.data_json,'{}'), '$._stage_type') = ?`;
      params.push('MISE_STAGE');
    } else if (stageType === 'FIN_STAGE') {
      where += ` AND (json_extract(COALESCE(r.data_json,'{}'), '$._stage_type') = ? OR json_extract(COALESCE(r.data_json,'{}'), '$._stage_type') IS NULL)`;
      params.push('FIN_STAGE');
    }
  }
  if (module === 'documents') {
    const documentType = String(url.searchParams.get('documentType') || '').toUpperCase();
    if (documentType === 'CESSATION_SERVICE') {
      where += ` AND (json_extract(COALESCE(r.data_json,'{}'), '$._document_type') = ? OR (json_extract(COALESCE(r.data_json,'{}'), '$._document_type') IS NULL AND UPPER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.type'),'')) LIKE '%CESSATION%'))`;
      params.push('CESSATION_SERVICE');
    } else if (documentType === 'REPRISE_SERVICE') {
      where += ` AND (json_extract(COALESCE(r.data_json,'{}'), '$._document_type') = ? OR (json_extract(COALESCE(r.data_json,'{}'), '$._document_type') IS NULL AND UPPER(COALESCE(json_extract(COALESCE(r.data_json,'{}'), '$.type'),'')) LIKE '%REPRISE%'))`;
      params.push('REPRISE_SERVICE');
    } else if (['CESSATION_CONGE','PRISE_SERVICE_MUTATION','DEMANDE_EXPLICATION'].includes(documentType)) {
      where += ` AND json_extract(COALESCE(r.data_json,'{}'), '$._document_type') = ?`;
      params.push(documentType);
    }
  }
  if (module === 'convocation_pv') {
    const sourceConvocationId = Number(url.searchParams.get('sourceConvocationId') || 0);
    if (sourceConvocationId > 0) {
      where += ` AND CAST(json_extract(COALESCE(r.data_json,'{}'), '$._source_convocation_id') AS INTEGER) = ?`;
      params.push(sourceConvocationId);
    }
  }
  const count = await env.SIGAT_DB.prepare(`SELECT COUNT(*) AS c FROM ${table} r WHERE ${where}`).bind(...params).first();
  const rows = await env.SIGAT_DB.prepare(`
    SELECT r.id,r.organization_id,r.reference,r.title,r.event_date,r.status,r.data_json,r.created_at,r.updated_at,
           o.name AS source_organization,COALESCE(o.service_type,o.organization_type) AS source_type,
           p.name AS parent_name,gp.name AS grandparent_name,ggp.name AS great_grandparent_name
    FROM ${table} r JOIN organizations o ON o.id=r.organization_id
    LEFT JOIN organizations p ON p.id=o.parent_id
    LEFT JOIN organizations gp ON gp.id=p.parent_id
    LEFT JOIN organizations ggp ON ggp.id=gp.parent_id
    WHERE ${where}
    ORDER BY COALESCE(r.event_date,r.created_at) DESC,r.id DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, (page - 1) * limit).all();
  let items = rows.results.map(r => { const path=[r.great_grandparent_name,r.grandparent_name,r.parent_name,r.source_organization].filter(Boolean).join(' › '); return { ...r, source_path:path, data: safeJson(r.data_json), owned: Number(r.organization_id) === Number(auth.user.organization_id), data_json: undefined }; });
  if (module === 'exploitation-forestiere' && forestType === 'PEPINIERE' && items.length) {
    const distRows = await env.SIGAT_DB.prepare(`
      SELECT organization_id, LOWER(TRIM(COALESCE(json_extract(COALESCE(data_json,'{}'),'$.essence'),''))) AS essence_key,
             SUM(CAST(COALESCE(json_extract(COALESCE(data_json,'{}'),'$.nombre_total_plants'),0) AS REAL)) AS distributed
      FROM forest_perimeters
      WHERE organization_id IN (${sql}) AND archived_at IS NULL
        AND json_extract(COALESCE(data_json,'{}'),'$._forest_type')='REBOISEMENT'
      GROUP BY organization_id, essence_key
    `).bind(...binds).all();
    const distMap = new Map((distRows.results||[]).map(x=>[`${Number(x.organization_id)}|${String(x.essence_key||'')}`, Number(x.distributed||0)]));
    items = items.map(item=>{const d={...(item.data||{})};const key=`${Number(item.organization_id)}|${String(d.essence||'').trim().toLowerCase()}`;const distributed=Math.max(0,Math.round(distMap.get(key)||0));const produced=Math.max(0,Number(d.nbr_plants_produits||0)||0);d.nbr_plants_distribues=distributed;d.nbr_plants_disponibles=Math.max(0,Math.round(produced-distributed));return {...item,data:d};});
  }
  return ok({ module, items, page, limit, total: Number(count?.c || 0), totalPages: Math.max(1, Math.ceil(Number(count?.c || 0) / limit)) });
}

function safeJson(v) { try { return JSON.parse(v || '{}'); } catch { return {}; } }

/* V1.28 — Liaison intelligente Mise en stage -> Fin de stage. */
async function validateStageSource(env, orgId, sourceId, ignoreFinalId = 0) {
  sourceId = Number(sourceId || 0);
  if (!sourceId) return null;
  const source = await env.SIGAT_DB.prepare(`SELECT id,status,data_json FROM internships WHERE id=? AND organization_id=? AND archived_at IS NULL`).bind(sourceId, orgId).first();
  if (!source) throw new Error('Le stage en cours sélectionné est introuvable dans votre structure.');
  const sourceData = safeJson(source.data_json);
  if (String(sourceData._stage_type || '').toUpperCase() !== 'MISE_STAGE') throw new Error('La source sélectionnée n’est pas une mise en stage.');
  const dup = await env.SIGAT_DB.prepare(`
    SELECT id FROM internships
    WHERE organization_id=? AND archived_at IS NULL AND id<>?
      AND json_extract(COALESCE(data_json,'{}'),'$._stage_type')='FIN_STAGE'
      AND CAST(json_extract(COALESCE(data_json,'{}'),'$._source_stage_id') AS INTEGER)=?
      AND UPPER(COALESCE(status,''))<>'ANNULÉE'
    LIMIT 1
  `).bind(orgId, Number(ignoreFinalId || 0), sourceId).first();
  if (dup) throw new Error('Une fin de stage est déjà enregistrée pour ce stage.');
  return source;
}

async function syncStageSourceStatus(env, orgId, sourceId) {
  sourceId = Number(sourceId || 0);
  if (!sourceId) return;
  const activeFinal = await env.SIGAT_DB.prepare(`
    SELECT COUNT(*) AS c FROM internships
    WHERE organization_id=? AND archived_at IS NULL
      AND json_extract(COALESCE(data_json,'{}'),'$._stage_type')='FIN_STAGE'
      AND CAST(json_extract(COALESCE(data_json,'{}'),'$._source_stage_id') AS INTEGER)=?
      AND UPPER(COALESCE(status,''))<>'ANNULÉE'
  `).bind(orgId, sourceId).first();
  if (Number(activeFinal?.c || 0) > 0) {
    await env.SIGAT_DB.prepare(`UPDATE internships SET status=CASE WHEN UPPER(COALESCE(status,''))='ANNULÉE' THEN status ELSE 'TERMINÉ' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(sourceId, orgId).run();
  } else {
    await env.SIGAT_DB.prepare(`UPDATE internships SET status='EN COURS',updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND UPPER(COALESCE(status,''))='TERMINÉ'`).bind(sourceId, orgId).run();
  }
}

async function validateConvocationPvSource(env, orgId, sourceId, ignorePvId = 0) {
  sourceId = Number(sourceId || 0);
  if (!sourceId) throw new Error('La convocation d’origine est obligatoire pour établir le procès-verbal.');
  const source = await env.SIGAT_DB.prepare(`SELECT id,reference,title,event_date,status,data_json FROM convocations WHERE id=? AND organization_id=?`).bind(sourceId, orgId).first();
  if (!source) throw new Error('La convocation sélectionnée est introuvable dans votre structure.');
  await ensureModuleTable(env, 'convocation_minutes');
  const dup = await env.SIGAT_DB.prepare(`
    SELECT id FROM convocation_minutes
    WHERE organization_id=? AND archived_at IS NULL AND id<>?
      AND CAST(json_extract(COALESCE(data_json,'{}'),'$._source_convocation_id') AS INTEGER)=?
      AND UPPER(COALESCE(status,''))<>'ANNULÉ'
    LIMIT 1
  `).bind(orgId, Number(ignorePvId || 0), sourceId).first();
  if (dup) throw new Error('Un procès-verbal est déjà enregistré pour cette convocation. Modifiez le procès-verbal existant.');
  return source;
}

async function convocationHasPv(env, orgId, convocationId) {
  if (!(await tableExists(env, 'convocation_minutes'))) return false;
  const row = await env.SIGAT_DB.prepare(`
    SELECT id FROM convocation_minutes
    WHERE organization_id=? AND archived_at IS NULL
      AND CAST(json_extract(COALESCE(data_json,'{}'),'$._source_convocation_id') AS INTEGER)=?
    LIMIT 1
  `).bind(orgId, Number(convocationId || 0)).first();
  return !!row;
}


async function validateOffensePvSource(env, orgId, sourceId, ignorePvId=0){
  sourceId=Number(sourceId||0);if(!sourceId)throw new Error('L’affaire d’origine est obligatoire pour établir le P-V.');
  const source=await env.SIGAT_DB.prepare(`SELECT id,title,event_date,data_json FROM offenses WHERE id=? AND organization_id=? AND archived_at IS NULL`).bind(sourceId,orgId).first();
  if(!source)throw new Error('L’affaire sélectionnée est introuvable dans votre structure.');
  await ensureModuleTable(env,'offense_minutes');
  const dup=await env.SIGAT_DB.prepare(`SELECT id FROM offense_minutes WHERE organization_id=? AND archived_at IS NULL AND id<>? AND CAST(json_extract(COALESCE(data_json,'{}'),'$._source_offense_id') AS INTEGER)=? LIMIT 1`).bind(orgId,Number(ignorePvId||0),sourceId).first();
  if(dup)throw new Error('Un P-V est déjà enregistré pour cette affaire. Modifiez le P-V existant.');return source;
}
async function offenseHasPv(env,orgId,offenseId){
  if(!(await tableExists(env,'offense_minutes')))return false;
  const row=await env.SIGAT_DB.prepare(`SELECT id FROM offense_minutes WHERE organization_id=? AND archived_at IS NULL AND CAST(json_extract(COALESCE(data_json,'{}'),'$._source_offense_id') AS INTEGER)=? LIMIT 1`).bind(orgId,Number(offenseId||0)).first();return !!row;
}
async function ensureMissionNumber(env,orgId,incomingData){
  if(String(incomingData?._mission_type||'').toUpperCase()!=='REALISEE'||String(incomingData?.numero_mission||'').trim())return;
  const year=new Date().getUTCFullYear();
  const row=await env.SIGAT_DB.prepare(`SELECT MAX(CAST(substr(COALESCE(json_extract(data_json,'$.numero_mission'),''),9) AS INTEGER)) AS n FROM missions WHERE organization_id=? AND json_extract(COALESCE(data_json,'{}'),'$._mission_type')='REALISEE' AND json_extract(COALESCE(data_json,'{}'),'$.numero_mission') LIKE ?`).bind(orgId,`MC-${year}-%`).first();
  incomingData.numero_mission=`MC-${year}-${String(Number(row?.n||0)+1).padStart(4,'0')}`;
}
async function hydrateRepressionMissionContext(env,orgId,incomingData){
  if(String(incomingData?._mission_type||incomingData?._offense_type||'').toUpperCase()!=='REPRESSION')return;
  const linked=String(incomingData?.liee_mission||'').toLowerCase()==='oui';
  const missionId=Number(incomingData?.mission_liee_id||0);
  const clear=()=>{for(const k of ['_mission_numero','_mission_libelle','_mission_chef','_mission_chef_grade','_mission_chef_fonction','_mission_agents','_mission_objectif','_mission_resultat','_mission_immatriculation','_mission_materiels'])incomingData[k]=''};
  if(!linked||!missionId){clear();return}
  const row=await env.SIGAT_DB.prepare(`SELECT id,reference,title,event_date,data_json FROM missions WHERE id=? AND organization_id=? AND archived_at IS NULL LIMIT 1`).bind(missionId,orgId).first();
  if(!row)throw new Error('La mission liée est introuvable dans votre structure.');
  const d=safeJson(row.data_json);if(String(d._mission_type||'').toUpperCase()!=='REALISEE')throw new Error('La mission liée doit être une mission de contrôle réalisée.');
  const libelle=String(d.libelle_mission||'')==='Autre'?String(d.libelle_mission_autre||''):String(d.libelle_mission||row.title||'');
  incomingData._mission_numero=String(d.numero_mission||row.reference||'');incomingData._mission_libelle=libelle;
  incomingData._mission_chef=String(d.chef_mission||'');incomingData._mission_chef_grade=String(d._chef_mission_grade||'');incomingData._mission_chef_fonction=String(d._chef_mission_fonction||'');incomingData._mission_agents=String(d.autres_agents_participants||'');
  incomingData._mission_objectif=String(d.objectif_mission||'');incomingData._mission_resultat=String(d.resultat||'');
  incomingData._mission_immatriculation=String(d.immatriculation||'');incomingData._mission_materiels=String(d.materiels_equipements||'');
  incomingData.mission_liee_label=[incomingData._mission_numero,incomingData._mission_libelle].filter(Boolean).join(' — ');
}
function syncPvFromOffense(incomingData,source,sourceData){
  const direct=['personne_mise_cause','objet_infraction','objets_saisis','produits_saisis','materiels_saisis','date_controle','heure_controle','lieu_controle','domicile_mis_cause','contact_mis_cause','type_piece_identite','numero_piece_identite','arrestation','sort_biens','lieu_conservation','liee_mission','mission_liee_id','mission_liee_label','agents_arrestation','_mission_numero','_mission_libelle','_mission_chef','_mission_chef_grade','_mission_chef_fonction','_mission_agents','_mission_objectif','_mission_resultat','_mission_immatriculation','_mission_materiels'];
  for(const key of direct)incomingData[key]=sourceData[key]??'';
  if(!incomingData.type_piece_identite&&sourceData.type_numero_piece){const parts=String(sourceData.type_numero_piece).split(/[-–—]/);incomingData.type_piece_identite=String(parts.shift()||'').trim();incomingData.numero_piece_identite=String(parts.join('-')||'').trim()}
  incomingData.personne_mise_cause=String(sourceData.personne_mise_cause||source.title||'').trim();
  incomingData._mission_agents=String(sourceData._mission_agents||sourceData.agents_arrestation||'').trim();
  incomingData.mission_reference_affichage=[sourceData._mission_numero,sourceData._mission_libelle].filter(v=>String(v||'').trim()).join(' / ')||String(sourceData.mission_liee_label||'').trim()||'—';
}

async function apiSave(env, request) {
  const auth = await getSession(env, request, { allowExpired: false });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.denied) return bad('Abonnement expiré.', 402, auth.denied);
  if (!requireCsrf(request, auth)) return bad('Jeton CSRF invalide.', 403, 'CSRF');
  if (auth.user.role_code === 'SUPER_ADMIN') return bad('Action non autorisée ici.', 403);
  if (!['ORGANIZATION_ADMIN','MEMBER'].includes(auth.user.role_code)) return bad('Droits insuffisants.', 403);
  const body = await parseJson(request);
  const module = String(body?.module || '');
  const action = String(body?.action || '');
  const table = MODULES[module];
  if (!table || !['create','update','archive','delete'].includes(action)) return bad('Opération invalide.');
  await ensureModuleTable(env, table);
  const orgId = Number(auth.user.organization_id);
  const payload = body?.payload || {};
  const incomingData = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const incomingStageType = module === 'stages' ? String(incomingData._stage_type || '').toUpperCase() : '';
  const incomingSourceStageId = incomingStageType === 'FIN_STAGE' ? Number(incomingData._source_stage_id || 0) : 0;
  const incomingSourceConvocationId = module === 'convocation_pv' ? Number(incomingData._source_convocation_id || 0) : 0;
  const incomingSourceOffenseId = module === 'offense_pv' ? Number(incomingData._source_offense_id || 0) : 0;
  if(module==='missions') await ensureMissionNumber(env,orgId,incomingData);
  if(module==='infractions'){
    try{await hydrateRepressionMissionContext(env,orgId,incomingData)}catch(e){return bad(String(e?.message||e))}
  }

  if (action === 'create') {
    let title = String(payload.title || '').trim();
    if (!title) return bad('Le titre ou nom principal est obligatoire.');
    if (module === 'stages' && incomingStageType === 'FIN_STAGE' && incomingSourceStageId) {
      try { await validateStageSource(env, orgId, incomingSourceStageId, 0); }
      catch (e) { return bad(String(e?.message || e)); }
    }
    if (module === 'convocation_pv') {
      try { await validateConvocationPvSource(env, orgId, incomingSourceConvocationId, 0); }
      catch (e) { return bad(String(e?.message || e)); }
    }
    if (module === 'offense_pv') {
      try {
        const source=await validateOffensePvSource(env, orgId, incomingSourceOffenseId, 0);const sourceData=safeJson(source.data_json);
        syncPvFromOffense(incomingData,source,sourceData);
        payload.title=incomingData.personne_mise_cause||source.title||'Infraction';title=String(payload.title||'Infraction').trim();
      } catch (e) { return bad(String(e?.message || e)); }
    }
    const r = await env.SIGAT_DB.prepare(`INSERT INTO ${table}(organization_id,reference,title,event_date,status,data_json,created_by) VALUES(?,?,?,?,?,?,?)`)
      .bind(orgId, payload.reference || null, title, payload.eventDate || null, payload.status || 'ACTIVE', JSON.stringify(incomingData), auth.user.id).run();
    if (module === 'stages' && incomingStageType === 'FIN_STAGE' && incomingSourceStageId) await syncStageSourceStatus(env, orgId, incomingSourceStageId);
    await audit(env, request, { action: 'RECORD_CREATED', organization_id: orgId, actor_user_id: auth.user.id, user_id: auth.user.id, target_type: module, target_id: r.meta.last_row_id, description: title });
    return ok({ id: r.meta.last_row_id });
  }

  const id = Number(payload.id);
  if (!id) return bad('Identifiant manquant.');
  const owned = await env.SIGAT_DB.prepare(`SELECT id,status,data_json FROM ${table} WHERE id=? AND organization_id=?`).bind(id, orgId).first();
  if (!owned) return bad('Cette donnée ne peut pas être modifiée par votre structure.', 403, 'NOT_OWNER');
  const previousData = module === 'stages' ? safeJson(owned.data_json) : {};
  const previousStageType = module === 'stages' ? String(previousData._stage_type || '').toUpperCase() : '';
  const previousSourceStageId = previousStageType === 'FIN_STAGE' ? Number(previousData._source_stage_id || 0) : 0;

  if (action === 'update') {
    let title = String(payload.title || '').trim();
    if (!title) return bad('Le titre ou nom principal est obligatoire.');
    if (module === 'stages' && incomingStageType === 'FIN_STAGE' && incomingSourceStageId) {
      try { await validateStageSource(env, orgId, incomingSourceStageId, id); }
      catch (e) { return bad(String(e?.message || e)); }
    }
    if (module === 'convocation_pv') {
      try { await validateConvocationPvSource(env, orgId, incomingSourceConvocationId, id); }
      catch (e) { return bad(String(e?.message || e)); }
    }
    if (module === 'offense_pv') {
      try {
        const source=await validateOffensePvSource(env, orgId, incomingSourceOffenseId, id);const sourceData=safeJson(source.data_json);
        syncPvFromOffense(incomingData,source,sourceData);
        payload.title=incomingData.personne_mise_cause||source.title||'Infraction';title=String(payload.title||'Infraction').trim();
      } catch (e) { return bad(String(e?.message || e)); }
    }
    await env.SIGAT_DB.prepare(`UPDATE ${table} SET reference=?,title=?,event_date=?,status=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`)
      .bind(payload.reference || null, title, payload.eventDate || null, payload.status || 'ACTIVE', JSON.stringify(incomingData), id, orgId).run();

  if (module === 'stages') {
      if (previousSourceStageId && previousSourceStageId !== incomingSourceStageId) await syncStageSourceStatus(env, orgId, previousSourceStageId);
      if (incomingSourceStageId) await syncStageSourceStatus(env, orgId, incomingSourceStageId);
    }
    await audit(env, request, { action: 'RECORD_UPDATED', organization_id: orgId, actor_user_id: auth.user.id, target_type: module, target_id: id, description: title });
    return ok();
  }

  if (action === 'delete') {
    if (module === 'convocations' && await convocationHasPv(env, orgId, id)) return bad('Cette convocation possède un procès-verbal. Supprimez d’abord le procès-verbal lié avant de supprimer la convocation.');
    if (module === 'infractions' && await offenseHasPv(env, orgId, id)) return bad('Cette affaire possède un P-V. Supprimez d’abord le P-V lié avant de supprimer l’affaire.');
    await env.SIGAT_DB.prepare(`DELETE FROM ${table} WHERE id=? AND organization_id=?`).bind(id, orgId).run();
    if (module === 'stages' && previousSourceStageId) await syncStageSourceStatus(env, orgId, previousSourceStageId);
    await audit(env, request, { action: 'RECORD_DELETED', organization_id: orgId, actor_user_id: auth.user.id, target_type: module, target_id: id });
    return ok();
  }

  await env.SIGAT_DB.prepare(`UPDATE ${table} SET status='ARCHIVED',archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(id, orgId).run();
  if (module === 'stages' && previousSourceStageId) await syncStageSourceStatus(env, orgId, previousSourceStageId);
  await audit(env, request, { action: 'RECORD_ARCHIVED', organization_id: orgId, actor_user_id: auth.user.id, target_type: module, target_id: id });
  return ok();
}

async function apiOrgUsers(env, request) {
  const auth = await getSession(env, request, { allowExpired: true });
  if (!auth) return bad('Session invalide.', 401);
  if (auth.user.role_code !== 'ORGANIZATION_ADMIN') return bad('Droits insuffisants.', 403);
  const rows = await env.SIGAT_DB.prepare(`SELECT id,username,email,display_name,phone,role_code,status,last_login_at,created_at FROM users WHERE organization_id=? AND deleted_at IS NULL ORDER BY display_name`).bind(auth.user.organization_id).all();
  return ok({ items: rows.results });
}

async function apiOrgUserCreate(env, request) {
  const auth = await getSession(env, request, { allowExpired: false });
  if (!auth || auth.denied) return bad('Accès refusé.', 403);
  if (auth.user.role_code !== 'ORGANIZATION_ADMIN') return bad('Droits insuffisants.', 403);
  if (!requireCsrf(request, auth)) return bad('Jeton CSRF invalide.', 403);
  const b = await parseJson(request);
  const role = String(b?.role || 'MEMBER').toUpperCase();
  if (!['MEMBER','READ_ONLY'].includes(role)) return bad('Rôle non autorisé.');
  const username = String(b?.username || '').trim();
  const email = normalizeIdentifier(b?.email);
  const displayName = String(b?.displayName || '').trim();
  const password = String(b?.password || '');
  if (!username || !displayName || !validPassword(password)) return bad('Informations invalides ou mot de passe trop faible.');
  const dup = await env.SIGAT_DB.prepare('SELECT id FROM users WHERE lower(username)=? OR (?<>\'\' AND lower(email)=?)').bind(username.toLowerCase(), email, email).first();
  if (dup) return bad('Identifiant ou e-mail déjà utilisé.');
  const hp = await hashPassword(password);
  const r = await env.SIGAT_DB.prepare(`INSERT INTO users(organization_id,username,email,display_name,phone,role_code,password_hash,password_salt,password_iterations,status,force_password_change) VALUES(?,?,?,?,?,?,?,?,?,'ACTIVE',1)`)
    .bind(auth.user.organization_id, username, email || null, displayName, b?.phone || null, role, hp.hash, hp.salt, hp.iterations).run();
  await audit(env, request, { action: 'USER_CREATED', organization_id: auth.user.organization_id, actor_user_id: auth.user.id, target_type: 'user', target_id: r.meta.last_row_id, description: displayName });
  return ok({ id: r.meta.last_row_id });
}

async function apiOrgUserAction(env, request, kind) {
  const auth = await getSession(env, request, { allowExpired: true });
  if (!auth || auth.user.role_code !== 'ORGANIZATION_ADMIN') return bad('Droits insuffisants.', 403);
  if (!requireCsrf(request, auth)) return bad('Jeton CSRF invalide.', 403);
  const b = await parseJson(request);
  const target = await env.SIGAT_DB.prepare(`SELECT id,role_code,status FROM users WHERE id=? AND organization_id=? AND deleted_at IS NULL`).bind(Number(b?.userId), auth.user.organization_id).first();
  if (!target || !['MEMBER','READ_ONLY'].includes(target.role_code)) return bad('Utilisateur non gérable par cet administrateur.', 403);
  if (kind === 'status') {
    const status = String(b?.status || '').toUpperCase();
    if (!['ACTIVE','DISABLED','SUSPENDED'].includes(status)) return bad('Statut invalide.');
    await env.SIGAT_DB.prepare('UPDATE users SET status=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, target.id).run();
    await audit(env, request, { action: 'USER_STATUS_CHANGED', organization_id: auth.user.organization_id, actor_user_id: auth.user.id, target_type: 'user', target_id: target.id, description: status });
    return ok();
  }
  if (kind === 'reset') {
    const temp = randomPassword();
    const hp = await hashPassword(temp);
    await env.SIGAT_DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,force_password_change=1,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(hp.hash, hp.salt, hp.iterations, target.id).run();
    await env.SIGAT_DB.prepare(`UPDATE password_reset_requests SET status='COMPLETED',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='PENDING'`).bind(auth.user.id, target.id).run();
    await audit(env, request, { action: 'PASSWORD_RESET_BY_ADMIN', organization_id: auth.user.organization_id, actor_user_id: auth.user.id, target_type: 'user', target_id: target.id });
    return ok({ temporaryPassword: temp, message: 'Mot de passe temporaire généré. Il ne sera affiché qu’une seule fois.' });
  }
  if (kind === 'delete') {
    await env.SIGAT_DB.prepare(`UPDATE users SET status='ARCHIVED',deleted_at=CURRENT_TIMESTAMP,session_version=session_version+1 WHERE id=?`).bind(target.id).run();
    await audit(env, request, { action: 'USER_ARCHIVED', organization_id: auth.user.organization_id, actor_user_id: auth.user.id, target_type: 'user', target_id: target.id });
    return ok();
  }
  return bad('Action invalide.');
}

async function requireSuper(env, request, write = false) {
  const auth = await getSession(env, request, { allowExpired: true });
  if (!auth || auth.user.role_code !== 'SUPER_ADMIN') return { error: bad('Accès Super Admin requis.', 403) };
  if (write && !requireCsrf(request, auth)) return { error: bad('Jeton CSRF invalide.', 403) };
  return { auth };
}

async function superDashboard(env, request) {
  const { auth, error } = await requireSuper(env, request); if (error) return error;
  const org = await env.SIGAT_DB.prepare(`SELECT COUNT(*) total, SUM(COALESCE(service_type,organization_type)='PEF') pef, SUM(COALESCE(service_type,organization_type)='CANTONNEMENT') cantonnements, SUM(COALESCE(service_type,organization_type)='DIRECTION_REGIONALE') directions, SUM(COALESCE(service_type,organization_type)='DIRECTION_DEPARTEMENTALE') departementales, SUM(status='ACTIVE') actifs FROM organizations`).first();
  const usr = await env.SIGAT_DB.prepare(`SELECT COUNT(*) total, SUM(status='ACTIVE') actifs, SUM(status<>'ACTIVE') inactifs FROM users WHERE role_code<>'SUPER_ADMIN' AND deleted_at IS NULL`).first();
  const subs = await env.SIGAT_DB.prepare(`SELECT SUM(plan='FREE') free, SUM(plan='STANDARD') standard, SUM(plan='BUSINESS') business FROM subscriptions`).first();
  return ok({ organizations: org, users: usr, subscriptions: subs });
}

async function superOrganizations(env, request) {
  const { error } = await requireSuper(env, request); if (error) return error;
  const rows = await env.SIGAT_DB.prepare(`
    SELECT o.id,o.parent_id,COALESCE(o.service_type,o.organization_type) AS organization_type,o.code,o.name,o.region,o.department,o.locality,o.phone,o.email,o.status,o.created_at,
           p.name AS parent_name,s.plan,s.start_date,s.end_date,s.status AS subscription_status
    FROM organizations o LEFT JOIN organizations p ON p.id=o.parent_id LEFT JOIN subscriptions s ON s.organization_id=o.id
    ORDER BY o.created_at DESC
  `).all();
  return ok({ items: rows.results });
}

async function createFreeSubscription(env, orgId, actorId) {
  const existing = await env.SIGAT_DB.prepare('SELECT id FROM subscriptions WHERE organization_id=?').bind(orgId).first();
  if (existing) return;
  const start = new Date();
  const end = new Date(start.getTime() + 20 * 86400000);
  const ds = d => d.toISOString().slice(0,10);
  await env.SIGAT_DB.prepare(`INSERT INTO subscriptions(organization_id,plan,price,start_date,end_date,status) VALUES(?,'FREE',0,?,?,'TRIAL')`).bind(orgId, ds(start), ds(end)).run();
  await env.SIGAT_DB.prepare(`INSERT INTO subscription_history(organization_id,old_plan,new_plan,start_date,end_date,price,mode_activation,activated_by) VALUES(?,NULL,'FREE',?,?,0,'AUTO_ACTIVATION',?)`).bind(orgId, ds(start), ds(end), actorId).run();
}

async function superOrganizationAction(env, request) {
  const { auth, error } = await requireSuper(env, request, true); if (error) return error;
  const b = await parseJson(request);
  const id = Number(b?.organizationId);
  const action = String(b?.action || '');
  const org = await env.SIGAT_DB.prepare('SELECT *,COALESCE(service_type,organization_type) AS canonical_type FROM organizations WHERE id=?').bind(id).first();
  if (!org) return bad('Structure introuvable.', 404);
  if (action === 'status') {
    const status = String(b?.status || '').toUpperCase();
    if (!['PENDING','ACTIVE','SUSPENDED','CLOSED'].includes(status)) return bad('Statut invalide.');
    await env.SIGAT_DB.prepare('UPDATE organizations SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id).run();
    if (status === 'ACTIVE') await createFreeSubscription(env, id, auth.user.id);
    if (status !== 'ACTIVE') await env.SIGAT_DB.prepare('UPDATE users SET session_version=session_version+1 WHERE organization_id=?').bind(id).run();
    await audit(env, request, { action: 'ORGANIZATION_STATUS_CHANGED', actor_user_id: auth.user.id, organization_id: id, target_type: 'organization', target_id: id, description: status });
    return ok();
  }
  if (action === 'parent') {
    const parentId = b?.parentId ? Number(b.parentId) : null;
    const expected = PARENT_TYPE[org.canonical_type];
    if (!expected && parentId) return bad('Une Direction Régionale ne doit pas avoir de structure supérieure dans cette hiérarchie.');
    if (expected && !parentId) return bad('Cette structure doit obligatoirement être rattachée à un service supérieur.');
    if (parentId) {
      if (parentId === id) return bad('Une structure ne peut pas être son propre supérieur.');
      const parent = await env.SIGAT_DB.prepare("SELECT id,COALESCE(service_type,organization_type) AS canonical_type FROM organizations WHERE id=? AND status<>'CLOSED'").bind(parentId).first();
      if (!parent || parent.canonical_type !== expected) return bad(`Le service supérieur doit être de type ${expected}.`);
      const descendants = await env.SIGAT_DB.prepare(`WITH RECURSIVE tree(id) AS (SELECT id FROM organizations WHERE parent_id=? UNION ALL SELECT o.id FROM organizations o JOIN tree t ON o.parent_id=t.id) SELECT id FROM tree WHERE id=? LIMIT 1`).bind(id,parentId).first();
      if (descendants) return bad('Rattachement impossible : cette opération créerait une boucle hiérarchique.');
    }
    await env.SIGAT_DB.prepare('UPDATE organizations SET parent_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(parentId,id).run();
    await audit(env, request, { action: 'ORGANIZATION_PARENT_CHANGED', actor_user_id: auth.user.id, organization_id: id, target_type: 'organization', target_id: id, description: String(parentId || '') });
    return ok();
  }
  return bad('Action invalide.');
}

async function superUsers(env, request) {
  const { error } = await requireSuper(env, request); if (error) return error;
  const rows = await env.SIGAT_DB.prepare(`
    SELECT u.id,u.organization_id,u.username,u.email,u.display_name,u.phone,u.role_code,u.status,u.force_password_change,u.last_login_at,u.created_at,o.name AS organization_name,COALESCE(o.service_type,o.organization_type) AS organization_type
    FROM users u LEFT JOIN organizations o ON o.id=u.organization_id
    WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC
  `).all();
  return ok({ items: rows.results });
}

async function superUserAction(env, request, kind) {
  const { auth, error } = await requireSuper(env, request, true); if (error) return error;
  const b = await parseJson(request);
  const id = Number(b?.userId);
  const target = await env.SIGAT_DB.prepare('SELECT id,organization_id,role_code FROM users WHERE id=? AND deleted_at IS NULL').bind(id).first();
  if (!target) return bad('Utilisateur introuvable.',404);
  if (target.role_code === 'SUPER_ADMIN' && target.id === auth.user.id) return bad('Cette action n’est pas autorisée sur votre propre compte Super Admin.',403);
  if (kind === 'update') {
    const displayName = String(b?.displayName || '').trim();
    const email = normalizeIdentifier(b?.email);
    const phone = String(b?.phone || '').trim() || null;
    const role = String(b?.roleCode || target.role_code).toUpperCase();
    const organizationId = b?.organizationId === null || b?.organizationId === '' ? null : Number(b.organizationId);
    if (!displayName) return bad('Nom requis.');
    if (!['ORGANIZATION_ADMIN','MEMBER','READ_ONLY'].includes(role)) return bad('Rôle non autorisé.');
    if (!organizationId) return bad('Une structure de rattachement est requise.');
    const org = await env.SIGAT_DB.prepare('SELECT id FROM organizations WHERE id=?').bind(organizationId).first();
    if (!org) return bad('Structure introuvable.');
    await env.SIGAT_DB.prepare('UPDATE users SET display_name=?,email=?,phone=?,role_code=?,organization_id=?,updated_at=CURRENT_TIMESTAMP,session_version=session_version+1 WHERE id=?')
      .bind(displayName,email||null,phone,role,organizationId,id).run();
    await audit(env, request, { action: 'USER_UPDATED_BY_SUPERADMIN', actor_user_id: auth.user.id, organization_id: organizationId, target_type: 'user', target_id: id });
    return ok();
  }
  if (kind === 'status') {
    const status = String(b?.status || '').toUpperCase();
    if (!['ACTIVE','DISABLED','SUSPENDED'].includes(status)) return bad('Statut invalide.');
    await env.SIGAT_DB.prepare('UPDATE users SET status=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id).run();
    await audit(env, request, { action: 'SUPERADMIN_USER_STATUS', actor_user_id: auth.user.id, organization_id: target.organization_id, target_type: 'user', target_id: id, description: status });
    return ok();
  }
  if (kind === 'reset') {
    const temp = randomPassword(); const hp = await hashPassword(temp);
    await env.SIGAT_DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,force_password_change=1,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(hp.hash,hp.salt,hp.iterations,id).run();
    await env.SIGAT_DB.prepare(`UPDATE password_reset_requests SET status='COMPLETED',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='PENDING'`).bind(auth.user.id,id).run();
    await audit(env, request, { action: 'PASSWORD_RESET_BY_SUPERADMIN', actor_user_id: auth.user.id, organization_id: target.organization_id, target_type: 'user', target_id: id });
    return ok({ temporaryPassword: temp, message: 'Mot de passe temporaire généré. Il ne sera affiché qu’une seule fois.' });
  }
  if (kind === 'invalidate') {
    await env.SIGAT_DB.prepare('UPDATE users SET session_version=session_version+1 WHERE id=?').bind(id).run();
    await audit(env, request, { action: 'SESSIONS_INVALIDATED', actor_user_id: auth.user.id, organization_id: target.organization_id, target_type: 'user', target_id: id });
    return ok();
  }
  if (kind === 'delete') {
    await env.SIGAT_DB.prepare(`UPDATE users SET status='ARCHIVED',deleted_at=CURRENT_TIMESTAMP,session_version=session_version+1 WHERE id=?`).bind(id).run();
    await audit(env, request, { action: 'USER_ARCHIVED_BY_SUPERADMIN', actor_user_id: auth.user.id, organization_id: target.organization_id, target_type: 'user', target_id: id });
    return ok();
  }
  return bad('Action invalide.');
}


const PRINT_SETTING_KEYS = Object.freeze([
  'ministry','cabinet','regionalDirection','departmentalDirection','cantonment','post','structureName','locality','referencePrefix','republic','motto','signerTitle','signerName','signerPosition','emblemData','signatureData','stampData','ampliations','ampliationNumbers'
]);

function defaultSignerTitle(type) {
  if (type === 'PEF') return 'Le Chef de poste';
  if (type === 'CANTONNEMENT') return 'Le Chef de Cantonnement';
  if (type === 'DIRECTION_REGIONALE') return 'Le Directeur Régional';
  if (type === 'DIRECTION_DEPARTEMENTALE') return 'Le Directeur Départemental';
  return 'Le Responsable de la structure';
}

async function organizationPrintDefaults(env, organizationId) {
  const rows = await env.SIGAT_DB.prepare(`
    WITH RECURSIVE chain(id,name,organization_type,parent_id,locality,depth) AS (
      SELECT id,name,COALESCE(service_type,organization_type),parent_id,locality,0 FROM organizations WHERE id=?
      UNION ALL
      SELECT o.id,o.name,COALESCE(o.service_type,o.organization_type),o.parent_id,o.locality,chain.depth+1
      FROM organizations o JOIN chain ON chain.parent_id=o.id
      WHERE chain.depth < 8
    ) SELECT * FROM chain ORDER BY depth ASC
  `).bind(organizationId).all();
  const chain = rows.results || [];
  const own = chain[0] || {};
  const byType = t => chain.find(x => x.organization_type === t)?.name || '';
  return {
    ministry: 'MINISTERE DES EAUX ET FORETS',
    cabinet: 'CABINET DU MINISTRE',
    regionalDirection: byType('DIRECTION_REGIONALE'),
    departmentalDirection: byType('DIRECTION_DEPARTEMENTALE'),
    cantonment: byType('CANTONNEMENT'),
    post: own.organization_type === 'PEF' ? (own.name || '') : '',
    structureName: own.name || '',
    locality: own.locality || '',
    referencePrefix: '',
    republic: 'REPUBLIQUE DE COTE D’IVOIRE',
    motto: 'Union – Discipline – Travail',
    signerTitle: defaultSignerTitle(own.organization_type),
    signerName: '',
    signerPosition: '',
    emblemData: '',
    signatureData: '',
    stampData: '',
    ampliations: '',
    ampliationNumbers: ''
  };
}

async function apiPrintSettings(env, request) {
  const auth = await getSession(env, request, { allowExpired:true });
  if (!auth || auth.user.role_code === 'SUPER_ADMIN' || !auth.user.organization_id) return bad('Session de structure requise.', 403);
  const orgId = Number(auth.user.organization_id);
  const defaults = await organizationPrintDefaults(env, orgId);
  const rows = await env.SIGAT_DB.prepare('SELECT setting_key,setting_value FROM settings WHERE organization_id=?').bind(orgId).all();
  const settings = { ...defaults };
  for (const row of (rows.results || [])) if (PRINT_SETTING_KEYS.includes(row.setting_key)) settings[row.setting_key] = row.setting_value ?? '';
  return ok({ settings });
}

async function apiPrintSettingsSave(env, request) {
  const auth = await getSession(env, request, { allowExpired:true });
  if (!auth || auth.user.role_code !== 'ORGANIZATION_ADMIN' || !auth.user.organization_id) return bad('Seul l’Administrateur de la structure peut modifier les paramètres d’impression.', 403);
  if (!requireCsrf(request, auth)) return bad('Jeton CSRF invalide.', 403, 'CSRF');
  const body = await parseJson(request);
  const values = body?.settings && typeof body.settings === 'object' ? body.settings : null;
  if (!values) return bad('Paramètres invalides.');
  const orgId = Number(auth.user.organization_id);
  for (const key of PRINT_SETTING_KEYS) {
    let value = String(values[key] ?? '').trim();
    const isImage = ['emblemData','signatureData','stampData'].includes(key);
    const max = isImage ? 450000 : (['ampliations','ampliationNumbers'].includes(key) ? 4000 : 500);
    if (value.length > max) return bad(`La valeur « ${key} » est trop volumineuse.`);
    if (isImage && value && !/^data:image\/(png|jpeg|webp);base64,/i.test(value)) return bad(`Image invalide pour « ${key} ».`);
    await env.SIGAT_DB.prepare(`INSERT INTO settings(organization_id,setting_key,setting_value,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(organization_id,setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP`)
      .bind(orgId,key,value).run();
  }
  await audit(env, request, { action:'PRINT_SETTINGS_UPDATED', organization_id:orgId, user_id:auth.user.id, actor_user_id:auth.user.id, target_type:'settings', target_id:'print', description:'En-tête, référence, ampliations et signature des impressions mis à jour' });
  return ok({ saved:true });
}

async function superSubscriptions(env, request) {
  const { error } = await requireSuper(env, request); if (error) return error;
  const rows = await env.SIGAT_DB.prepare(`SELECT s.*,o.name AS organization_name,COALESCE(o.service_type,o.organization_type) AS organization_type,o.code FROM subscriptions s JOIN organizations o ON o.id=s.organization_id ORDER BY s.end_date ASC`).all();
  return ok({ items: rows.results });
}

async function superSetPlan(env, request) {
  const { auth, error } = await requireSuper(env, request, true); if (error) return error;
  const b = await parseJson(request);
  const orgId = Number(b?.organizationId);
  const plan = String(b?.plan || '').toUpperCase();
  const plans = { FREE: { days:20, price:0, status:'TRIAL' }, STANDARD:{days:30,price:20600,status:'ACTIVE'}, BUSINESS:{days:365,price:181000,status:'ACTIVE'} };
  const cfg = plans[plan]; if (!cfg) return bad('Plan invalide.');
  const org = await env.SIGAT_DB.prepare('SELECT id FROM organizations WHERE id=?').bind(orgId).first(); if (!org) return bad('Structure introuvable.',404);
  const old = await env.SIGAT_DB.prepare('SELECT plan FROM subscriptions WHERE organization_id=?').bind(orgId).first();
  const start = new Date(); const end = new Date(start.getTime()+cfg.days*86400000); const ds=d=>d.toISOString().slice(0,10);
  await env.SIGAT_DB.prepare(`INSERT INTO subscriptions(organization_id,plan,price,start_date,end_date,status) VALUES(?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET plan=excluded.plan,price=excluded.price,start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status,updated_at=CURRENT_TIMESTAMP`)
    .bind(orgId,plan,cfg.price,ds(start),ds(end),cfg.status).run();
  await env.SIGAT_DB.prepare(`INSERT INTO subscription_history(organization_id,old_plan,new_plan,start_date,end_date,price,mode_activation,activated_by) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(orgId,old?.plan||null,plan,ds(start),ds(end),cfg.price,'SUPERADMIN',auth.user.id).run();
  await audit(env, request, { action: 'SUBSCRIPTION_PLAN_SET', actor_user_id: auth.user.id, organization_id: orgId, target_type: 'subscription', target_id: orgId, description: `${plan} ${cfg.price}` });
  return ok({ plan, startDate: ds(start), endDate: ds(end) });
}

async function superPasswordRequests(env, request) {
  const { error } = await requireSuper(env, request); if (error) return error;
  const rows = await env.SIGAT_DB.prepare(`SELECT r.*,u.display_name,u.username,o.name AS organization_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN organizations o ON o.id=r.organization_id WHERE r.request_type='ADMINISTRATOR' ORDER BY r.requested_at DESC LIMIT 200`).all();
  return ok({ items: rows.results });
}

async function orgPasswordRequests(env, request) {
  const auth = await getSession(env, request, { allowExpired:true });
  if (!auth || auth.user.role_code !== 'ORGANIZATION_ADMIN') return bad('Droits insuffisants.',403);
  const rows = await env.SIGAT_DB.prepare(`SELECT r.*,u.display_name,u.username FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id WHERE r.organization_id=? AND r.request_type='USER' ORDER BY r.requested_at DESC LIMIT 200`).bind(auth.user.organization_id).all();
  return ok({ items: rows.results });
}

async function superAuditLogs(env, request) {
  const { error } = await requireSuper(env, request); if (error) return error;
  const rows = await env.SIGAT_DB.prepare(`SELECT a.*,u.display_name AS actor_name,o.name AS organization_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN organizations o ON o.id=a.organization_id ORDER BY a.created_at DESC LIMIT 500`).all();
  return ok({ items: rows.results });
}

async function routeApi(env, request, url) {
  const p = url.pathname;
  const m = request.method.toUpperCase();
  if (p === '/api/ping' && m === 'GET') return ok({ worker:true, version:'1.28-smart-autofill-system', message:'SIGAT Worker opérationnel' });
  if (p === '/api/health' && m === 'GET') return apiHealth(env);
  if (p === '/api/login' && m === 'POST') return apiLogin(env, request);
  if (p === '/api/logout' && m === 'POST') return apiLogout(env, request);
  if (p === '/api/session' && m === 'GET') return apiSession(env, request);
  if (p === '/api/register' && m === 'POST') return apiRegister(env, request);
  if (p === '/api/password-reset-request' && m === 'POST') return apiPasswordResetRequest(env, request);
  if (p === '/api/change-password' && m === 'POST') return apiChangePassword(env, request);
  if (p === '/api/dashboard' && m === 'GET') return apiDashboard(env, request);
  if (p === '/api/hierarchy' && m === 'GET') return apiHierarchy(env, request);
  if (p === '/api/hierarchy-assignment' && m === 'GET') return apiHierarchyAssignment(env, request);
  if (p === '/api/hierarchy-assignment' && m === 'POST') return apiHierarchyAssignmentSave(env, request);
  if (p === '/api/print-settings' && m === 'GET') return apiPrintSettings(env, request);
  if (p === '/api/print-settings' && m === 'POST') return apiPrintSettingsSave(env, request);
  if (p === '/api/load' && m === 'GET') return apiLoad(env, request);
  if (p === '/api/save' && m === 'POST') return apiSave(env, request);
  if (p === '/api/users' && m === 'GET') return apiOrgUsers(env, request);
  if (p === '/api/users/create' && m === 'POST') return apiOrgUserCreate(env, request);
  if (p === '/api/users/status' && m === 'POST') return apiOrgUserAction(env, request, 'status');
  if (p === '/api/users/reset-password' && m === 'POST') return apiOrgUserAction(env, request, 'reset');
  if (p === '/api/users/delete' && m === 'POST') return apiOrgUserAction(env, request, 'delete');
  if (p === '/api/password-requests' && m === 'GET') return orgPasswordRequests(env, request);

  if (p === '/api/superadmin/dashboard' && m === 'GET') return superDashboard(env, request);
  if (p === '/api/superadmin/organizations' && m === 'GET') return superOrganizations(env, request);
  if (p === '/api/superadmin/organizations/action' && m === 'POST') return superOrganizationAction(env, request);
  if (p === '/api/superadmin/users' && m === 'GET') return superUsers(env, request);
  if (p === '/api/superadmin/users/update' && m === 'POST') return superUserAction(env, request, 'update');
  if (p === '/api/superadmin/users/status' && m === 'POST') return superUserAction(env, request, 'status');
  if (p === '/api/superadmin/users/reset-password' && m === 'POST') return superUserAction(env, request, 'reset');
  if (p === '/api/superadmin/users/invalidate-sessions' && m === 'POST') return superUserAction(env, request, 'invalidate');
  if (p === '/api/superadmin/users/delete' && m === 'POST') return superUserAction(env, request, 'delete');
  if (p === '/api/superadmin/subscriptions' && m === 'GET') return superSubscriptions(env, request);
  if (p === '/api/superadmin/subscriptions/set-plan' && m === 'POST') return superSetPlan(env, request);
  if (p === '/api/superadmin/password-requests' && m === 'GET') return superPasswordRequests(env, request);
  if (p === '/api/superadmin/audit-logs' && m === 'GET') return superAuditLogs(env, request);
  return bad('Route API introuvable.', 404, 'NOT_FOUND');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!['/api/health','/api/ping'].includes(url.pathname)) await ensureRuntime(env);
        return securityHeaders(await routeApi(env, request, url));
      }
      const response = await env.ASSETS.fetch(request);
      return securityHeaders(response);
    } catch (e) {
      console.error('SIGAT runtime error', e);
      if (url.pathname.startsWith('/api/')) {
        if (e?.code === 'D1_BINDING_MISSING') return securityHeaders(bad('Liaison D1 SIGAT_DB absente dans Cloudflare.', 503, e.code));
        if (e?.code === 'KV_BINDING_MISSING') return securityHeaders(bad('Liaison KV SIGAT_KV absente dans Cloudflare.', 503, e.code));
        const msg = String(e?.message || '');
        if (e?.code === 'SUPERADMIN_SECRET_MISSING') return securityHeaders(bad('Les variables Super Admin ne sont pas correctement configurées dans Cloudflare.', 503, e.code));
        if (e?.code === 'SUPERADMIN_USERNAME_CONFLICT') return securityHeaders(bad('L’identifiant Super Admin configuré entre en conflit avec un compte existant.', 409, e.code));
        if (/no such table/i.test(msg)) return securityHeaders(bad('La base D1 SIGAT n’est pas initialisée. Cette version peut la réparer automatiquement via /api/health.', 503, 'DATABASE_NOT_INITIALIZED'));
        if (/no such column|has no column named/i.test(msg)) return securityHeaders(bad('Le schéma D1 est ancien ou incomplet. Ouvrez /api/health une fois puis réessayez.', 503, 'DATABASE_SCHEMA_OUTDATED'));
        if (/UNIQUE constraint failed/i.test(msg)) return securityHeaders(bad('Une donnée unique existe déjà dans D1. Vérifiez notamment l’identifiant ou l’e-mail Super Admin.', 409, 'DATABASE_UNIQUE_CONFLICT'));
        if (/incomplete input/i.test(msg)) return securityHeaders(bad('D1 a rejeté une instruction SQL incomplète. Déployez la version V1.7 puis ouvrez /api/health pour réparer le noyau.', 503, 'D1_INCOMPLETE_SQL'));
        console.error('SIGAT server details:', msg);
        return securityHeaders(bad('Erreur interne du serveur. Consultez /api/health pour le diagnostic.', 500, 'SERVER_ERROR'));
      }
      return securityHeaders(new Response('Erreur interne', { status: 500 }));
    }
  }
};
