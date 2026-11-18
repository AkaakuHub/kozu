import type { ScoreRow, ScoreTable } from '../../core/history/score-rows.ts';

function batches(table: ScoreTable, rows: ScoreRow[]) {
  if (!rows.length) return [];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const query = `INSERT INTO ${table} (revision, ${columns.join(', ')})
    SELECT ?, ${columns.map((column) => `json_extract(value, '$.${column}')`).join(', ')}
    FROM json_each(?) WHERE EXISTS (SELECT 1 FROM score_commits WHERE id = ?)`;
  // D1 limits each bound string to 2,000,000 bytes. Leave space for the JSON array delimiters.
  const chunks: string[][] = [[]];
  const encoder = new TextEncoder();
  let used = 2;
  for (const row of rows) {
    const item = JSON.stringify(row);
    const size = encoder.encode(item).byteLength + 1;
    if (used + size > 2_000_000) {
      chunks.push([]);
      used = 2;
    }
    chunks.at(-1)!.push(item);
    used += size;
  }
  return chunks.map((chunk) => ({ query, payload: `[${chunk.join(',')}]` }));
}

export function revisionWrites(table: ScoreTable, rows: ScoreRow[]) {
  // Tombstones contain only identity columns and rely on the schema defaults.
  return [
    ...batches(
      table,
      rows.filter((row) => row.removed !== 1),
    ),
    ...batches(
      table,
      rows.filter((row) => row.removed === 1),
    ),
  ];
}
