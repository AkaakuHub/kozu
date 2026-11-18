import { createBlankProject, createSection, createTrack } from '../src/core/presets.ts';
import { PPQ, uid } from '../src/core/types.ts';
import type { Note } from '../src/core/types.ts';

export function scoreFixture() {
  const score = createBlankProject();
  const first = createSection('検証区間', 8 * PPQ);
  const second = createSection('変更区間', 4 * PPQ);
  const lead = score.tracks[0]!;
  first.notes[lead.id] = [60, 67].map((midi, index): Note => ({
    id: uid('test-note'),
    at: index * PPQ,
    duration: PPQ / 2,
    pitch: { kind: 'absolute', midi },
    velocity: 89,
    origin: 'manual',
    locked: true,
  }));
  score.sections = [first, second];
  score.tracks.push(createTrack('chords'), createTrack('bass'), createTrack('drums'));
  score.keyChanges.push({
    id: uid('test-key'),
    at: { sectionId: second.id, tick: 0 },
    key: { tonic: 2, mode: 'major', preferFlats: false },
  });
  score.tempoChanges.push({
    id: uid('test-tempo'),
    at: { sectionId: second.id, tick: PPQ },
    bpm: 95,
    ramp: null,
  });
  score.meterChanges.push({
    id: uid('test-meter'),
    at: { sectionId: second.id, tick: 0 },
    numerator: 3,
    denominator: 4,
  });
  return score;
}
