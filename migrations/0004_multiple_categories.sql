CREATE TABLE IF NOT EXISTS resource_categories (
  resource_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (resource_id, category_id),
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_categories_resource ON resource_categories(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_categories_category ON resource_categories(category_id);

INSERT OR IGNORE INTO resource_categories(resource_id, category_id)
SELECT id, category_id FROM resources WHERE category_id IS NOT NULL;
