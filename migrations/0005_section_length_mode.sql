ALTER TABLE score_sections ADD COLUMN auto_extend INTEGER NOT NULL DEFAULT 0 CHECK (auto_extend IN (0, 1));
