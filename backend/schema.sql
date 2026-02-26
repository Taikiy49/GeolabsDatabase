CREATE TABLE IF NOT EXISTS pnp (
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
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pnp_client ON pnp(client);
CREATE INDEX IF NOT EXISTS idx_pnp_pr ON pnp(pr_number);
CREATE INDEX IF NOT EXISTS idx_pnp_wo ON pnp(work_order_number);
CREATE INDEX IF NOT EXISTS idx_pnp_date ON pnp(date);
