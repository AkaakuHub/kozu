CREATE TABLE score_projects (
  subject TEXT NOT NULL,
  id TEXT NOT NULL,
  owner TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (subject, id)
) STRICT, WITHOUT ROWID;

INSERT INTO score_projects (subject, id, owner, title, created_at)
WITH RECURSIVE lineage (owner, revision, depth) AS (
  SELECT owner, head, 0 FROM score_branches WHERE name = 'main' AND head IS NOT NULL
  UNION ALL
  SELECT l.owner, c.parent, l.depth + 1 FROM lineage l
  JOIN score_commits c ON c.id = l.revision AND c.owner = l.owner WHERE c.parent IS NOT NULL
)
SELECT c.owner, 'initial', c.owner, COALESCE(NULLIF((
  SELECT h.title FROM lineage l JOIN score_header h ON h.revision = l.revision
  WHERE l.owner = c.owner ORDER BY l.depth LIMIT 1
), ''), '譜面'), MIN(c.created_at)
FROM score_commits c GROUP BY c.owner;
