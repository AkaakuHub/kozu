import { PPQ } from './types.ts';
import type { CompiledSong, Project, RenderedNote, Track } from './types.ts';
import { chordPitches, mod, resolvePitch, voiceLead } from './theory.ts';
import { absolutePosition, sectionStarts, timeline, valueAt } from './time.ts';
import { guitarVoicing } from './guitar.ts';
import { validate } from './validate.ts';
import { drumHits } from './drums.ts';
export function compile(project: Project, mode: 'playback' | 'edit' = 'playback'): CompiledSong {
  const diagnostics = validate(project);
  const empty: CompiledSong = {
    notes: [],
    tempos: [],
    keys: [],
    meters: [],
    markers: [],
    totalTicks: 0,
    diagnostics,
    breaks: [],
  };
  if (diagnostics.some((d) => d.severity === 'error')) return empty;
  const starts = sectionStarts(project);
  const maps = timeline(project);
  const totalTicks = project.sections.reduce((sum, s) => sum + s.length, 0);
  const channels = new Map<string, number>();
  let channel = 0;
  for (const t of project.tracks) {
    if (t.kind === 'drums') channels.set(t.id, 9);
    else {
      if (channel === 9) channel++;
      channels.set(t.id, channel++);
    }
  }
  const anySolo = project.tracks.some((t) => t.solo);
  const active = project.tracks.filter(
    (t) => mode === 'edit' || (!t.mute && t.gain > 0 && (!anySolo || t.solo)),
  );
  let notes: RenderedNote[] = [];
  let serial = 0;
  const add = (
    track: Track,
    pitch: number,
    start: number,
    end: number,
    velocity: number,
    string: number | null = null,
  ) => {
    if (!Number.isFinite(pitch) || pitch < 0 || pitch > 127 || !Number.isInteger(pitch)) {
      diagnostics.push({
        severity: 'error',
        code: 'rendered-pitch',
        message: `${track.name}: MIDI範囲外の音高 ${pitch} があります。`,
        sectionId: null,
      });
      return;
    }
    if (start >= totalTicks || end <= start) return;
    notes.push({
      id: `render-${serial++}`,
      trackId: track.id,
      pitch,
      start: Math.max(0, Math.round(start)),
      end: Math.min(totalTicks, Math.round(end)),
      velocity: Math.max(
        1,
        Math.min(127, Math.round(velocity * (mode === 'edit' ? 1 : track.gain))),
      ),
      channel: channels.get(track.id)!,
      string,
    });
  };
  const absoluteEffects = project.effects.map((e) => ({
    ...e,
    tick: absolutePosition(e.at, starts),
  }));
  for (const track of active) {
    let previous: number[] = [];
    let previousFrets: (number | null)[] = [];
    for (const section of project.sections) {
      const base = starts.get(section.id)!;
      const sectionEnd = base + section.length;
      // Presence of a note clip (including an empty clip) overrides automatic accompaniment.
      if (Object.hasOwn(section.notes, track.id)) {
        for (const n of section.notes[track.id]!)
          add(
            track,
            resolvePitch(n.pitch, valueAt(maps.keys, base + n.at).key),
            base + n.at,
            base + n.at + n.duration,
            n.velocity,
          );
        continue;
      }
      if (track.kind === 'melody') continue;
      if (track.kind === 'drums') {
        const grooves = absoluteEffects
          .filter((event) => event.kind === 'groove')
          .filter((event) => event.tick < sectionEnd && event.tick + event.duration > base);
        for (let tick = base; tick < sectionEnd; tick += PPQ / 8) {
          const groove = grooves.findLast(
            (event) => event.tick <= tick && tick < event.tick + event.duration,
          );
          const pattern = groove?.pattern ?? track.pattern;
          const meter = valueAt(maps.meters, tick);
          const bar = (PPQ * 4 * meter.numerator) / meter.denominator;
          const beat = ((tick - Math.max(base, meter.tick)) % bar) / PPQ;
          for (const hit of drumHits(pattern, beat)) {
            const length = hit.pitch === 42 || hit.pitch === 46 ? PPQ / 8 : PPQ / 6;
            add(track, hit.pitch, tick, Math.min(sectionEnd, tick + length), hit.velocity);
          }
        }
        continue;
      }
      for (const chord of section.chords) {
        const from = base + chord.at,
          to = from + chord.duration;
        const splits = [
          from,
          ...maps.keys.filter((k) => k.tick > from && k.tick < to).map((k) => k.tick),
          to,
        ];
        for (let slice = 0; slice < splits.length - 1; slice++) {
          const a = splits[slice]!,
            b = splits[slice + 1]!;
          const key = valueAt(maps.keys, a).key;
          const raw = chordPitches(chord, key, track.octave);
          let pitches = chord.bass ? raw : voiceLead(raw, previous, true);
          let strings: (number | null)[] = pitches.map(() => null);
          if (track.kind === 'bass') {
            const root = chord.bass ?? chord.root;
            pitches = [mod(resolvePitch(root, key)) + (track.octave + 1) * 12];
            strings = [null];
          } else if (track.kind === 'guitar') {
            const root = mod(resolvePitch(chord.root, key)) + 36;
            if (track.guitar.output === 'powerTrigger') {
              pitches = [root + track.guitar.triggerTranspose];
              strings = [null];
            } else if (track.guitar.output === 'powerNotes') {
              pitches = [root, root + 7, root + 12];
              strings = [0, 1, 2];
            } else {
              const shape = guitarVoicing(
                raw,
                track.guitar,
                previousFrets,
                chord.bass !== null || chord.inversion > 0,
              );
              if (!shape) {
                diagnostics.push({
                  severity: 'warning',
                  code: 'guitar-unplayable',
                  message: `${section.name}: ${track.name}の運指候補がなく、この和音は未発音です。フレット範囲・和音を調整してください。`,
                  sectionId: section.id,
                });
                continue;
              }
              pitches = shape.pitches;
              strings = shape.strings;
              previousFrets = shape.frets;
              if (shape.omittedPitchClasses.length)
                diagnostics.push({
                  severity: 'warning',
                  code: 'guitar-omission',
                  message: `${section.name}: ギターでは拡張和音の一部を省略しています。`,
                  sectionId: section.id,
                });
            }
          }
          previous = pitches;
          const interval =
            track.pattern === 'sustain' ? b - a : track.pattern === 'cutting' ? PPQ / 4 : PPQ / 2;
          for (let t = a, index = 0; t < b; t += interval, index++) {
            const arpeggio = track.pattern === 'arp';
            if (track.pattern === 'cutting' && (index % 4 === 2 || index % 8 === 7)) continue;
            const order = pitches.map((p, i) => ({ p, string: strings[i] ?? null }));
            if (track.kind === 'guitar' && index % 2 === 1) order.reverse();
            const chosen = arpeggio ? [order[index % order.length]!] : order;
            const bpm = valueAt(maps.tempos, t).bpm;
            chosen.forEach(({ p, string }, j) => {
              // Trigger patches already contain a strum/chord: never stack chord tones or per-string delays.
              const delay =
                track.kind === 'guitar' && track.guitar.output !== 'powerTrigger' && !arpeggio
                  ? ((((j * track.guitar.strumMs) / 1000) * bpm) / 60) * PPQ
                  : 0;
              const start = t + delay;
              const duration =
                track.pattern === 'sustain'
                  ? b - t
                  : Math.min(interval * (track.pattern === 'cutting' ? 0.44 : 0.82), b - t);
              add(
                track,
                p,
                start,
                Math.min(b, start + duration),
                track.kind === 'bass' ? 88 : index % 2 ? 67 : 83,
                string,
              );
            });
          }
        }
      }
    }
  }
  if (mode === 'edit')
    return {
      ...empty,
      ...maps,
      notes: notes.filter((n) => n.end > n.start),
      totalTicks,
      diagnostics,
    };
  // Accent rendering happens before break cutting, so a sustained chord can restart at the accent.
  for (const effect of absoluteEffects) {
    if (effect.kind === 'accent') {
      const original = [...notes];
      for (const id of effect.tracks) {
        const existing = notes.filter(
          (n) => n.trackId === id && Math.abs(n.start - effect.tick) < PPQ / 16,
        );
        if (existing.length)
          for (const n of existing)
            n.velocity = Math.min(
              127,
              Math.max(
                n.velocity,
                Math.round(
                  effect.velocity * (project.tracks.find((t) => t.id === n.trackId)?.gain ?? 1),
                ),
              ),
            );
        else
          for (const n of original.filter(
            (n) => n.trackId === id && n.start < effect.tick && n.end > effect.tick,
          ))
            notes.push({
              ...n,
              id: `accent-${serial++}`,
              start: effect.tick,
              velocity: Math.max(
                n.velocity,
                Math.round(
                  effect.velocity * (project.tracks.find((t) => t.id === n.trackId)?.gain ?? 1),
                ),
              ),
            });
      }
      if (effect.crash) {
        const drum = active.find((t) => t.kind === 'drums');
        if (drum) add(drum, 49, effect.tick, effect.tick + PPQ / 2, effect.velocity);
      }
    }
    if (effect.kind === 'fill') {
      const drum = active.find((t) => t.kind === 'drums');
      if (drum) {
        notes = notes.filter(
          (n) =>
            !(
              n.trackId === drum.id &&
              n.start >= effect.tick &&
              n.start < effect.tick + effect.duration
            ),
        );
        for (
          let t = effect.tick, i = 0;
          t < effect.tick + effect.duration;
          t += PPQ / effect.subdivision, i++
        )
          add(
            drum,
            [38, 38, 45, 47][i % 4]!,
            t,
            t + (PPQ / effect.subdivision) * 0.7,
            65 + (40 * (t - effect.tick)) / effect.duration,
          );
      }
    }
    if (effect.kind === 'octave') {
      const originals = [...notes];
      for (const n of originals)
        if (
          n.trackId === effect.trackId &&
          n.start >= effect.tick &&
          n.start < effect.tick + effect.duration
        ) {
          if (n.pitch + effect.semitones >= 0 && n.pitch + effect.semitones <= 127)
            notes.push({
              ...n,
              id: `oct-${serial++}`,
              pitch: n.pitch + effect.semitones,
              velocity: Math.round(n.velocity * 0.72),
            });
          else
            diagnostics.push({
              severity: 'error',
              code: 'octave-range',
              message: 'オクターブ追加後の音がMIDI範囲外です。',
              sectionId: effect.at.sectionId,
            });
        }
    }
  }
  const breaks: CompiledSong['breaks'] = [];
  for (const effect of absoluteEffects) {
    if (effect.kind === 'break') {
      for (const id of effect.tracks)
        breaks.push({ tick: effect.tick, end: effect.tick + effect.duration, trackId: id });
      notes = notes.flatMap((n) => {
        if (
          !effect.tracks.includes(n.trackId) ||
          n.end <= effect.tick ||
          n.start >= effect.tick + effect.duration
        )
          return [n];
        // Cut an already sounding note at the break; do not invent a re-attack after it.
        return n.start < effect.tick ? [{ ...n, end: effect.tick }] : [];
      });
    }
    if (effect.kind === 'thin')
      notes = notes.flatMap((n) => {
        const end = effect.tick + effect.duration;
        if (n.end <= effect.tick || n.start >= end) return [n];
        const result: RenderedNote[] = [];
        if (n.start < effect.tick) result.push({ ...n, end: effect.tick });
        if (effect.gain > 0 && effect.keepTracks.includes(n.trackId))
          result.push({
            ...n,
            id: `thin-${serial++}`,
            start: Math.max(n.start, effect.tick),
            end: Math.min(n.end, end),
            velocity: Math.max(1, Math.round(n.velocity * effect.gain)),
          });
        if (n.end > end) result.push({ ...n, id: `tail-${serial++}`, start: end });
        return result;
      });
  }
  // One voice per string and one active note per MIDI pitch/channel. Prevent premature note-off collisions.
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const last = new Map<string, RenderedNote>();
  for (const n of notes) {
    const identities = [
      `${n.channel}:pitch:${n.pitch}`,
      ...(n.string === null ? [] : [`${n.trackId}:string:${n.string}`]),
    ];
    for (const identity of identities) {
      const p = last.get(identity);
      if (p && p.end > n.start) p.end = n.start;
      last.set(identity, n);
    }
  }
  notes = notes.filter((n) => n.end > n.start);
  return {
    notes,
    ...maps,
    totalTicks,
    diagnostics,
    breaks,
    markers: project.sections.map((s) => ({ tick: starts.get(s.id)!, label: s.name })),
  };
}
