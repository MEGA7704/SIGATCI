-- V1.50 — Procès-verbaux liés aux affaires de répression des infractions
CREATE TABLE IF NOT EXISTS offense_minutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  reference TEXT,
  title TEXT NOT NULL,
  event_date TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  data_json TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_offense_minutes_org ON offense_minutes(organization_id);
CREATE INDEX IF NOT EXISTS idx_offense_minutes_event_date ON offense_minutes(event_date);
