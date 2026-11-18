import { scoreKeys } from '../../core/history/score-rows.ts';
import type { ScoreTable } from '../../core/history/score-rows.ts';

const ancestry = `WITH RECURSIVE path(id, parent, owner, level) AS (
  SELECT id, parent, owner, 0 FROM score_commits WHERE id = ? AND owner = ?
  UNION ALL
  SELECT c.id, c.parent, c.owner, path.level + 1
  FROM path JOIN score_commits c ON c.id = path.parent AND c.owner = path.owner
)`;

export function revisionQuery(table: ScoreTable): string {
  if (table === 'score_header')
    return `${ancestry} SELECT t.* FROM path JOIN ${table} t ON t.revision = path.id ORDER BY path.level LIMIT 1`;

  const identity = scoreKeys[table].map((key) => `t.${key}`).join(', ');
  // SQLite selects the bare columns from the unique nearest row in each group.
  return `${ancestry} SELECT * FROM (
    SELECT t.*, min(path.level) AS nearest
    FROM path CROSS JOIN ${table} t ON t.revision = path.id
    GROUP BY ${identity}
  ) WHERE removed = 0`;
}
