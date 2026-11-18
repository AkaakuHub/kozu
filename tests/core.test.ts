import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankProject,
  createSection,
  createTrack,
  makeChords,
  generateMelody,
  PROGRESSIONS,
  DEFAULT_GUITAR,
} from '../src/core/presets.ts';
import { PPQ, clone } from '../src/core/types.ts';
import type { Chord, Note } from '../src/core/types.ts';
import {
  chordPitches,
  resolvePitch,
  CHORDS,
  transposeKey,
  degreePitch,
  inScale,
  SCALES,
} from '../src/core/theory.ts';
import { compile } from '../src/core/compile.ts';
import { exportMidi } from '../src/core/midi.ts';
import {
  addDrop,
  duplicateSection,
  insertJump,
  insertRestatement,
  modulate,
  removeSection,
} from '../src/core/editing.ts';
import {
  keyAt,
  timeline,
  ticksToSeconds,
  secondsToTicks,
  sectionStarts,
  valueAt,
} from '../src/core/time.ts';
import { parseProject, validate } from '../src/core/validate.ts';
import { guitarVoicing } from '../src/core/guitar.ts';
import { drawnNoteSpan } from '../src/core/roll-editing.ts';
import { growSection, measureTicks, minimumSectionLength } from '../src/core/section-length.ts';
import { scaleRegions } from '../src/core/scale-guide.ts';
import { parsePreferences } from '../src/core/preferences.ts';
import { scoreFixture } from './score-fixture.ts';
const key = { tonic: 0, mode: 'major', preferFlats: false } as const;
function simple() {
  const p = scoreFixture();
  p.sections = [createSection('サビ', PPQ * 16)];
  p.tempoChanges = [];
  p.keyChanges = [];
  p.meterChanges = [];
  p.effects = [];
  p.initialTempo = 120;
  p.tracks = p.tracks.filter((t) => t.kind !== 'guitar');
  return p;
}
const noErrors = (p: ReturnType<typeof simple>) =>
  assert.deepEqual(
    validate(p).filter((d) => d.severity === 'error'),
    [],
  );
await test('空の新規プロジェクトは編集可能な譜面として有効', () => noErrors(createBlankProject()));
await test('C major third is E, lowering by one semitone gives E-flat', () => {
  assert.equal(resolvePitch({ kind: 'degree', degree: 3, accidental: 0, octave: 4 }, key), 64);
  assert.equal(resolvePitch({ kind: 'degree', degree: 3, accidental: -1, octave: 4 }, key), 63);
});
await test('absolute MIDI pitches do not follow the key', () =>
  assert.equal(resolvePitch({ kind: 'absolute', midi: 60 }, transposeKey(key, 3)), 60));
await test('スケールガイドはパート開始時点のキーを引き継ぎ、転調の拍で切り替わる', () => {
  const dMajor = transposeKey(key, 2);
  const keys = [
    { tick: 0, key },
    { tick: PPQ * 3, key: dMajor },
  ];
  const regions = scaleRegions(keys, PPQ * 2, PPQ * 4);
  assert.deepEqual(
    regions.map(({ start, end }) => [start, end]),
    [
      [PPQ * 2, PPQ * 3],
      [PPQ * 3, PPQ * 4],
    ],
  );
  assert.deepEqual(
    regions.map((region) => inScale(66, region.key)),
    [false, true],
  );
  assert.equal(scaleRegions(keys, PPQ * 3, PPQ * 4)[0]?.key, dMajor);
});
await test('プロフィールはスケールガイドのオフを保存する', () => {
  assert.deepEqual(parsePreferences({ scaleGuide: false }), { scaleGuide: false });
  assert.throws(() => parsePreferences({ scaleGuide: 'false' }));
});
await test('描きながらノート長を変更でき、固定長ではセクション末尾に収まる', () => {
  const step = PPQ / 4;
  assert.deepEqual(drawnNoteSpan(PPQ, PPQ, step, 2 * PPQ), { at: PPQ, duration: step });
  assert.deepEqual(drawnNoteSpan(PPQ, 3 * PPQ, step, 2 * PPQ), { at: PPQ, duration: PPQ });
  assert.deepEqual(drawnNoteSpan(PPQ, PPQ / 2, step, 2 * PPQ), { at: PPQ / 2, duration: PPQ / 2 });
});
await test('自動のセクションは小節単位で伸び、手動の長さは保持する', () => {
  const project = createBlankProject();
  const section = project.sections[0]!;
  const measure = measureTicks(project.initialMeter);
  const before = section.length;
  section.notes[project.tracks[0]!.id] = [
    {
      id: 'extended',
      at: before,
      duration: PPQ,
      pitch: { kind: 'absolute', midi: 60 },
      velocity: 90,
      origin: 'manual',
      locked: true,
    },
  ];
  assert.equal(minimumSectionLength(project, section), before + PPQ);
  growSection(project, section, measure);
  assert.equal(section.length, before + measure);
  delete section.autoExtend;
  section.length = before;
  growSection(project, section, measure);
  assert.equal(section.length, before);
});
await test('all chord types produce positive durations and integer notes', () => {
  const c = makeChords(PROGRESSIONS[0]!, PPQ * 16)[0]!;
  for (const q of Object.keys(CHORDS) as Chord['quality'][]) {
    const tones = chordPitches({ ...c, quality: q }, key);
    assert(tones.length);
    assert(tones.every(Number.isInteger));
  }
});
await test('aug7 inversion produces the augmented-over-seventh voicing', () => {
  const c: Chord = {
    ...makeChords(PROGRESSIONS[0]!, PPQ * 16)[0]!,
    root: { kind: 'degree', degree: 1, accidental: 0, octave: 3 },
    quality: 'aug7',
    inversion: 3,
  };
  assert.deepEqual(chordPitches(c, key), [58, 60, 64, 68]);
});
await test('slash bass remains lowest', () => {
  const c = {
    ...makeChords(PROGRESSIONS[0]!, PPQ * 16)[0]!,
    bass: { kind: 'absolute', midi: 46 } as const,
  };
  assert.equal(chordPitches(c, key)[0]! % 12, 10);
});
await test('all progression durations exactly fill their section', () => {
  for (const preset of PROGRESSIONS) {
    const chords = makeChords(preset, PPQ * 17);
    assert.equal(
      chords.reduce((s, c) => s + c.duration, 0),
      PPQ * 17,
    );
  }
});
await test('tempo steps integrate in beat space', () =>
  assert.equal(
    ticksToSeconds(PPQ * 8, [
      { tick: 0, bpm: 120 },
      { tick: PPQ * 4, bpm: 60 },
    ]),
    6,
  ));
await test('time conversion roundtrips under ramps', () => {
  const p = simple();
  p.tempoChanges = [
    {
      id: 'ramp',
      at: { sectionId: p.sections[0]!.id, tick: 0 },
      bpm: 120,
      ramp: { duration: PPQ * 8, toBpm: 180 },
    },
  ];
  const map = timeline(p).tempos;
  assert(map.length > 100);
  for (const tick of [0, 15, 240, 960, 7000, 12000])
    assert(Math.abs(secondsToTicks(ticksToSeconds(tick, map), map) - tick) < 1e-7);
});
await test('new tempo event interrupts a previous ramp', () => {
  const p = simple(),
    id = p.sections[0]!.id;
  p.tempoChanges = [
    { id: 'a', at: { sectionId: id, tick: 0 }, bpm: 100, ramp: { duration: PPQ * 8, toBpm: 200 } },
    { id: 'b', at: { sectionId: id, tick: PPQ * 2 }, bpm: 80, ramp: null },
  ];
  assert.equal(valueAt(timeline(p).tempos, PPQ * 6).bpm, 80);
});
await test('移調は以降の音高を確定し、キーイベントを追加しない', () => {
  let p = simple();
  const s = p.sections[0]!,
    t = p.tracks.find((t) => t.kind === 'melody')!;
  s.notes[t.id] = [0, PPQ * 5].map((at, i) => ({
    id: `n${i}`,
    at,
    duration: PPQ,
    pitch: { kind: 'degree', degree: 1, accidental: 0, octave: 4 },
    velocity: 90,
    origin: 'manual',
    locked: true,
  }));
  p = modulate(p, { sectionId: s.id, tick: PPQ * 4 }, 2);
  assert.deepEqual(p.keyChanges, []);
  assert.equal(p.sections[0]!.notes[t.id]![0]!.id, 'n0');
  assert.deepEqual(p.sections[0]!.notes[t.id]![1]!.pitch, { kind: 'absolute', midi: 62 });
  assert.deepEqual(
    compile(p)
      .notes.filter((n) => n.trackId === t.id)
      .map((n) => n.pitch),
    [60, 62],
  );
});
await test('範囲を下へ移調すると持続音は境界で分かれる', () => {
  const p = simple();
  const s = p.sections[0]!;
  const t = p.tracks[0]!;
  s.notes[t.id] = [
    {
      id: 'note',
      at: 0,
      duration: 3 * PPQ,
      pitch: { kind: 'absolute', midi: 60 },
      velocity: 90,
      origin: 'manual',
      locked: true,
    },
  ];
  const next = modulate(p, { sectionId: s.id, tick: PPQ }, -1, PPQ);
  assert.deepEqual(next.keyChanges, []);
  assert.deepEqual(
    next.sections[0]!.notes[t.id]!.map((note) => [note.at, note.duration, note.pitch]),
    [
      [0, PPQ, { kind: 'absolute', midi: 60 }],
      [PPQ, PPQ, { kind: 'absolute', midi: 59 }],
      [2 * PPQ, PPQ, { kind: 'absolute', midi: 60 }],
    ],
  );
});
await test('single restatement does not force modulation', () => {
  const p = simple(),
    s = p.sections[0]!;
  const result = insertRestatement(p, s.id, 0, PPQ * 2, s.id);
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0]!.length, PPQ * 2);
  assert.equal(keyAt(result, { sectionId: s.id, tick: 0 }).tonic, 0);
  noErrors(result);
});
await test('restatement plus modulation is a composite operation', () => {
  const p = simple(),
    s = p.sections[0]!;
  const result = insertRestatement(p, s.id, 0, PPQ * 2, s.id, 2);
  assert.deepEqual(result.keyChanges, []);
  assert.equal(p.sections.length, 1);
});
await test('restatement clips held notes at both boundaries', () => {
  const p = simple(),
    s = p.sections[0]!,
    t = p.tracks[0]!;
  s.notes[t.id] = [
    {
      id: 'n',
      at: 0,
      duration: PPQ * 8,
      pitch: { kind: 'absolute', midi: 60 },
      velocity: 90,
      origin: 'manual',
      locked: true,
    },
  ];
  const r = insertRestatement(p, s.id, PPQ, PPQ * 2, s.id);
  assert.equal(r.sections[0]!.notes[t.id]![0]!.duration, PPQ * 2);
  assert.equal(r.sections[0]!.notes[t.id]![0]!.at, 0);
});
await test('restatement preserves a ramp slice and restores target tempo', () => {
  const p = simple(),
    s = p.sections[0]!;
  p.tempoChanges = [
    {
      id: 'r',
      at: { sectionId: s.id, tick: 0 },
      bpm: 100,
      ramp: { duration: PPQ * 8, toBpm: 180 },
    },
  ];
  const r = insertRestatement(p, s.id, PPQ * 2, PPQ * 2, s.id);
  assert.equal(valueAt(timeline(r).tempos, 0).bpm, 120);
  assert.equal(valueAt(timeline(r).tempos, PPQ * 2).bpm, 100);
});
await test('jump keeps lead while cutting accompaniment, including sustains', () => {
  const p = simple(),
    s = p.sections[0]!,
    lead = p.tracks[0]!;
  s.notes[lead.id] = [
    {
      id: 'lead',
      at: 0,
      duration: PPQ * 6,
      pitch: { kind: 'absolute', midi: 72 },
      velocity: 90,
      origin: 'manual',
      locked: true,
    },
  ];
  const r = insertJump(p, { sectionId: s.id, tick: PPQ }, PPQ, true),
    song = compile(r);
  assert.deepEqual(r.effects, []);
  assert.equal(r.sections[0]!.notes[lead.id]![0]!.id, 'lead');
  const notes = (rendered: typeof song) =>
    rendered.notes.map((n) => `${n.trackId}:${n.start}:${n.end}:${n.pitch}`).sort();
  assert.deepEqual(notes(compile(r, 'edit')), notes(song));
  assert(song.notes.some((n) => n.trackId === lead.id && n.start === 0 && n.end === PPQ * 6));
  assert(!song.notes.some((n) => n.trackId !== lead.id && n.start < PPQ * 2 && n.end > PPQ));
  assert(song.notes.some((n) => n.trackId !== lead.id && n.start === PPQ * 2));
});
await test('jump cannot insert accent beyond section', () => {
  const p = simple();
  assert.throws(() => insertJump(p, { sectionId: p.sections[0]!.id, tick: PPQ * 15 }, PPQ));
});
await test('drop-chorus is an arrangement mask, not a key or tempo change', () => {
  const p = simple(),
    s = p.sections[0]!;
  const r = addDrop(p, s.id);
  assert.deepEqual(r.keyChanges, p.keyChanges);
  assert.deepEqual(r.tempoChanges, p.tempoChanges);
  const song = compile(r),
    allowed = r.tracks.filter((t) => t.kind === 'melody' || t.kind === 'chords').map((t) => t.id);
  assert(song.notes.every((n) => allowed.includes(n.trackId)));
});
await test('half-time does not modify the tempo map', () => {
  const p = simple(),
    s = p.sections[0]!;
  p.effects.push({
    id: 'half',
    kind: 'groove',
    at: { sectionId: s.id, tick: 0 },
    duration: s.length,
    pattern: 'halftime',
  });
  const song = compile(p);
  assert.deepEqual(song.tempos, [{ tick: 0, bpm: 120 }]);
  assert.equal(song.notes.filter((n) => n.pitch === 38 && n.channel === 9).length, 4);
});
await test('D and arbitrary custom sections are valid', () => {
  const p = simple();
  p.sections.push(createSection('Dパート'), createSection('自由な展開 7', PPQ * 11));
  noErrors(p);
});
await test('meter changes are independent of tempo changes', () => {
  const p = simple();
  p.meterChanges.push({
    id: 'm',
    at: { sectionId: p.sections[0]!.id, tick: PPQ * 8 },
    numerator: 7,
    denominator: 8,
  });
  const song = compile(p);
  assert.equal(song.meters[1]!.numerator, 7);
  assert.equal(song.tempos.length, 1);
});
await test('section reorder moves anchored events with their section', () => {
  const p = scoreFixture(),
    id = p.keyChanges[0]!.at.sectionId;
  p.sections.reverse();
  const event = timeline(p).keys.find((k) => k.key.tonic === 2)!;
  assert.equal(event.tick, sectionStarts(p).get(id));
});
await test('section duplication is independent of source content', () => {
  const p = simple(),
    s = p.sections[0]!;
  const r = duplicateSection(p, s.id);
  r.sections[1]!.chords[0]!.quality = 'dim';
  assert.notEqual(r.sections[0]!.chords[0]!.quality, 'dim');
  noErrors(r);
});
await test('deleting sections removes dangling events', () => {
  const p = scoreFixture();
  const r = removeSection(p, p.sections.at(-1)!.id);
  noErrors(r);
  assert.equal(r.keyChanges.length, 0);
});
await test('cannot delete the final section', () => {
  const p = simple();
  assert.throws(() => removeSection(p, p.sections[0]!.id));
});
await test('manual and locked notes survive regeneration', () => {
  const s = createSection();
  const n: Note = {
    id: 'fixed',
    at: 0,
    duration: PPQ * 2,
    pitch: { kind: 'absolute', midi: 66 },
    velocity: 90,
    origin: 'manual',
    locked: true,
  };
  s.notes.test = [n];
  const notes = generateMelody(s, 'test', 6);
  assert.deepEqual(
    notes.find((n) => n.id === 'fixed'),
    n,
  );
  assert(notes.filter((n) => n.id !== 'fixed').every((n) => n.at >= PPQ * 2));
});
await test('generated melody is deterministic except IDs', () => {
  const s = createSection();
  const clean = (ns: Note[]) =>
    ns.map((n) => ({
      at: n.at,
      duration: n.duration,
      pitch: n.pitch,
      velocity: n.velocity,
      origin: n.origin,
      locked: n.locked,
    }));
  assert.deepEqual(clean(generateMelody(s, 'x', 3)), clean(generateMelody(s, 'x', 3)));
});
await test('out-of-scale notes produce warnings, not errors', () => {
  const p = simple();
  p.sections[0]!.notes[p.tracks[0]!.id] = [
    {
      id: 'chromatic',
      at: 0,
      duration: PPQ,
      pitch: { kind: 'degree', degree: 3, accidental: -1, octave: 4 },
      velocity: 90,
      origin: 'manual',
      locked: true,
    },
  ];
  noErrors(p);
  assert(validate(p).some((d) => d.code === 'non-diatonic'));
});
await test('invalid references fail safely', () => {
  const p = simple();
  p.keyChanges.push({ id: 'k', at: { sectionId: 'missing', tick: 0 }, key });
  assert(compile(p).diagnostics.some((d) => d.severity === 'error'));
  assert.equal(compile(p).notes.length, 0);
});
await test('overlapping chords are rejected', () => {
  const p = simple();
  p.sections[0]!.chords[0]!.duration = PPQ * 8;
  assert(validate(p).some((d) => d.code === 'chord-overlap'));
});
await test('invalid tempo cannot hang compiler', () => {
  const p = simple();
  p.initialTempo = 0;
  assert.equal(compile(p).notes.length, 0);
  assert.throws(() => parseProject(JSON.stringify(p)));
});
await test('untrusted JSON shape is validated before property access', () => {
  for (const bad of [
    'null',
    '{}',
    '[]',
    '{"schemaVersion":2}',
    '{"schemaVersion":2,"tracks":[null]}',
  ])
    assert.throws(() => parseProject(bad));
});
await test('project save/restore preserves complete score structure', () => {
  const p = scoreFixture();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
await test('fractional tick imports are rejected', () => {
  const p = simple();
  p.sections[0]!.length = 123.5;
  assert.throws(() => parseProject(JSON.stringify(p)));
});
await test('invalid guitar profile is rejected', () => {
  const p = scoreFixture();
  p.tracks[0]!.guitar.tuning = [];
  assert.throws(() => parseProject(JSON.stringify(p)));
});
await test('guitar voicing has at most one note per string and bounded frets', () => {
  const shape = guitarVoicing([48, 52, 55], DEFAULT_GUITAR)!;
  assert(shape);
  assert(shape.frets.length === 6);
  assert(shape.frets.every((f) => f === null || (f >= 0 && f <= 17)));
  const held = shape.frets.filter((f): f is number => f !== null && f > 0);
  assert(Math.max(...held) - Math.min(...held) <= 4);
});
await test('power-trigger export uses one note at each chord attack', () => {
  const p = simple();
  const guitar = createTrack('guitar');
  guitar.pattern = 'sustain';
  guitar.guitar.output = 'powerTrigger';
  p.tracks = [guitar];
  const song = compile(p);
  assert.equal(song.notes.length, 4);
  assert(new Set(song.notes.map((n) => n.start)).size === 4);
});
await test('power-notes output expands fifths without major/minor thirds', () => {
  const p = simple();
  const g = createTrack('guitar');
  g.guitar.output = 'powerNotes';
  g.pattern = 'sustain';
  g.guitar.strumMs = 0;
  p.tracks = [g];
  const notes = compile(p).notes.filter((n) => n.start === 0);
  assert.equal(notes.length, 3);
  assert.deepEqual(
    notes.map((n) => n.pitch - notes[0]!.pitch),
    [0, 7, 12],
  );
});
await test('drums use channel 10, pitched tracks skip it', () => {
  const p = simple();
  p.tracks = Array.from({ length: 12 }, () => createTrack('chords'));
  p.tracks.push(createTrack('drums'));
  const notes = compile(p).notes;
  assert(notes.filter((n) => n.channel === 9).every((n) => n.pitch < 50));
  assert(notes.some((n) => n.channel === 10));
});
await test('same MIDI pitch has no overlapping note intervals', () => {
  const p = simple(),
    t = p.tracks[0]!;
  p.sections[0]!.notes[t.id] = [0, PPQ].map((at, i) => ({
    id: String(i),
    at,
    duration: PPQ * 2,
    pitch: { kind: 'absolute', midi: 60 },
    velocity: 80,
    origin: 'manual',
    locked: false,
  }));
  const notes = compile(p).notes.filter((n) => n.trackId === t.id);
  assert.equal(notes[0]!.end, notes[1]!.start);
});
await test('empty explicit clip silences auto accompaniment', () => {
  const p = simple(),
    t = p.tracks.find((t) => t.kind === 'chords')!;
  p.sections[0]!.notes[t.id] = [];
  assert(!compile(p).notes.some((n) => n.trackId === t.id));
});
await test('MIDI has format 1, one conductor track plus all music tracks', () => {
  const p = simple(),
    m = exportMidi(p, compile(p));
  assert.equal(new TextDecoder().decode(m.slice(0, 4)), 'MThd');
  assert.equal(m[9], 1);
  assert.equal(m[11], p.tracks.length + 1);
  assert.equal(m[12]! * 256 + m[13]!, PPQ);
});
await test('MIDI contains tempo, key, meter, and section markers', () => {
  const p = simple(),
    m = exportMidi(p, compile(p));
  for (const type of [0x51, 0x58, 0x59, 0x06])
    assert(m.some((n, i) => n === 255 && m[i + 1] === type));
});
await test('MIDI refuses invalid projects', () => {
  const p = simple();
  p.initialTempo = -1;
  assert.throws(() => exportMidi(p, compile(p)));
});
await test('sustained chord is split and re-voiced at an intra-chord key change', () => {
  let p = simple();
  p.tracks = [createTrack('chords')];
  p.sections[0]!.chords = makeChords({ ...PROGRESSIONS[0]!, degrees: [[1, 'major']] }, PPQ * 16);
  p = modulate(p, { sectionId: p.sections[0]!.id, tick: PPQ * 2 }, 2);
  const ns = compile(p).notes;
  assert(ns.some((n) => n.end === PPQ * 2));
  assert(ns.some((n) => n.start === PPQ * 2));
  assert(ns.filter((n) => n.start === PPQ * 2).every((n) => [2, 6, 9].includes(n.pitch % 12)));
});
await test('groove/fill/octave effects survive roundtrip', () => {
  const p = simple(),
    at = { sectionId: p.sections[0]!.id, tick: 0 };
  p.effects.push(
    { id: 'a', kind: 'fill', at, duration: PPQ, subdivision: 4 },
    { id: 'b', kind: 'octave', at, duration: PPQ * 4, trackId: p.tracks[0]!.id, semitones: 12 },
  );
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
await test('cloning does not mutate the previous revision', () => {
  const p = simple(),
    c = clone(p);
  c.sections[0]!.name = 'changed';
  assert.notEqual(p.sections[0]!.name, c.sections[0]!.name);
});
await test('absolute-to-degree spelling preserves every tested MIDI pitch in every scale', () => {
  for (const mode of Object.keys(SCALES) as Array<keyof typeof SCALES>)
    for (let tonic = 0; tonic < 12; tonic++)
      for (let midi = 36; midi < 96; midi++) {
        const k = { tonic, mode, preferFlats: false };
        assert.equal(resolvePitch(degreePitch(midi, k), k), midi);
      }
});
await test('zero track gain creates no MIDI notes', () => {
  const p = simple();
  p.tracks.forEach((t) => (t.gain = 0));
  assert.equal(compile(p).notes.length, 0);
});
await test('zero thin gain creates true silence in its interval', () => {
  const p = simple(),
    s = p.sections[0]!;
  p.effects.push({
    id: 'thin0',
    kind: 'thin',
    at: { sectionId: s.id, tick: 0 },
    duration: s.length,
    keepTracks: p.tracks.map((t) => t.id),
    gain: 0,
  });
  assert.equal(compile(p).notes.length, 0);
});
await test('言い直しは作成済みの跳びポを音符と休符として複製する', () => {
  let p = simple(),
    s = p.sections[0]!;
  p = insertJump(p, { sectionId: s.id, tick: PPQ }, PPQ, false);
  const r = insertRestatement(p, s.id, 0, PPQ * 4, s.id);
  assert.deepEqual(r.effects, []);
  const notes = Object.values(r.sections[0]!.notes).flat();
  assert(notes.some((n) => n.at === PPQ * 2));
  assert(notes.every((n) => n.at + n.duration <= PPQ || n.at >= PPQ * 2));
  noErrors(r);
});
await test('tempo ramp cannot extend beyond the song', () => {
  const p = simple();
  p.tempoChanges = [
    {
      id: 'bad-ramp',
      at: { sectionId: p.sections[0]!.id, tick: PPQ * 15 },
      bpm: 120,
      ramp: { duration: PPQ * 8, toBpm: 180 },
    },
  ];
  assert(validate(p).some((d) => d.code === 'tempo-end'));
});
await test('string meter denominators are rejected in untrusted data', () => {
  const p = JSON.parse(JSON.stringify(simple()));
  p.initialMeter.denominator = '4';
  assert.throws(() => parseProject(JSON.stringify(p)));
});
await test('duplicate event identifiers are rejected', () => {
  const p = simple();
  p.keyChanges = [0, PPQ].map((tick) => ({
    id: 'duplicate',
    at: { sectionId: p.sections[0]!.id, tick },
    key,
  }));
  assert(validate(p).some((d) => d.code === 'duplicate-event'));
});
await test('duplicate note identifiers are rejected', () => {
  const p = simple(),
    s = p.sections[0]!,
    id = p.tracks[0]!.id;
  s.notes[id] = generateMelody(s, id, 1);
  s.notes[id]![1]!.id = s.notes[id]![0]!.id;
  assert(validate(p).some((d) => d.code === 'duplicate-note'));
});
await test('dangling source section references are rejected', () => {
  const p = simple();
  p.sections[0]!.sourceSectionId = 'missing';
  assert(validate(p).some((d) => d.code === 'source-section'));
});
await test('harmony-aware melody changes when the harmony changes', () => {
  const s = createSection();
  const a = generateMelody(s, 'x', 5).map((n) => n.pitch);
  s.chords.forEach((c) => (c.quality = 'aug'));
  const b = generateMelody(s, 'x', 5).map((n) => n.pitch);
  assert.notDeepEqual(a, b);
});
await test('melody generator uses the supplied intra-section key context', () => {
  const s = createSection(),
    k = { tonic: 2, mode: 'minor', preferFlats: false } as const;
  const notes = generateMelody(s, 'x', 11, () => k);
  assert(notes.every((n) => resolvePitch(n.pitch, k) >= 59 && resolvePitch(n.pitch, k) <= 83));
});
await test('accents preserve track gain ordering', () => {
  const p = simple();
  const t = p.tracks.find((t) => t.kind === 'chords')!;
  t.gain = 0.1;
  const r = insertJump(p, { sectionId: p.sections[0]!.id, tick: PPQ }, PPQ, false);
  assert(
    compile(r)
      .notes.filter((n) => n.trackId === t.id && n.start === PPQ * 2)
      .every((n) => n.velocity <= 13),
  );
});
await test('100 composed transformation sequences remain valid and bounded', () => {
  for (let i = 0; i < 100; i++) {
    let p = simple(),
      id = p.sections[0]!.id;
    p.initialKey = { tonic: i % 12, mode: i % 2 ? 'major' : 'minor', preferFlats: false };
    p = modulate(p, { sectionId: id, tick: PPQ * 8 }, (i % 7) - 3);
    p = insertJump(p, { sectionId: id, tick: PPQ * 4 }, PPQ / 2, i % 2 === 0);
    p = insertRestatement(p, id, 0, PPQ * 2, id, i % 3 ? null : 1);
    p = duplicateSection(p, id);
    p = addDrop(p, p.sections.at(-1)!.id);
    noErrors(p);
    const song = compile(p);
    assert(!song.diagnostics.some((d) => d.severity === 'error'));
    assert(
      song.notes.every(
        (n) =>
          n.start >= 0 &&
          n.end <= song.totalTicks &&
          n.end > n.start &&
          n.pitch >= 0 &&
          n.pitch <= 127,
      ),
    );
    assert(exportMidi(p, song).length > 100);
  }
});
await test('double time doubles snare attacks without changing BPM', () => {
  const p = simple(),
    s = p.sections[0]!;
  const base = compile(p).notes.filter((n) => n.channel === 9 && n.pitch === 38).length;
  p.effects.push({
    id: 'double',
    kind: 'groove',
    at: { sectionId: s.id, tick: 0 },
    duration: s.length,
    pattern: 'doubletime',
  });
  const song = compile(p);
  assert.equal(song.notes.filter((n) => n.channel === 9 && n.pitch === 38).length, base * 2);
  assert.deepEqual(song.tempos, [{ tick: 0, bpm: 120 }]);
});
await test('explicit chord inversion survives voice leading after another chord', () => {
  const p = simple(),
    t = createTrack('chords');
  p.tracks = [t];
  const s = p.sections[0]!;
  s.chords = makeChords(
    {
      ...PROGRESSIONS[0]!,
      degrees: [
        [1, 'major'],
        [1, 'aug7'],
      ],
    },
    s.length,
  );
  s.chords[1]!.inversion = 3;
  const ns = compile(p).notes.filter((n) => n.trackId === t.id && n.start === PPQ * 8);
  assert.equal(Math.min(...ns.map((n) => n.pitch)) % 12, 10);
});

void test('自動伴奏の編集用ノートはミュートと音量に左右されない', () => {
  const project = scoreFixture();
  const track = project.tracks.find((item) => item.kind === 'drums')!;
  const source = compile(project, 'edit').notes.filter((note) => note.trackId === track.id);
  track.mute = true;
  track.gain = 0;
  assert.ok(source.length > 0);
  assert.deepEqual(
    compile(project, 'edit').notes.filter((note) => note.trackId === track.id),
    source,
  );
  assert.ok(compile(project).notes.every((note) => note.trackId !== track.id));
});

void test('SMF書き出しを読み戻すと音符、テンポ、拍子が復元される', async () => {
  const { importMidi } = await import('../src/core/midi-import.ts');
  const source = scoreFixture();
  const expected = compile(source);
  const imported = importMidi(exportMidi(source, expected), '譜面');
  assert.deepEqual(
    imported.tracks.map((track) => track.name),
    source.tracks.map((track) => track.name),
  );
  const result = compile(imported);
  const signature = ({
    pitch,
    start,
    end,
    velocity,
  }: {
    pitch: number;
    start: number;
    end: number;
    velocity: number;
  }) => [start, pitch, end, velocity].join(',');
  assert.deepEqual(result.notes.map(signature).sort(), expected.notes.map(signature).sort());
  assert.deepEqual(result.meters, expected.meters);
  assert.deepEqual(
    result.tempos.map((point) => point.tick),
    expected.tempos.map((point) => point.tick),
  );
});

void test('3/4拍子では各小節の頭にキックが戻る', () => {
  const project = scoreFixture();
  project.initialMeter = { numerator: 3, denominator: 4 };
  project.effects = [];
  const drums = project.tracks.find((track) => track.kind === 'drums')!;
  const kicks = compile(project).notes.filter(
    (note) => note.trackId === drums.id && note.pitch === 36,
  );
  assert.ok(kicks.some((note) => note.start === 3 * PPQ));
  assert.ok(!kicks.some((note) => note.start === 4 * PPQ));
});

void test('トラップと2ステップを指定すると異なるハイハットが鳴る', () => {
  const project = scoreFixture();
  const drums = project.tracks.find((track) => track.kind === 'drums')!;
  drums.pattern = 'trap';
  const trap = compile(project).notes.filter(
    (note) => note.trackId === drums.id && note.start < 4 * PPQ,
  );
  assert.ok(trap.some((note) => note.pitch === 42 && note.start === PPQ * 3.625));
  drums.pattern = 'twoStep';
  const twoStep = compile(project).notes.filter(
    (note) => note.trackId === drums.id && note.start < 4 * PPQ,
  );
  assert.ok(twoStep.some((note) => note.pitch === 46 && note.start === PPQ / 2));
  assert.ok(!twoStep.some((note) => note.pitch === 42 && note.start === PPQ * 3.625));
});

void test('型付き履歴から譜面を復元しても楽器・テンポ・音符が再現される', async () => {
  const { projectRows, rowsProject } = await import('../src/core/history/score-rows.ts');
  const project = scoreFixture();
  project.tracks[0]!.program = 127;
  const rebuilt = rowsProject(projectRows(project));
  const musical = (score: typeof project) =>
    compile(score).notes.map(({ trackId, start, end, pitch, velocity }) => ({
      trackId,
      start,
      end,
      pitch,
      velocity,
    }));
  assert.deepEqual(rebuilt.tracks, project.tracks);
  assert.deepEqual(rebuilt.tempoChanges, project.tempoChanges);
  assert.deepEqual(musical(rebuilt), musical(project));
});

await test('16本を超えるトラックもMIDIに書き出せて同音が干渉しない', async () => {
  const { importMidi } = await import('../src/core/midi-import.ts');
  const { parseMidi } = await import('midi-file');
  const project = simple();
  const section = project.sections[0]!;
  project.tracks = Array.from({ length: 19 }, (_, index) =>
    createTrack(index >= 17 ? 'drums' : 'melody', `Track ${index + 1}`),
  );
  for (const track of project.tracks) {
    section.notes[track.id] = [
      {
        id: `note-${track.id}`,
        at: 0,
        duration: PPQ,
        pitch: { kind: 'absolute', midi: track.kind === 'drums' ? 38 : 60 },
        velocity: 90,
        origin: 'manual',
        locked: true,
      },
    ];
  }
  project.tracks[16]!.program = 127;
  const song = compile(parseProject(JSON.stringify(project)));
  assert.equal(song.notes.length, 19);
  assert(song.notes.every((note) => note.end === PPQ && note.channel >= 0 && note.channel <= 15));
  const data = exportMidi(project, song);
  const midi = parseMidi(data);
  assert.equal(midi.header.numTracks, 20);
  assert.equal(midi.tracks[16]?.find((event) => event.type === 'portPrefix')?.port, 1);
  assert.equal(midi.tracks[19]?.find((event) => event.type === 'portPrefix')?.port, 1);
  const imported = importMidi(data, 'Track test');
  assert.equal(imported.tracks.length, 19);
  assert.equal(imported.tracks[16]!.program, 127);
});

void test('強さを1個変更したコミットにはその音符だけを保存する', async () => {
  const { projectRows } = await import('../src/core/history/score-rows.ts');
  const { delta } = await import('../src/core/history/revisions.ts');
  const project = scoreFixture();
  const first = projectRows(project);
  const note = project.sections[0]!.notes[project.tracks[0]!.id]![0]!;
  note.velocity = 111;
  const changed = delta('score_notes', first.score_notes, projectRows(project).score_notes);
  assert.deepEqual(
    changed.map((row) => [row.id, row.velocity, row.removed]),
    [[note.id, 111, 0]],
  );
});

void test('三者マージは独立した音符編集を両方保存し、同じ音符の競合を報告する', async () => {
  const { projectRows, rowsProject } = await import('../src/core/history/score-rows.ts');
  const { mergeRows } = await import('../src/core/history/revisions.ts');
  const project = scoreFixture();
  const incoming = clone(project);
  const destination = clone(project);
  const first = incoming.sections[0]!.notes[project.tracks[0]!.id]![0]!;
  const second = destination.sections[0]!.notes[project.tracks[0]!.id]![1]!;
  first.velocity = 125;
  second.velocity = 126;
  const base = projectRows(project);
  const result = mergeRows(base, projectRows(incoming), projectRows(destination));
  const notes = rowsProject(result.rows).sections[0]!.notes[project.tracks[0]!.id]!;
  assert.deepEqual(result.conflicts, []);
  assert.equal(notes.find((note) => note.id === first.id)?.velocity, 125);
  assert.equal(notes.find((note) => note.id === second.id)?.velocity, 126);
  destination.sections[0]!.notes[project.tracks[0]!.id]![0]!.velocity = 127;
  assert.equal(
    mergeRows(base, projectRows(incoming), projectRows(destination)).conflicts.length,
    1,
  );
});

void test('和声技法は対象区間を保持し、次の和音の属七を選べる', async () => {
  const { changeHarmony } = await import('../src/core/harmony-techniques.ts');
  const project = scoreFixture();
  const section = project.sections[0]!;
  const first = section.chords[0]!;
  const next = section.chords[1]!;
  const context = (tick: number) => keyAt(project, { sectionId: section.id, tick });
  const patch = changeHarmony(section.chords, first.id, 'secondary', context)!;
  assert.equal(patch.quality, '7');
  assert.equal(
    resolvePitch(patch.root!, context(first.at)) % 12,
    (resolvePitch(next.root, context(next.at)) + 7) % 12,
  );
  assert.equal(patch.at, undefined);
  assert.equal(patch.duration, undefined);
});

void test('ハモリは調に沿って3度上または6度下を割り当てる', async () => {
  const { harmonize } = await import('../src/core/harmonize.ts');
  const key = { tonic: 0, mode: 'major', preferFlats: false } as const;
  const melody: Note[] = [
    {
      id: 'lead',
      at: 0,
      duration: PPQ,
      pitch: { kind: 'absolute', midi: 60 },
      velocity: 100,
      origin: 'manual',
      locked: true,
    },
  ];
  const third = harmonize(melody, 3, false, () => key)[0]!;
  const sixth = harmonize(melody, 6, true, () => key)[0]!;
  assert.equal(resolvePitch(third.pitch, key), 64);
  assert.equal(resolvePitch(sixth.pitch, key), 52);
  assert.equal(third.duration, melody[0]!.duration);
  assert.notEqual(third.id, melody[0]!.id);
});

void test('動機の反行・拡大は範囲外の音符を保持し変更を取り消し可能にする', async () => {
  const { transformMotif } = await import('../src/core/motif.ts');
  const key = { tonic: 0, mode: 'major', preferFlats: false } as const;
  const notes = [60, 64, 67].map((midi, index): Note => ({
    id: String(index),
    pitch: { kind: 'absolute', midi },
    at: index * PPQ,
    duration: PPQ / 2,
    velocity: 90,
    origin: 'manual',
    locked: true,
  }));
  const inverted = transformMotif(notes, 0, 2 * PPQ, 8 * PPQ, 'invert', () => key);
  assert.deepEqual(
    inverted.map((note) => resolvePitch(note.pitch, key)),
    [60, 56, 67],
  );
  const doubled = transformMotif(notes, 0, 2 * PPQ, 8 * PPQ, 'double', () => key);
  assert.equal(doubled[1]!.at, 2 * PPQ);
  assert.equal(doubled[1]!.duration, PPQ);
  assert.equal(doubled[2], notes[2]);
  assert.throws(() => transformMotif(notes, 0, 3 * PPQ, 3 * PPQ, 'double', () => key));
});

void test('音声クロックはテンポ変化の境界でMIDIタイムラインと一致する', async () => {
  const { audioTempoClock, playbackSeconds } = await import('../src/audio/clock.ts');
  const tempos = [
    { tick: 0, bpm: 90 },
    { tick: PPQ, bpm: 132 },
    { tick: PPQ * 2 + 30, bpm: 47.25 },
  ];
  const clock = audioTempoClock(tempos);
  for (const tick of [0, 95, PPQ, PPQ + 1, PPQ * 2 + 30, PPQ * 6, PPQ * 20]) {
    assert.ok(Math.abs(clock.secondsAt(tick) - ticksToSeconds(tick, tempos)) < 1e-9);
    assert.ok(Math.abs(clock.tickAt(clock.secondsAt(tick)) - tick) < 1e-8);
  }
  assert.equal(playbackSeconds(-0.05, 4, 6, 1), 4);
  assert.equal(playbackSeconds(1.5, 4, 6, 1), 5.5);
  assert.equal(playbackSeconds(2, 4, 6, 1), 1);
  assert.equal(playbackSeconds(7.25, 4, 6, 1), 1.25);
  assert.equal(playbackSeconds(2.5, 4, 6, null), 6);
});

void test('クリップ削除と同じクリップへの音符追加は音符を失うマージとして拒否する', async () => {
  const { projectRows, rowsProject } = await import('../src/core/history/score-rows.ts');
  const { mergeRows } = await import('../src/core/history/revisions.ts');
  const project = scoreFixture();
  const source = clone(project);
  const target = clone(project);
  const track = project.tracks[0]!;
  delete source.sections[0]!.notes[track.id];
  const notes = target.sections[0]!.notes[track.id]!;
  notes.push({ ...notes[0]!, id: 'merged-new-note', at: PPQ * 2 });
  const merged = mergeRows(projectRows(project), projectRows(source), projectRows(target));
  assert.throws(() => rowsProject(merged.rows));
});
