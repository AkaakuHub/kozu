CREATE TABLE score_references (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  revision TEXT NOT NULL REFERENCES score_commits(id),
  section_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  artist TEXT NOT NULL,
  source TEXT NOT NULL,
  note TEXT NOT NULL,
  PRIMARY KEY (owner, id),
  UNIQUE (owner, revision, section_id)
) STRICT, WITHOUT ROWID;
