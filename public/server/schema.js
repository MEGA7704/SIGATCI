export const MIGRATION_SQL = `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('PEF','CANTONNEMENT','DIRECTION_REGIONALE')),
  service_type TEXT, -- type canonique; permet DIRECTION_DEPARTEMENTALE tout en restant compatible avec les anciennes bases
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  department TEXT,
  locality TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);

CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
INSERT OR IGNORE INTO roles(code,label) VALUES
 ('SUPER_ADMIN','Super Admin'),
 ('ORGANIZATION_ADMIN','Administrateur de structure'),
 ('MEMBER','Membre'),
 ('READ_ONLY','Consultation');

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  phone TEXT,
  role_code TEXT NOT NULL REFERENCES roles(code),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED','SUSPENDED','ARCHIVED')),
  force_password_change INTEGER NOT NULL DEFAULT 0,
  session_version INTEGER NOT NULL DEFAULT 1,
  permissions_configured INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_code);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_code)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('FREE','STANDARD','BUSINESS')),
  price INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('TRIAL','ACTIVE','EXPIRED','SUSPENDED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end ON subscriptions(end_date);

CREATE TABLE IF NOT EXISTS subscription_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  old_plan TEXT,
  new_plan TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  price INTEGER NOT NULL,
  mode_activation TEXT,
  activated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username_or_email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('ADMINISTRATOR','USER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','REJECTED','EXPIRED')),
  handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  handled_at TEXT,
  notes TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reset_requests_status ON password_reset_requests(status);

CREATE TABLE IF NOT EXISTS audit_logs (
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
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, setting_key)
);

-- Tables métier homogènes pour les modules SIGAT.
-- data_json permet de conserver les champs propres à chaque module sans charger tout le système.

CREATE TABLE IF NOT EXISTS agents (
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
);
CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_date ON agents(event_date);

CREATE TABLE IF NOT EXISTS administrative_documents (
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
);
CREATE INDEX IF NOT EXISTS idx_administrative_documents_org ON administrative_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_administrative_documents_date ON administrative_documents(event_date);

CREATE TABLE IF NOT EXISTS absences (
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
);
CREATE INDEX IF NOT EXISTS idx_absences_org ON absences(organization_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(event_date);

CREATE TABLE IF NOT EXISTS internships (
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
);
CREATE INDEX IF NOT EXISTS idx_internships_org ON internships(organization_id);
CREATE INDEX IF NOT EXISTS idx_internships_date ON internships(event_date);

CREATE TABLE IF NOT EXISTS convocations (
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
);
CREATE INDEX IF NOT EXISTS idx_convocations_org ON convocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_convocations_date ON convocations(event_date);

CREATE TABLE IF NOT EXISTS missions (
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
);
CREATE INDEX IF NOT EXISTS idx_missions_org ON missions(organization_id);
CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(event_date);




CREATE TABLE IF NOT EXISTS forest_perimeters (
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
);
CREATE INDEX IF NOT EXISTS idx_forest_perimeters_org ON forest_perimeters(organization_id);
CREATE INDEX IF NOT EXISTS idx_forest_perimeters_date ON forest_perimeters(event_date);

CREATE TABLE IF NOT EXISTS secondary_operators (
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
);
CREATE INDEX IF NOT EXISTS idx_secondary_operators_org ON secondary_operators(organization_id);
CREATE INDEX IF NOT EXISTS idx_secondary_operators_date ON secondary_operators(event_date);

CREATE TABLE IF NOT EXISTS wood_processing_units (
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
);
CREATE INDEX IF NOT EXISTS idx_wood_processing_units_org ON wood_processing_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_wood_processing_units_date ON wood_processing_units(event_date);

CREATE TABLE IF NOT EXISTS awareness_actions (
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
);
CREATE INDEX IF NOT EXISTS idx_awareness_actions_org ON awareness_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_awareness_actions_date ON awareness_actions(event_date);


CREATE TABLE IF NOT EXISTS natural_resources (
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
);
CREATE INDEX IF NOT EXISTS idx_natural_resources_org ON natural_resources(organization_id);
CREATE INDEX IF NOT EXISTS idx_natural_resources_date ON natural_resources(event_date);

CREATE TABLE IF NOT EXISTS fire_incidents (
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
);
CREATE INDEX IF NOT EXISTS idx_fire_incidents_org ON fire_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_fire_incidents_date ON fire_incidents(event_date);

CREATE TABLE IF NOT EXISTS wildlife_observations (
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
);
CREATE INDEX IF NOT EXISTS idx_wildlife_observations_org ON wildlife_observations(organization_id);
CREATE INDEX IF NOT EXISTS idx_wildlife_observations_date ON wildlife_observations(event_date);

CREATE TABLE IF NOT EXISTS human_wildlife_conflicts (
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
);
CREATE INDEX IF NOT EXISTS idx_human_wildlife_conflicts_org ON human_wildlife_conflicts(organization_id);
CREATE INDEX IF NOT EXISTS idx_human_wildlife_conflicts_date ON human_wildlife_conflicts(event_date);

CREATE TABLE IF NOT EXISTS training_sessions (
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
);
CREATE INDEX IF NOT EXISTS idx_training_sessions_org ON training_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(event_date);

CREATE TABLE IF NOT EXISTS equipment (
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
);
CREATE INDEX IF NOT EXISTS idx_equipment_org ON equipment(organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_date ON equipment(event_date);


CREATE TABLE IF NOT EXISTS reports (
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
);
CREATE INDEX IF NOT EXISTS idx_reports_org ON reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(event_date);



CREATE TABLE IF NOT EXISTS offense_minutes (
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
);
CREATE INDEX IF NOT EXISTS idx_offense_minutes_org ON offense_minutes(organization_id);
CREATE INDEX IF NOT EXISTS idx_offense_minutes_date ON offense_minutes(event_date);
`;
