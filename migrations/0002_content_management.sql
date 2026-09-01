ALTER TABLE categories ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resources ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

UPDATE categories SET is_visible=0 WHERE slug IN ('guides','regulations','recruitment','payroll','leaves','offboarding');
UPDATE categories SET name='ملفات', slug='files', icon='📁', sort_order=3 WHERE slug='excel';

CREATE INDEX IF NOT EXISTS idx_resources_featured ON resources(featured);
CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(is_visible);
