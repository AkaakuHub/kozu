import { isInstrumentProgram } from './instruments.ts';
import { PPQ } from './types.ts';
import type { Diagnostic, Pitch, Project } from './types.ts';
import { CHORDS, SCALES, inScale, resolvePitch } from './theory.ts';
import { sectionStarts, timeline, valueAt } from './time.ts';
const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const number = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const string = (x: unknown): x is string => typeof x === 'string' && x.length <= 200;
const bool = (x: unknown): x is boolean => typeof x === 'boolean';
const array = (x: unknown, check: (a: unknown) => boolean, max = 50000): boolean =>
  Array.isArray(x) && x.length <= max && x.every(check);
const pitch = (x: unknown): x is Pitch =>
  object(x) &&
  (x.kind === 'absolute'
    ? number(x.midi)
    : x.kind === 'degree' && number(x.degree) && number(x.accidental) && number(x.octave));
const key = (x: unknown): boolean =>
  object(x) &&
  number(x.tonic) &&
  typeof x.mode === 'string' &&
  Object.hasOwn(SCALES, x.mode) &&
  bool(x.preferFlats);
const pos = (x: unknown): boolean => object(x) && string(x.sectionId) && number(x.tick);
const note = (x: unknown): boolean =>
  object(x) &&
  string(x.id) &&
  number(x.at) &&
  number(x.duration) &&
  pitch(x.pitch) &&
  number(x.velocity) &&
  ['manual', 'generated'].includes(String(x.origin)) &&
  bool(x.locked);
const chord = (x: unknown): boolean =>
  object(x) &&
  string(x.id) &&
  number(x.at) &&
  number(x.duration) &&
  pitch(x.root) &&
  typeof x.quality === 'string' &&
  Object.hasOwn(CHORDS, x.quality) &&
  number(x.inversion) &&
  (x.bass === null || pitch(x.bass)) &&
  array(x.customIntervals, number, 16);
const patterns = [
  'sustain',
  'eighths',
  'arp',
  'cutting',
  'pop',
  'halftime',
  'doubletime',
  'fourOnFloor',
  'trap',
  'twoStep',
];
const guitar = (x: unknown): boolean =>
  object(x) &&
  ['voiced', 'powerNotes', 'powerTrigger'].includes(String(x.output)) &&
  array(x.tuning, number, 6) &&
  number(x.maxFret) &&
  number(x.maxSpan) &&
  number(x.strumMs) &&
  number(x.triggerTranspose) &&
  string(x.patchName);
const track = (x: unknown): boolean =>
  object(x) &&
  string(x.id) &&
  string(x.name) &&
  (x.program === undefined || isInstrumentProgram(x.program)) &&
  ['melody', 'chords', 'guitar', 'bass', 'drums'].includes(String(x.kind)) &&
  patterns.includes(String(x.pattern)) &&
  number(x.gain) &&
  bool(x.mute) &&
  bool(x.solo) &&
  number(x.octave) &&
  guitar(x.guitar);
const section = (x: unknown): boolean =>
  object(x) &&
  string(x.id) &&
  string(x.name) &&
  string(x.role) &&
  ['normal', 'drop', 'final'].includes(String(x.variant)) &&
  number(x.length) &&
  (x.autoExtend === undefined || bool(x.autoExtend)) &&
  array(x.chords, chord, 2048) &&
  object(x.notes) &&
  Object.values(x.notes).every((ns) => array(ns, note, 20000)) &&
  (x.sourceSectionId === null || string(x.sourceSectionId));
const effect = (x: unknown): boolean => {
  if (!object(x) || !string(x.id) || !pos(x.at)) return false;
  switch (x.kind) {
    case 'break':
      return number(x.duration) && array(x.tracks, string);
    case 'accent':
      return array(x.tracks, string) && number(x.velocity) && bool(x.crash);
    case 'thin':
      return number(x.duration) && array(x.keepTracks, string) && number(x.gain);
    case 'groove':
      return number(x.duration) && patterns.includes(String(x.pattern));
    case 'fill':
      return number(x.duration) && number(x.subdivision);
    case 'octave':
      return number(x.duration) && string(x.trackId) && number(x.semitones);
    default:
      return false;
  }
};
function projectShape(x: unknown): x is Project {
  return !(
    !object(x) ||
    x.schemaVersion !== 2 ||
    !string(x.title) ||
    !number(x.seed) ||
    !number(x.initialTempo) ||
    !key(x.initialKey) ||
    !object(x.initialMeter) ||
    !number(x.initialMeter.numerator) ||
    !number(x.initialMeter.denominator) ||
    ![2, 4, 8, 16].includes(x.initialMeter.denominator) ||
    !array(x.sections, section, 128) ||
    !array(x.tracks, track) ||
    !array(x.effects, effect, 512) ||
    !array(
      x.tempoChanges,
      (e) =>
        object(e) &&
        string(e.id) &&
        pos(e.at) &&
        number(e.bpm) &&
        (e.ramp === null || (object(e.ramp) && number(e.ramp.duration) && number(e.ramp.toBpm))),
      512,
    ) ||
    !array(x.keyChanges, (e) => object(e) && string(e.id) && pos(e.at) && key(e.key), 512) ||
    !array(
      x.meterChanges,
      (e) =>
        object(e) &&
        string(e.id) &&
        pos(e.at) &&
        number(e.numerator) &&
        number(e.denominator) &&
        [2, 4, 8, 16].includes(e.denominator),
      512,
    )
  );
}
export function parseProjectValue(value: unknown): Project {
  if (!projectShape(value))
    throw new Error('プロジェクト形式が正しくありません（schemaVersion: 2 が必要です）。');
  const errors = validate(value).filter((d) => d.severity === 'error');
  if (errors.length) throw new Error(errors.map((d) => d.message).join('\n'));
  return value;
}
export function parseProject(text: string): Project {
  return parseProjectValue(JSON.parse(text));
}
export function validate(project: Project): Diagnostic[] {
  const ds: Diagnostic[] = [];
  const issue = (
    severity: Diagnostic['severity'],
    code: string,
    message: string,
    sectionId: string | null = null,
  ) => ds.push({ severity, code, message, sectionId });
  const bounded = (v: number, min: number, max: number) =>
    Number.isFinite(v) && v >= min && v <= max;
  const ticks = (v: number) => Number.isSafeInteger(v) && v >= 0;
  const validPitch = (p: Pitch) =>
    p.kind === 'absolute'
      ? Number.isInteger(p.midi) && bounded(p.midi, 0, 127)
      : Number.isInteger(p.degree) &&
        bounded(p.degree, 1, 7) &&
        Number.isInteger(p.accidental) &&
        bounded(p.accidental, -12, 12) &&
        Number.isInteger(p.octave) &&
        bounded(p.octave, -1, 9);
  const validKey = (k: Project['initialKey']) =>
    Number.isInteger(k.tonic) && bounded(k.tonic, 0, 11) && Object.hasOwn(SCALES, k.mode);
  if (!project.sections.length) issue('error', 'no-sections', '少なくとも1つのパートが必要です。');
  if (!project.tracks.length) issue('error', 'track-count', '少なくとも1つのトラックが必要です。');
  if (!bounded(project.initialTempo, 20, 400))
    issue('error', 'tempo', 'BPMは20〜400で指定してください。');
  if (!validKey(project.initialKey)) issue('error', 'key', 'キーの指定が正しくありません。');
  if (
    !Number.isInteger(project.initialMeter.numerator) ||
    !bounded(project.initialMeter.numerator, 1, 32)
  )
    issue('error', 'meter', '拍子の分子は1〜32の整数です。');
  if (![2, 4, 8, 16].includes(project.initialMeter.denominator))
    issue('error', 'meter', '拍子の分母が正しくありません。');
  const trackIds = new Set(project.tracks.map((t) => t.id));
  const sectionIds = new Set(project.sections.map((s) => s.id));
  if (trackIds.size !== project.tracks.length || sectionIds.size !== project.sections.length)
    issue('error', 'duplicate-id', 'トラックまたはパートのIDが重複しています。');
  for (const t of project.tracks) {
    if (!bounded(t.gain, 0, 1) || !Number.isInteger(t.octave) || !bounded(t.octave, 0, 7))
      issue('error', 'track-range', `${t.name}: 音量またはオクターブが範囲外です。`);
    const g = t.guitar;
    if (
      g.tuning.length !== 6 ||
      g.tuning.some((p) => !Number.isInteger(p) || !bounded(p, 0, 100)) ||
      !Number.isInteger(g.maxFret) ||
      !bounded(g.maxFret, 0, 24) ||
      !Number.isInteger(g.maxSpan) ||
      !bounded(g.maxSpan, 0, 6) ||
      !bounded(g.strumMs, 0, 80) ||
      !Number.isInteger(g.triggerTranspose) ||
      !bounded(g.triggerTranspose, -36, 36)
    )
      issue('error', 'guitar', `${t.name}: ギター設定が範囲外です。`);
  }
  const totalTicks = project.sections.reduce((n, s) => n + s.length, 0),
    startsForBounds = sectionStarts(project);
  for (const t of project.tempoChanges)
    if (
      t.ramp &&
      (startsForBounds.get(t.at.sectionId) ?? 0) + t.at.tick + t.ramp.duration > totalTicks
    )
      issue('error', 'tempo-end', 'テンポ変化が曲の終わりを越えています。', t.at.sectionId);
  const events = [
    ...project.tempoChanges,
    ...project.keyChanges,
    ...project.meterChanges,
    ...project.effects,
  ];
  if (new Set(events.map((e) => e.id)).size !== events.length)
    issue('error', 'duplicate-event', 'イベントのIDが重複しています。');
  for (const e of events) {
    const s = project.sections.find((s) => s.id === e.at.sectionId);
    if (!s || !ticks(e.at.tick) || e.at.tick >= s.length)
      issue('error', 'event-position', 'イベントの位置がパートの範囲外です。', e.at.sectionId);
  }
  for (const t of project.tempoChanges)
    if (
      !bounded(t.bpm, 20, 400) ||
      (t.ramp &&
        (!ticks(t.ramp.duration) ||
          t.ramp.duration <= 0 ||
          t.ramp.duration > PPQ * 1024 ||
          !bounded(t.ramp.toBpm, 20, 400)))
    )
      issue('error', 'tempo', 'テンポイベントが範囲外です。', t.at.sectionId);
  for (const k of project.keyChanges)
    if (!validKey(k.key)) issue('error', 'key', 'キーイベントが範囲外です。', k.at.sectionId);
  for (const m of project.meterChanges)
    if (
      ![2, 4, 8, 16].includes(m.denominator) ||
      !Number.isInteger(m.numerator) ||
      !bounded(m.numerator, 1, 32)
    )
      issue('error', 'meter', '拍子が範囲外です。', m.at.sectionId);
  for (const e of project.effects) {
    const s = project.sections.find((s) => s.id === e.at.sectionId);
    if (
      'duration' in e &&
      (!ticks(e.duration) || e.duration <= 0 || (s && e.at.tick + e.duration > s.length))
    )
      issue(
        'error',
        'effect-duration',
        '技法の範囲は同じパート内に収めてください。',
        e.at.sectionId,
      );
    const ids =
      'tracks' in e
        ? e.tracks
        : 'keepTracks' in e
          ? e.keepTracks
          : 'trackId' in e
            ? [e.trackId]
            : [];
    if (ids.some((id) => !trackIds.has(id)))
      issue(
        'error',
        'missing-track',
        '技法に存在しないトラックが指定されています。',
        e.at.sectionId,
      );
    if (e.kind === 'fill' && ![1, 2, 3, 4, 6, 8].includes(e.subdivision))
      issue('error', 'fill', 'フィルの分割は1/2/3/4/6/8のいずれかです。', e.at.sectionId);
    if (
      (e.kind === 'thin' && !bounded(e.gain, 0, 1)) ||
      (e.kind === 'accent' && !bounded(e.velocity, 1, 127)) ||
      (e.kind === 'octave' && (!Number.isInteger(e.semitones) || !bounded(e.semitones, -24, 24)))
    )
      issue('error', 'effect-value', '技法の値が範囲外です。', e.at.sectionId);
  }
  for (const s of project.sections) {
    if (!ticks(s.length) || s.length <= 0 || s.length > PPQ * 1024)
      issue('error', 'length', `${s.name}: 長さは1〜983040tickです。`, s.id);
    if (s.sourceSectionId !== null && !sectionIds.has(s.sourceSectionId))
      issue('error', 'source-section', '複製元パートの参照がありません。', s.id);
    if (new Set(s.chords.map((c) => c.id)).size !== s.chords.length)
      issue('error', 'duplicate-chord', '和音IDが重複しています。', s.id);
    const sorted = [...s.chords].sort((a, b) => a.at - b.at);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i]!;
      if (!ticks(c.at) || !ticks(c.duration) || c.duration <= 0 || c.at + c.duration > s.length)
        issue('error', 'chord-duration', `${s.name}: コードがパートの範囲外です。`, s.id);
      if (i && sorted[i - 1]!.at + sorted[i - 1]!.duration > c.at)
        issue('error', 'chord-overlap', `${s.name}: コードの範囲が重複しています。`, s.id);
      if (
        !validPitch(c.root) ||
        (c.bass && !validPitch(c.bass)) ||
        !Number.isInteger(c.inversion) ||
        !bounded(c.inversion, 0, 8) ||
        c.customIntervals.some((n) => !Number.isInteger(n) || !bounded(n, 0, 36)) ||
        (c.quality === 'custom' && !c.customIntervals.length)
      )
        issue('error', 'chord-pitch', `${s.name}: 和音の構成が正しくありません。`, s.id);
    }
    for (const [tid, notes] of Object.entries(s.notes)) {
      if (!trackIds.has(tid))
        issue('error', 'orphan-notes', `${s.name}: 音符のトラックがありません。`, s.id);
      if (new Set(notes.map((n) => n.id)).size !== notes.length)
        issue('error', 'duplicate-note', '音符IDが重複しています。', s.id);
      for (const n of notes) {
        if (
          !ticks(n.at) ||
          !ticks(n.duration) ||
          n.duration <= 0 ||
          n.at + n.duration > s.length ||
          !Number.isInteger(n.velocity) ||
          !bounded(n.velocity, 1, 127) ||
          !validPitch(n.pitch)
        )
          issue('error', 'note', `${s.name}: 音符の位置・長さ・音高・強さが範囲外です。`, s.id);
      }
    }
  }
  if (!ds.some((d) => d.severity === 'error')) {
    const maps = timeline(project),
      starts = sectionStarts(project);
    for (const s of project.sections)
      for (const [trackId, notes] of Object.entries(s.notes)) {
        if (project.tracks.find((t) => t.id === trackId)?.kind === 'drums') continue;
        let outside = 0,
          fixed = 0;
        for (const n of notes) {
          const k = valueAt(maps.keys, starts.get(s.id)! + n.at).key;
          const p = resolvePitch(n.pitch, k);
          if (p < 0 || p > 127)
            issue('error', 'midi-range', `${s.name}: 解決後の音高がMIDI範囲外です。`, s.id);
          if (!inScale(p, k)) outside++;
          if (n.pitch.kind === 'absolute') fixed++;
        }
        if (outside)
          issue(
            'warning',
            'non-diatonic',
            `${s.name}: スケール外の音が${outside}個あります。借用・経過音として使用でき、入力は禁止しません。`,
            s.id,
          );
        if (fixed && project.keyChanges.some((k) => k.at.sectionId === s.id))
          issue(
            'warning',
            'fixed-pitch',
            `${s.name}: 固定音高${fixed}個はキー変更に追従しません。`,
            s.id,
          );
      }
  }
  return ds;
}
