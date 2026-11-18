import type { ScoreRow, ScoreRows } from './score-rows.ts';

export function mergeHarmony(rows: ScoreRows, preferred?: ScoreRows): string[] {
  const voices = new Map<string, ScoreRow[]>();
  for (const track of rows.score_tracks) {
    if (typeof track.harmony_source !== 'string') continue;
    const alternatives = voices.get(track.harmony_source);
    if (alternatives) alternatives.push(track);
    else voices.set(track.harmony_source, [track]);
  }
  const preferredIds = new Set(preferred?.score_tracks.map((track) => track.id));
  const discarded = new Set<ScoreRow[string] | undefined>();
  const conflicts: string[] = [];
  for (const [source, alternatives] of voices) {
    if (alternatives.length < 2) continue;
    const track = rows.score_tracks.find((track) => track.id === source);
    conflicts.push(`ハモリ · ${track?.name ?? source}`);
    if (!preferred) continue;
    const keep = alternatives.find((voice) => preferredIds.has(voice.id));
    if (!keep) continue;
    for (const voice of alternatives)
      if (voice !== keep && typeof voice.id === 'string') discarded.add(voice.id);
  }
  if (!discarded.size) return conflicts;

  rows.score_tracks = rows.score_tracks
    .filter((track) => !discarded.has(track.id))
    .map((track) =>
      discarded.has(track.harmony_source) ? { ...track, harmony_source: null } : track,
    );
  rows.score_clips = rows.score_clips.filter((clip) => !discarded.has(clip.track_id));
  rows.score_notes = rows.score_notes.filter((note) => !discarded.has(note.track_id));
  const affectedEffects = new Set(
    rows.score_effect_tracks
      .filter((track) => discarded.has(track.track_id))
      .map((track) => track.effect_id),
  );
  rows.score_effect_tracks = rows.score_effect_tracks.filter(
    (track) => !discarded.has(track.track_id),
  );
  const remainingEffects = new Set(rows.score_effect_tracks.map((track) => track.effect_id));
  rows.score_events = rows.score_events.filter(
    (event) =>
      !discarded.has(event.track_id) &&
      (!affectedEffects.has(event.id) ||
        remainingEffects.has(event.id) ||
        (event.kind === 'accent' && event.crash === 1)),
  );
  return conflicts;
}
