ALTER TABLE resources ADD COLUMN views INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS resource_ratings (resource_id INTEGER NOT NULL, visitor_hash TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(resource_id,visitor_hash), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_resource_ratings_resource ON resource_ratings(resource_id);
