import type { Pitch, Project } from '../types.ts';
import { parseProjectValue } from '../validate.ts';

type Scalar = string | number | null;
export type ScoreRow = Record<string, Scalar>;
export const scoreKeys = {
  score_header: [],
  score_tracks: ['id'],
  score_sections: ['id'],
  score_clips: ['section_id', 'track_id'],
  score_notes: ['section_id', 'track_id', 'id'],
  score_chords: ['section_id', 'id'],
  score_events: ['id'],
  score_effect_tracks: ['effect_id', 'pos'],
  score_chord_intervals: ['section_id', 'chord_id', 'pos'],
} as const;
export type ScoreTable = keyof typeof scoreKeys;
export type ScoreRows = Record<ScoreTable, ScoreRow[]>;
export const scoreTables = Object.keys(scoreKeys) as ScoreTable[];

function encodePitch(pitch: Pitch | null, prefix = ''): ScoreRow {
  return {
    [prefix + 'midi']: pitch?.kind === 'absolute' ? pitch.midi : null,
    [prefix + 'degree']: pitch?.kind === 'degree' ? pitch.degree : null,
    [prefix + 'accidental']: pitch?.kind === 'degree' ? pitch.accidental : null,
    [prefix + 'octave']: pitch?.kind === 'degree' ? pitch.octave : null,
  };
}
function decodePitch(row: ScoreRow, prefix = '') {
  if (row[prefix + 'midi'] !== null) return { kind: 'absolute', midi: row[prefix + 'midi'] };
  if (row[prefix + 'degree'] === null) return null;
  return {
    kind: 'degree',
    degree: row[prefix + 'degree'],
    accidental: row[prefix + 'accidental'],
    octave: row[prefix + 'octave'],
  };
}
function events(project: Project): ScoreRow[] {
  return [
    ...project.tempoChanges.map((e, pos) => ({
      id: e.id,
      pos,
      kind: 'tempo',
      section_id: e.at.sectionId,
      tick: e.at.tick,
      tempo: e.bpm,
      duration: e.ramp?.duration ?? null,
      end_tempo: e.ramp?.toBpm ?? null,
    })),
    ...project.keyChanges.map((e, pos) => ({
      id: e.id,
      pos,
      kind: 'key',
      section_id: e.at.sectionId,
      tick: e.at.tick,
      tonic: e.key.tonic,
      mode: e.key.mode,
      flats: Number(e.key.preferFlats),
    })),
    ...project.meterChanges.map((e, pos) => ({
      id: e.id,
      pos,
      kind: 'meter',
      section_id: e.at.sectionId,
      tick: e.at.tick,
      numerator: e.numerator,
      denominator: e.denominator,
    })),
    ...project.effects.map((e, pos) => ({
      id: e.id,
      pos,
      kind: e.kind,
      section_id: e.at.sectionId,
      tick: e.at.tick,
      duration: 'duration' in e ? e.duration : null,
      velocity: e.kind === 'accent' ? e.velocity : null,
      crash: e.kind === 'accent' ? Number(e.crash) : null,
      gain: e.kind === 'thin' ? e.gain : null,
      pattern: e.kind === 'groove' ? e.pattern : null,
      subdivision: e.kind === 'fill' ? e.subdivision : null,
      track_id: e.kind === 'octave' ? e.trackId : null,
      semitones: e.kind === 'octave' ? e.semitones : null,
    })),
  ];
}

export function projectRows(project: Project): ScoreRows {
  const { initialKey, initialMeter } = project;
  return {
    score_header: [
      {
        title: project.title,
        seed: project.seed,
        tempo: project.initialTempo,
        tonic: initialKey.tonic,
        mode: initialKey.mode,
        flats: Number(initialKey.preferFlats),
        numerator: initialMeter.numerator,
        denominator: initialMeter.denominator,
      },
    ],
    score_tracks: project.tracks.map((track, pos) => ({
      id: track.id,
      pos,
      name: track.name,
      kind: track.kind,
      program: track.program ?? null,
      pattern: track.pattern,
      gain: track.gain,
      mute: Number(track.mute),
      solo: Number(track.solo),
      octave: track.octave,
      guitar_output: track.guitar.output,
      string_1: track.guitar.tuning[0]!,
      string_2: track.guitar.tuning[1]!,
      string_3: track.guitar.tuning[2]!,
      string_4: track.guitar.tuning[3]!,
      string_5: track.guitar.tuning[4]!,
      string_6: track.guitar.tuning[5]!,
      max_fret: track.guitar.maxFret,
      max_span: track.guitar.maxSpan,
      strum_ms: track.guitar.strumMs,
      transpose: track.guitar.triggerTranspose,
      patch_name: track.guitar.patchName,
    })),
    score_sections: project.sections.map((section, pos) => ({
      id: section.id,
      pos,
      name: section.name,
      role: section.role,
      variant: section.variant,
      length: section.length,
      source: section.sourceSectionId,
    })),
    score_clips: project.sections.flatMap((section) =>
      Object.keys(section.notes).map((track) => ({ section_id: section.id, track_id: track })),
    ),
    score_notes: project.sections.flatMap((section) =>
      Object.entries(section.notes).flatMap(([track, notes]) =>
        notes.map((note) => ({
          section_id: section.id,
          track_id: track,
          id: note.id,
          tick: note.at,
          duration: note.duration,
          ...encodePitch(note.pitch),
          velocity: note.velocity,
          origin: note.origin,
          locked: Number(note.locked),
        })),
      ),
    ),
    score_chords: project.sections.flatMap((section) =>
      section.chords.map((chord) => ({
        section_id: section.id,
        id: chord.id,
        tick: chord.at,
        duration: chord.duration,
        quality: chord.quality,
        inversion: chord.inversion,
        ...encodePitch(chord.root),
        ...encodePitch(chord.bass, 'bass_'),
      })),
    ),
    score_events: events(project),
    score_effect_tracks: project.effects.flatMap((effect) =>
      ('tracks' in effect ? effect.tracks : effect.kind === 'thin' ? effect.keepTracks : []).map(
        (track_id, pos) => ({ effect_id: effect.id, pos, track_id }),
      ),
    ),
    score_chord_intervals: project.sections.flatMap((section) =>
      section.chords.flatMap((chord) =>
        chord.customIntervals.map((interval, pos) => ({
          section_id: section.id,
          chord_id: chord.id,
          pos,
          interval,
        })),
      ),
    ),
  };
}

const byPosition = (a: ScoreRow, b: ScoreRow) => Number(a.pos) - Number(b.pos);
const byTick = (a: ScoreRow, b: ScoreRow) =>
  Number(a.tick) - Number(b.tick) || String(a.id).localeCompare(String(b.id), 'en');
const key = (row: ScoreRow) => ({
  tonic: row.tonic,
  mode: row.mode,
  preferFlats: Boolean(row.flats),
});
const meter = (row: ScoreRow) => ({ numerator: row.numerator, denominator: row.denominator });
const position = (row: ScoreRow) => ({ sectionId: row.section_id, tick: row.tick });

function group(rows: ScoreRow[], keys: string[]) {
  const result = new Map<string, ScoreRow[]>();
  for (const row of rows) {
    const id = JSON.stringify(keys.map((key) => row[key]));
    const current = result.get(id);
    if (current) current.push(row);
    else result.set(id, [row]);
  }
  return (...values: (Scalar | undefined)[]) => result.get(JSON.stringify(values)) ?? [];
}

function ensureReferences(rows: ScoreRows) {
  const sections = new Set(rows.score_sections.map((row) => row.id));
  const tracks = new Set(rows.score_tracks.map((row) => row.id));
  const pair = (first: Scalar | undefined, second: Scalar | undefined) =>
    JSON.stringify([first, second]);
  const clips = new Set(rows.score_clips.map((row) => pair(row.section_id, row.track_id)));
  const chords = new Set(rows.score_chords.map((row) => pair(row.section_id, row.id)));
  const effects = new Set(rows.score_events.map((row) => row.id));
  if (
    rows.score_clips.some((row) => !sections.has(row.section_id) || !tracks.has(row.track_id)) ||
    rows.score_notes.some((row) => !clips.has(pair(row.section_id, row.track_id))) ||
    rows.score_chords.some((row) => !sections.has(row.section_id)) ||
    rows.score_chord_intervals.some((row) => !chords.has(pair(row.section_id, row.chord_id))) ||
    rows.score_effect_tracks.some((row) => !effects.has(row.effect_id) || !tracks.has(row.track_id))
  )
    throw new Error(
      '削除した項目を参照する変更があります。取り込む前にパート・トラック・音符の関係を確認してください。',
    );
}

export function rowsProject(rows: ScoreRows): Project {
  ensureReferences(rows);
  const header = rows.score_header[0]!;
  const noteGroup = group(rows.score_notes, ['section_id', 'track_id']);
  const chordGroup = group(rows.score_chords, ['section_id']);
  const intervalGroup = group(rows.score_chord_intervals, ['section_id', 'chord_id']);
  const clipGroup = group(rows.score_clips, ['section_id']);
  const effectGroup = group(rows.score_effect_tracks, ['effect_id']);
  const sortedEvents = rows.score_events.toSorted(byPosition);
  const combined = {
    schemaVersion: 2,
    title: header.title,
    seed: header.seed,
    initialTempo: header.tempo,
    initialKey: key(header),
    initialMeter: meter(header),
    tracks: rows.score_tracks.toSorted(byPosition).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      ...(r.program === null ? {} : { program: r.program }),
      pattern: r.pattern,
      gain: r.gain,
      mute: Boolean(r.mute),
      solo: Boolean(r.solo),
      octave: r.octave,
      guitar: {
        output: r.guitar_output,
        tuning: [r.string_1, r.string_2, r.string_3, r.string_4, r.string_5, r.string_6],
        maxFret: r.max_fret,
        maxSpan: r.max_span,
        strumMs: r.strum_ms,
        triggerTranspose: r.transpose,
        patchName: r.patch_name,
      },
    })),
    sections: rows.score_sections.toSorted(byPosition).map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      variant: s.variant,
      length: s.length,
      sourceSectionId: s.source,
      chords: chordGroup(s.id)
        .toSorted(byTick)
        .map((c) => ({
          id: c.id,
          at: c.tick,
          duration: c.duration,
          root: decodePitch(c),
          quality: c.quality,
          inversion: c.inversion,
          bass: decodePitch(c, 'bass_'),
          customIntervals: intervalGroup(s.id, c.id)
            .toSorted(byPosition)
            .map((i) => i.interval),
        })),
      notes: Object.fromEntries(
        clipGroup(s.id).map((clip) => [
          clip.track_id,
          noteGroup(s.id, clip.track_id)
            .toSorted(byTick)
            .map((n) => ({
              id: n.id,
              at: n.tick,
              duration: n.duration,
              pitch: decodePitch(n),
              velocity: n.velocity,
              origin: n.origin,
              locked: Boolean(n.locked),
            })),
        ]),
      ),
    })),
    tempoChanges: sortedEvents
      .filter((r) => r.kind === 'tempo')
      .map((r) => ({
        id: r.id,
        at: position(r),
        bpm: r.tempo,
        ramp: r.duration === null ? null : { duration: r.duration, toBpm: r.end_tempo },
      })),
    keyChanges: sortedEvents
      .filter((r) => r.kind === 'key')
      .map((r) => ({ id: r.id, at: position(r), key: key(r) })),
    meterChanges: sortedEvents
      .filter((r) => r.kind === 'meter')
      .map((r) => ({ id: r.id, at: position(r), ...meter(r) })),
    effects: sortedEvents
      .filter((r) => r.kind !== 'tempo' && r.kind !== 'key' && r.kind !== 'meter')
      .map((r) => {
        const tracks = effectGroup(r.id)
          .toSorted(byPosition)
          .map((track) => track.track_id);
        const base = { id: r.id, kind: r.kind, at: position(r), duration: r.duration };
        switch (r.kind) {
          case 'break':
            return { ...base, tracks };
          case 'accent':
            return { ...base, tracks, crash: Boolean(r.crash), velocity: r.velocity };
          case 'thin':
            return { ...base, keepTracks: tracks, gain: r.gain };
          case 'groove':
            return { ...base, pattern: r.pattern };
          case 'fill':
            return { ...base, subdivision: r.subdivision };
          case 'octave':
            return { ...base, trackId: r.track_id, semitones: r.semitones };
          default:
            throw new Error('履歴に不明な効果が含まれています。');
        }
      }),
  };
  return parseProjectValue(combined);
}
