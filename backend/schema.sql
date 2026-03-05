PRAGMA foreign_keys = ON;

-- =========================
-- Main table (matches your API)
-- =========================
CREATE TABLE IF NOT EXISTS pnp_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  client TEXT,
  project_name TEXT,
  pr_number TEXT,
  work_order_number TEXT,
  report_date TEXT,
  invoice_number TEXT,
  principal_engineer TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pnp_client ON pnp_table(client);
CREATE INDEX IF NOT EXISTS idx_pnp_pr ON pnp_table(pr_number);
CREATE INDEX IF NOT EXISTS idx_pnp_wo ON pnp_table(work_order_number);
CREATE INDEX IF NOT EXISTS idx_pnp_date ON pnp_table(date);

-- =========================
-- History table (who did it)
-- =========================
CREATE TABLE IF NOT EXISTS pnp_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  changed_fields_json TEXT,
  summary TEXT,

  user_email TEXT,
  user_name TEXT,
  user_oid TEXT,

  changed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pnp_history_project ON pnp_history(project_id);
CREATE INDEX IF NOT EXISTS idx_pnp_history_changed_at ON pnp_history(changed_at);

-- =========================
-- Undo/redo stack
-- =========================
CREATE TABLE IF NOT EXISTS pnp_undo_stack (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  changed_fields_json TEXT,
  summary TEXT,

  user_email TEXT,
  user_name TEXT,
  user_oid TEXT,

  changed_at TEXT,
  undone_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pnp_undo_undone_at ON pnp_undo_stack(undone_at);