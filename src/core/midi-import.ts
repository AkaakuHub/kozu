import { isInstrumentProgram } from './instruments.ts';
import { drumKitForProgram } from './drum-kits.ts';
import type { InstrumentProgram } from './instruments.ts';
import { parseMidi } from 'midi-file';
import { createSection, createTrack } from './presets.ts';
import { mod } from './theory.ts';
import { PPQ, uid } from './types.ts';
import type { Key, Note, Project } from './types.ts';
import { validate } from './validate.ts';
import { applyMidiMarkers } from './midi-layout.ts';

function trackName(source: string) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(source, (character) => character.charCodeAt(0)),
    );
  } catch {
    return source;
  }
}

export function importMidi(bytes: Uint8Array, title: string): Project {
  const { header, tracks } = parseMidi(bytes);
  const division = header.ticksPerBeat;
  if (!division || header.format > 1)
    throw new Error('SMF形式0または1のPPQファイルを選択してください。');
  const toTicks = (tick: number) => Math.round((tick * PPQ) / division);
  const section = createSection(title, PPQ, null);
  const project: Project = {
    schemaVersion: 2,
    title,
    seed: 42,
    initialTempo: 120,
    initialKey: { tonic: 0, mode: 'major', preferFlats: false },
    initialMeter: { numerator: 4, denominator: 4 },
    sections: [section],
    tracks: [],
    tempoChanges: [],
    keyChanges: [],
    meterChanges: [],
    effects: [],
  };
  let last = 0;
  const markers: { tick: number; label: string }[] = [];
  const sustainByRoute = new Map<number, { tick: number; value: number }[]>();
  const importedTracks: { id: string; route: number }[] = [];
  for (const events of tracks) {
    let elapsed = 0;
    let port = 0;
    const name = trackName(events.find((e) => e.type === 'trackName')?.text ?? '').trim();
    const programs = new Map<number, InstrumentProgram>();
    const parts = new Map<number, Note[]>();
    const active = new Map<number, { at: number; velocity: number }[]>();
    for (const event of events) {
      elapsed += event.deltaTime;
      const tick = toTicks(elapsed);
      const at = { sectionId: section.id, tick };
      last = Math.max(last, tick);
      if (event.type === 'portPrefix') port = event.port;
      if (event.type === 'marker') {
        const label = trackName(event.text).trim();
        if (label) markers.push({ tick, label });
      }
      if (event.type === 'setTempo') {
        const bpm = 60_000_000 / event.microsecondsPerBeat;
        if (tick === 0) project.initialTempo = bpm;
        else project.tempoChanges.push({ id: uid('tempo'), at, bpm, ramp: null });
      }
      if (event.type === 'keySignature') {
        const key: Key = {
          tonic: mod(event.key * 7 + (event.scale ? 9 : 0)),
          mode: event.scale ? 'minor' : 'major',
          preferFlats: event.key < 0,
        };
        if (tick === 0) project.initialKey = key;
        else project.keyChanges.push({ id: uid('key'), at, key });
      }
      if (event.type === 'timeSignature') {
        const { numerator, denominator } = event;
        if (denominator !== 2 && denominator !== 4 && denominator !== 8 && denominator !== 16)
          throw new Error(`拍子 ${numerator}/${denominator} は読み込めません。`);
        if (tick === 0) project.initialMeter = { numerator, denominator };
        else project.meterChanges.push({ id: uid('meter'), at, numerator, denominator });
      }
      if (
        event.type === 'programChange' &&
        !programs.has(16 * port + event.channel) &&
        !parts.has(16 * port + event.channel) &&
        isInstrumentProgram(event.programNumber)
      )
        programs.set(16 * port + event.channel, event.programNumber);
      if (event.type === 'controller' && event.controllerType === 64) {
        const route = 16 * port + event.channel;
        let points = sustainByRoute.get(route);
        if (!points) sustainByRoute.set(route, (points = []));
        points.push({ tick, value: event.value });
      }
      if (event.type !== 'noteOn' && event.type !== 'noteOff') continue;
      const route = 16 * port + event.channel;
      const code = route * 128 + event.noteNumber;
      let queue = active.get(code);
      if (event.type === 'noteOn' && event.velocity > 0) {
        if (!queue) active.set(code, (queue = []));
        queue.push({ at: tick, velocity: event.velocity });
        continue;
      }
      const note = queue?.shift();
      if (!note) continue;
      let clip = parts.get(route);
      if (!clip) parts.set(route, (clip = []));
      const duration = Math.max(1, tick - note.at);
      last = Math.max(last, note.at + duration);
      clip.push({
        ...note,
        id: uid('note'),
        duration,
        pitch: { kind: 'absolute', midi: event.noteNumber },
        origin: 'manual',
        locked: true,
      });
    }
    for (const [route, clip] of parts) {
      const channel = route % 16;
      const label = name || `トラック ${project.tracks.length + 1}`;
      const track = createTrack(
        channel === 9 ? 'drums' : 'melody',
        parts.size === 1 ? label : `${label} (${channel + 1})`,
      );
      track.gain = 1;
      const program = programs.get(route);
      if (program !== undefined) {
        if (channel !== 9) track.program = program;
        else {
          const kit = drumKitForProgram(program);
          if (kit) track.drumKit = kit;
        }
      }
      project.tracks.push(track);
      importedTracks.push({ id: track.id, route });
      section.notes[track.id] = clip;
    }
  }
  section.length = Math.max(
    PPQ,
    last,
    ...[project.tempoChanges, project.keyChanges, project.meterChanges].flatMap((events) =>
      events.map((event) => event.at.tick + 1),
    ),
  );
  for (const { id: trackId, route } of importedTracks) {
    const points = sustainByRoute.get(route);
    if (!points) continue;
    for (const { tick, value } of points.toSorted((a, b) => a.tick - b.tick)) {
      (project.sustain ??= []).push({
        id: uid('pedal'),
        at: { sectionId: section.id, tick },
        trackId,
        value,
      });
      section.length = Math.max(section.length, tick + 1);
    }
  }
  applyMidiMarkers(project, markers);
  const errors = validate(project).filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length) throw new Error(errors[0]!.message);
  return project;
}
