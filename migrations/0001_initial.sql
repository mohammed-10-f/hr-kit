CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📄',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  category_id INTEGER,
  file_key TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER DEFAULT 0,
  keywords TEXT DEFAULT '',
  version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'published',
  downloads INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_resources_title ON resources(title);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id);

INSERT OR IGNORE INTO categories (name, slug, icon, sort_order) VALUES
('النماذج', 'forms', '📄', 1),
('ملفات Excel', 'excel', '📊', 2),
('الخطابات', 'letters', '📝', 3),
('الأدلة والإجراءات', 'guides', '📚', 4),
('الأنظمة واللوائح', 'regulations', '⚖️', 5),
('التوظيف', 'recruitment', '👥', 6),
('الرواتب', 'payroll', '💰', 7),
('الإجازات', 'leaves', '🏖️', 8),
('إنهاء الخدمة', 'offboarding', '🚪', 9);
