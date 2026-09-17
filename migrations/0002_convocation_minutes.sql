CREATE TABLE IF NOT EXISTS convocation_minutes (
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
CREATE INDEX IF NOT EXISTS idx_convocation_minutes_org ON convocation_minutes(organization_id);
CREATE INDEX IF NOT EXISTS idx_convocation_minutes_date ON convocation_minutes(event_date);
