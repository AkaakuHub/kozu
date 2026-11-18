import { describe, it, expect } from 'vite-plus/test';
import { scoreFixture } from './score-fixture.ts';
import { compile } from '../src/core/compile.ts';
import { exportMidi } from '../src/core/midi.ts';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { delta } from '../src/core/history/revisions.ts';
import { projectRows } from '../src/core/history/score-rows.ts';
import { createSection } from '../src/core/presets.ts';
import { revisionWrites } from '../src/worker/history/revision-writes.ts';
import { revisionQuery } from '../src/worker/history/revision-query.ts';
describe('full song', () => {
  it('compiles and exports a score', () => {
    const project = scoreFixture(),
      song = compile(project);
    expect(song.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(
      song.notes.some(
        (note) => note.trackId === project.tracks[0]?.id && note.pitch === 60 && note.start === 0,
      ),
    ).toBe(true);
    expect(exportMidi(project, song).length).toBeGreaterThan(100);
  });
});

it('同じコミットでセクションを削除と追加できる', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    for (const path of ['0003_score_history.sql', '0005_section_length_mode.sql'])
      database.exec(await readFile(new URL(`../migrations/${path}`, import.meta.url), 'utf8'));
    database.exec(
      `INSERT INTO score_commits VALUES ('a', 'own', NULL, NULL, '先頭', 1), ('b', 'own', 'a', NULL, '更新', 2)`,
    );
    const score = scoreFixture();
    const before = projectRows(score).score_sections;
    const first = score.sections[0]!;
    const next = createSection('追加', first.length, null);
    next.autoExtend = true;
    score.sections.splice(0, 1, next);
    const after = projectRows(score).score_sections;
    for (const { query, payload } of revisionWrites(
      'score_sections',
      delta('score_sections', [], before),
    ))
      database.prepare(query).run('a', payload, 'a');
    for (const { query, payload } of revisionWrites(
      'score_sections',
      delta('score_sections', before, after),
    ))
      database.prepare(query).run('b', payload, 'b');
    const visible = database.prepare(revisionQuery('score_sections')).all('b', 'own');
    expect(visible.some((section) => section.id === first.id)).toBe(false);
    expect(visible.find((section) => section.id === next.id)?.auto_extend).toBe(1);
  } finally {
    database.close();
  }
});
