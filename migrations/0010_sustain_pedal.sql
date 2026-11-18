ALTER TABLE score_events ADD COLUMN pedal_value INTEGER CHECK (pedal_value BETWEEN 0 AND 127);
