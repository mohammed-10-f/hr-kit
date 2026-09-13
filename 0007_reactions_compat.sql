-- Compatibility migration for installations where resource_reactions was created without updated_at.
ALTER TABLE resource_reactions ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;
