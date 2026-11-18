CREATE TABLE preferences (
  subject TEXT PRIMARY KEY,
  settings TEXT NOT NULL CHECK (json_valid(settings))
);
