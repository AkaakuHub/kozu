import { describe, it, expect } from 'vite-plus/test';
import { scoreFixture } from './score-fixture.ts';
import { compile } from '../src/core/compile.ts';
import { exportMidi } from '../src/core/midi.ts';
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
