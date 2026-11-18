ALTER TABLE score_tracks ADD COLUMN drum_kit TEXT CHECK (drum_kit IN ('standard', 'room', 'electronic'));
