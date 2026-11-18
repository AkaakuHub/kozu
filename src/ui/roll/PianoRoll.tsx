import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import { MousePointer2, ScissorsLineDashed, SlidersHorizontal, Trash2 } from 'lucide-react';
import { AppMenu } from '../workbench/AppMenu.tsx';
import { useContextGesture } from '../workbench/useContextGesture.ts';
import { useRollGestures } from './useRollGestures.ts';
import { RollRuler } from './RollRuler.tsx';
import { RollTools } from './RollTools.tsx';
import { ScaleGuide } from './ScaleGuide.tsx';
import type { RollTool } from './RollTools.tsx';
import { clone, PPQ } from '../../core/types.ts';
import type { CompiledSong, Note, Project, Section, Track } from '../../core/types.ts';
import { inScale, pitchName, resolvePitch } from '../../core/theory.ts';
import { valueAt } from '../../core/time.ts';
import {
  autoClip,
  editTrackNotes,
  rollSection,
  rollSectionEnd,
  trackNotes,
} from '../../core/roll-timeline.ts';
import type { RollNote } from '../../core/roll-timeline.ts';
import {
  drawnNoteSpan,
  makeNote,
  materializeNotes,
  copyPhrase,
  moveNote,
  placePhrase,
  startDrawnNote,
} from '../../core/roll-editing.ts';
const NoteDialog = lazy(() =>
  import('./NoteDialog.tsx').then((module) => ({ default: module.NoteDialog })),
);
import './roll.css';

const row = 22;
const ruler = 72;
const keyboard = 52;
const shades = ['#71e3c3', '#b1a8ff', '#ffc17d', '#8ebeff', '#ff9dbb'];

interface Props {
  project: Project;
  section: Section;
  track: Track;
  mode: 'light' | 'dark';
  start: number;
  starts: Map<string, number>;
  song: CompiledSong;
  scaleGuide: boolean;
  audition: ((pitch: number) => void) | undefined;
  playhead: number;
  cursorTick: RefObject<number>;
  cursorFrame: RefObject<((tick: number) => void) | null>;
  clipboard: Note[];
  copyNotes: (notes: Note[]) => void;
  notify: (message: string) => void;
  playing: boolean;
  seek: (tick: number) => void;
  editTempo: (tick: number) => void;
  generateMelody: () => void;
  change: (update: (s: Section, p: Project) => void) => void;
  commit: (project: Project) => void;
}

interface Drag {
  id: string;
  x: number;
  y: number;
  mode: 'move' | 'resize';
  at: number;
  pitch: number;
  duration: number;
  lastPitch: number;
  movement: { ticks: number; pitches: number };
}
const snap = (value: number, step: number) => Math.round(value / step) * step;

export function PianoRoll({
  project,
  section,
  track,
  mode,
  start,
  starts,
  song,
  scaleGuide,
  audition,
  playhead,
  cursorFrame,
  cursorTick,
  clipboard,
  copyNotes,
  notify,
  playing,
  seek,
  editTempo,
  generateMelody: openMelody,
  change,
  commit,
}: Props) {
  const [selected, select] = useState<string[]>([]);
  const [context, setContext] = useState<{ id: string; anchor: HTMLDivElement } | null>(null);
  const [detail, setDetail] = useState(false);
  const [tool, setTool] = useState<RollTool>('select');
  const [step, setStep] = useState(PPQ / 4);
  const [zoom, setZoom] = useState(72);
  const [ghosts, setGhosts] = useState(true);
  const [delta, setDelta] = useState({ ticks: 0, pitches: 0 });
  const viewport = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [range, setRange] = useState({ first: 0, last: PPQ * 24 });
  const drag = useRef<Drag | null>(null);
  const nextDrag = useRef<{ id: string; mode: Drag['mode'] } | null>(null);
  const drawing = useRef<{
    pointer: number;
    anchor: number;
    start: number;
    end: number;
    midi: number;
  } | null>(null);
  const [draftNote, setDraftNote] = useState<{ at: number; duration: number; midi: number } | null>(
    null,
  );
  useRollGestures(viewport, keyboard, zoom, setZoom, () => {
    drag.current = null;
    drawing.current = null;
    setDraftNote(null);
    setDelta({ ticks: 0, pitches: 0 });
  });
  const notes = useMemo(() => trackNotes(project, track.id, starts), [project, track.id, starts]);
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const auto = autoClip(section, track);
  const selectedNote = notes.find((n) => n.id === selected.at(-1));
  const contextNote = notes.find((note) => note.id === context?.id);
  const openNoteContext = (anchor: HTMLDivElement) => {
    const id = anchor.dataset.noteId;
    if (!id) return;
    drag.current = null;
    setDelta({ ticks: 0, pitches: 0 });
    setContext({ id, anchor });
  };
  const noteGesture = useContextGesture(openNoteContext);
  const keyFor = (at: number) => valueAt(song.keys, at).key;
  const pitchOf = (note: Note) => resolvePitch(note.pitch, keyFor(note.at));
  const editable = song.keys.length > 0;
  const px = zoom / PPQ;
  const last = project.sections.at(-1)!;
  const total = starts.get(last.id)! + last.length;
  const endOf = (section: Section) =>
    autoClip(section, track)
      ? starts.get(section.id)! + section.length
      : rollSectionEnd(starts, section, song.meters);
  const editLimit = endOf(last);
  const width = Math.max(1, editLimit * px);
  const position = playhead;
  const guideKey =
    scaleGuide && track.kind !== 'drums' && song.keys.length > 0
      ? keyFor(Math.max(0, Math.min(total - 1, position)))
      : null;
  const color = shades[project.tracks.indexOf(track) % shades.length];
  const chords = useMemo(
    () =>
      project.sections.flatMap((part) =>
        part.chords.map((chord) => ({
          ...chord,
          sectionId: part.id,
          at: starts.get(part.id)! + chord.at,
        })),
      ),
    [project.sections, starts],
  );
  const visibleChords = useMemo(
    () =>
      chords.filter((chord) => chord.at + chord.duration > range.first && chord.at < range.last),
    [chords, range],
  );
  const center = song.notes.find((n) => n.trackId === track.id)?.pitch ?? (track.octave + 1) * 12;

  useLayoutEffect(() => {
    const view = viewport.current;
    if (view) view.scrollTop = Math.max(0, (127 - center) * row - view.clientHeight / 2);
    nextDrag.current = null;
    select([]);
    setDetail(false);
  }, [track.id]);

  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view || playing) return;
    const left = cursorTick.current * px;
    if (left < view.scrollLeft || left >= view.scrollLeft + view.clientWidth - keyboard)
      view.scrollLeft = start * px;
  }, [section.id]);

  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const update = () => {
      const span = PPQ * 4;
      const first = Math.max(0, Math.floor(view.scrollLeft / px / span) * span - span);
      const last = Math.ceil((view.scrollLeft + view.clientWidth) / px / span) * span + span;
      setRange((old) => (old.first === first && old.last === last ? old : { first, last }));
    };
    const manual = () => {
      follow.current = false;
    };
    view.addEventListener('wheel', manual, { passive: true });
    view.addEventListener('touchstart', manual, { passive: true });
    view.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(view);
    update();
    return () => {
      view.removeEventListener('scroll', update);
      view.removeEventListener('wheel', manual);
      view.removeEventListener('touchstart', manual);
      observer.disconnect();
    };
  }, [px]);

  useLayoutEffect(() => {
    if (playing) follow.current = true;
  }, [playing]);

  useLayoutEffect(() => {
    const frame = (tick: number) => {
      const view = viewport.current;
      const marker = cursor.current;
      if (!view || !marker) return;
      const at = tick;
      const x = at * px;
      marker.style.visibility = at < 0 || at > total ? 'hidden' : 'visible';
      marker.style.transform = `translateX(${x}px)`;
      if (
        playing &&
        follow.current &&
        at >= 0 &&
        at < total &&
        (x > view.scrollLeft + view.clientWidth - keyboard - 24 || x < view.scrollLeft)
      )
        view.scrollLeft = Math.max(0, x - 48);
    };
    cursorFrame.current = frame;
    frame(cursorTick.current);
    return () => {
      if (cursorFrame.current === frame) cursorFrame.current = null;
    };
  }, [cursorFrame, cursorTick, px, total, playing, playhead]);

  const selectedNotes = () => notes.filter((note) => selectedIds.has(note.id));
  const apply = (removed: RollNote[], inserted: Note[]) => {
    if (!removed.length && !inserted.length) return;
    const next = clone(project);
    const selection = editTrackNotes(next, track, removed, inserted);
    if (!selection) {
      notify('音符がセクションに収まりません。自動伴奏を編集する場合は先に展開してください。');
      return;
    }
    commit(next);
    select(selection);
  };
  const patchNotes = (transform: (note: RollNote) => Partial<Note> | undefined) => {
    const removed = [],
      inserted = [];
    for (const note of selectedNotes()) {
      const patch = transform(note);
      if (!patch) continue;
      const { sectionId: _sectionId, noteId, ...data } = note;
      removed.push(note);
      inserted.push({
        ...data,
        ...patch,
        id: noteId,
        origin: 'manual' as const,
        locked: patch.locked ?? true,
      });
    }
    apply(removed, inserted);
  };
  const remove = () => {
    apply(selectedNotes(), []);
    setDetail(false);
  };
  const copy = () => copyNotes(copyPhrase(selectedNotes(), keyFor));
  const stamp = (group: Note[], at: number) => {
    const placed = placePhrase(group, at, editLimit);
    if (!placed.length) {
      if (group.length) notify('貼り付け先のパートに音符が収まりません。');
      return;
    }
    apply([], placed);
  };
  const duplicate = () => {
    const group = selectedNotes();
    if (group.length)
      stamp(
        copyPhrase(group, keyFor),
        group.reduce((end, note) => Math.max(end, note.at + note.duration), 0),
      );
  };
  const paste = () => stamp(clipboard, Math.max(0, snap(position, step)));
  const moveSelected = (ticks: number, pitches: number, preview = true) => {
    if (!ticks && !pitches) return;
    const group = selectedNotes();
    const midi = (n: Note) => resolvePitch(n.pitch, keyFor(n.at));
    const boundedTicks = Math.min(
      ...group.map((n) => editLimit - n.at - n.duration),
      Math.max(ticks, ...group.map((n) => -n.at)),
    );
    const boundedPitches = Math.min(
      ...group.map((n) => 127 - midi(n)),
      Math.max(pitches, ...group.map((n) => -midi(n))),
    );
    if (preview && selectedNote && (boundedPitches || boundedTicks))
      audition?.(midi(selectedNote) + boundedPitches);
    patchNotes((n) =>
      moveNote(n, { at: n.at + boundedTicks, midi: midi(n) + boundedPitches }, editLimit, keyFor),
    );
  };
  const keyboardEdit = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || !editable) return;
    if (
      e.target !== e.currentTarget &&
      !(e.target instanceof HTMLElement && e.target.classList.contains('roll-note'))
    )
      return;
    const key = e.key.toLowerCase();
    if ((key === 'contextmenu' || (e.shiftKey && key === 'f10')) && selectedNote) {
      const anchor = [
        ...e.currentTarget.querySelectorAll<HTMLDivElement>('.roll-note[data-selected=true]'),
      ].find((element) => element.dataset.noteId === selectedNote.id);
      if (anchor) {
        e.preventDefault();
        openNoteContext(anchor);
      }
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (key === 'a') select(notes.map((note) => note.id));
      else if (key === 'c' && selectedNote) copy();
      else if (key === 'x' && selectedNote) {
        copy();
        remove();
      } else if (key === 'v' && clipboard.length) paste();
      else if (key === 'd' && selectedNote) duplicate();
      else return;
      e.preventDefault();
      return;
    }
    if (key === 'escape') {
      select([]);
      return;
    }
    if (key === 'p' || key === 'v') {
      setTool(key === 'p' ? 'draw' : 'select');
      return;
    }
    if (!selectedNote) {
      if (e.key === 'Enter' && notes[0]) {
        select([notes[0].id]);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Enter') {
      setDetail(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') remove();
    else if (e.key === 'ArrowLeft') moveSelected(-step, 0);
    else if (e.key === 'ArrowRight') moveSelected(step, 0);
    else if (e.key === 'ArrowUp') moveSelected(0, 1);
    else if (e.key === 'ArrowDown') moveSelected(0, -1);
    else return;
    e.preventDefault();
  };
  const begin = (e: PointerEvent<HTMLDivElement>, n: Note, pitch: number) => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.stopPropagation();
    if (e.pointerType === 'touch' && !selected.includes(n.id)) return;
    if (e.shiftKey) {
      select(selected.includes(n.id) ? selected.filter((id) => id !== n.id) : [...selected, n.id]);
      return;
    }
    if (!selected.includes(n.id)) select([n.id]);
    audition?.(pitch);
    viewport.current?.focus({ preventScroll: true });
    const end = e.currentTarget.getBoundingClientRect().right;
    const override = nextDrag.current?.id === n.id ? nextDrag.current.mode : undefined;
    nextDrag.current = null;
    drag.current = {
      id: n.id,
      x: e.clientX,
      y: e.clientY,
      at: n.at,
      pitch,
      duration: n.duration,
      lastPitch: pitch,
      movement: { ticks: 0, pitches: 0 },
      mode:
        override ??
        (tool === 'resize' ||
        (e.target instanceof Element && e.target.closest('.roll-note-resize')) ||
        (e.pointerType === 'mouse' && end - e.clientX < 8)
          ? 'resize'
          : 'move'),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const startNote = (e: PointerEvent<HTMLDivElement>) => {
    if (
      e.target !== e.currentTarget ||
      e.button !== 0 ||
      !e.isPrimary ||
      tool !== 'draw' ||
      !editable
    )
      return;
    viewport.current?.focus({ preventScroll: true });
    const rect = e.currentTarget.getBoundingClientRect();
    const tick = Math.floor((e.clientX - rect.left) / px);
    const part = rollSection(project, starts, tick);
    if (!part || autoClip(part, track)) return;
    const start = starts.get(part.id)!;
    const end = part === last ? editLimit : start + part.length;
    const midi = 127 - Math.floor((e.clientY - rect.top) / row);
    if (tick >= end || midi < 0 || midi > 127) return;
    const span = startDrawnNote(tick, step, start, end);
    drawing.current = { pointer: e.pointerId, anchor: span.at, start, end, midi };
    setDraftNote({ ...span, midi });
    e.currentTarget.setPointerCapture(e.pointerId);
    audition?.(midi);
  };
  const drawingAt = (event: PointerEvent<HTMLDivElement>) => {
    const drawingNote = drawing.current;
    if (!drawingNote || drawingNote.pointer !== event.pointerId) return null;
    const tick = (event.clientX - event.currentTarget.getBoundingClientRect().left) / px;
    const span = drawnNoteSpan(drawingNote.anchor, tick, step, drawingNote.start, drawingNote.end);
    return { ...span, midi: drawingNote.midi };
  };
  const cancelDrawing = () => {
    if (!drawing.current) return;
    drawing.current = null;
    setDraftNote(null);
  };
  const finishNote = (event: PointerEvent<HTMLDivElement>) => {
    const draft = drawingAt(event);
    if (!draft) return;
    cancelDrawing();
    const note = makeNote(draft.at, draft.duration, draft.midi);
    apply([], [note]);
  };

  return (
    <section className="roll" aria-label="ピアノロール">
      <RollTools
        track={track}
        tool={tool}
        setTool={(next) => {
          nextDrag.current = null;
          setTool(next);
        }}
        auto={auto}
        valid={song.keys.length > 0}
        selected={Boolean(selectedNote)}
        hasNotes={notes.length > 0}
        openDetails={() => setDetail(true)}
        duplicate={duplicate}
        copy={copy}
        paste={paste}
        canPaste={clipboard.length > 0 && editable}
        remove={remove}
        selectAll={() => select(notes.map((note) => note.id))}
        quantize={() =>
          patchNotes((note) =>
            moveNote(note, { at: snap(note.at, step), midi: pitchOf(note) }, editLimit, keyFor),
          )
        }
        step={step}
        setStep={setStep}
        zoom={zoom}
        setZoom={setZoom}
        ghosts={ghosts}
        toggleGhosts={() => setGhosts(!ghosts)}
        generate={() => {
          if (!auto && track.kind === 'melody') {
            openMelody();
            return;
          }
          if (auto) setTool('select');
          else if (
            section.notes[track.id]?.length &&
            !window.confirm('このセクションの編集済みの音符を自動伴奏に置き換えますか？')
          )
            return;
          change((section) => {
            if (auto)
              section.notes[track.id] = materializeNotes(
                song.notes,
                track.id,
                start,
                section.length,
              );
            else delete section.notes[track.id];
          });
        }}
      />
      <div
        className="roll-view"
        data-draw={tool === 'draw' && editable}
        ref={viewport}
        tabIndex={0}
        onKeyDown={keyboardEdit}
        aria-label="音符グリッド"
      >
        <div
          className="roll-content"
          style={{ width: width + keyboard, height: 128 * row + ruler }}
        >
          <RollRuler
            project={project}
            section={section}
            starts={starts}
            chords={visibleChords}
            keyFor={song.keys.length ? keyFor : undefined}
            range={range}
            editLimit={editLimit}
            total={total}
            width={width}
            keyboard={keyboard}
            pixelsPerTick={px}
            step={step}
            seek={seek}
            editTempo={editTempo}
          />
          <div
            className="roll-grid"
            style={{
              width,
              height: 128 * row,
              backgroundSize: `${step * px}px ${row}px, ${zoom}px ${row}px`,
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget && tool !== 'draw') {
                viewport.current?.focus({ preventScroll: true });
                select([]);
              }
            }}
            onPointerDown={startNote}
            onPointerMove={(event) => {
              const draft = drawingAt(event);
              if (draft)
                setDraftNote((previous) =>
                  previous?.at === draft.at && previous.duration === draft.duration
                    ? previous
                    : draft,
                );
            }}
            onPointerUp={finishNote}
            onPointerCancel={cancelDrawing}
            onLostPointerCapture={cancelDrawing}
          >
            {draftNote && (
              <div
                aria-hidden="true"
                className="roll-note roll-note-draft"
                style={{
                  left: draftNote.at * px,
                  top: (127 - draftNote.midi) * row + 2,
                  width: Math.max(4, draftNote.duration * px),
                  background: color,
                }}
              />
            )}
            {guideKey && (
              <ScaleGuide
                keys={song.keys}
                start={0}
                length={total}
                pixelsPerTick={px}
                rowHeight={row}
              />
            )}
            {visibleChords.map((chord) => (
              <i
                key={JSON.stringify([chord.sectionId, chord.id])}
                className="roll-chord"
                style={{ left: chord.at * px }}
              />
            ))}
            {project.sections.slice(1).map((part) => (
              <i
                key={part.id}
                className="roll-section-line"
                style={{ left: starts.get(part.id)! * px }}
              />
            ))}
            {song.notes
              .filter(
                (n) =>
                  n.end > range.first &&
                  n.start < range.last &&
                  (n.trackId === track.id
                    ? autoClip(rollSection(project, starts, n.start)!, track)
                    : ghosts),
              )
              .map((n) => (
                <div
                  key={n.id}
                  className="roll-ghost"
                  style={{
                    left: n.start * px,
                    top: (127 - n.pitch) * row + 2,
                    width: Math.max(2, (n.end - n.start) * px),
                    background:
                      shades[project.tracks.findIndex((t) => t.id === n.trackId) % shades.length],
                    opacity: n.trackId === track.id ? 0.66 : 0.21,
                  }}
                />
              ))}
            {song.keys.length > 0 &&
              notes
                .filter(
                  (note) =>
                    drag.current?.id === note.id ||
                    (note.at + note.duration > range.first && note.at < range.last),
                )
                .map((note) => {
                  const pitch = resolvePitch(note.pitch, keyFor(note.at));
                  const active = selectedIds.has(note.id);
                  const preview = active ? drag.current : null;
                  const at = note.at + (preview?.mode === 'move' ? delta.ticks : 0);
                  const length =
                    note.duration +
                    (preview?.mode === 'resize' && preview.id === note.id ? delta.ticks : 0);
                  const midi = pitch + (preview?.mode === 'move' ? delta.pitches : 0);
                  return (
                    <div
                      {...noteGesture}
                      key={note.id}
                      className="roll-note"
                      data-note-id={note.id}
                      data-selected={active}
                      tabIndex={-1}
                      aria-haspopup="menu"
                      aria-expanded={context?.id === note.id}
                      role="button"
                      title={pitchName(pitch, false, true)}
                      style={{
                        left: at * px,
                        top: (127 - midi) * row + 2,
                        width: Math.max(4, length * px),
                        background: color,
                      }}
                      onPointerDown={(e) => {
                        noteGesture.onPointerDown(e);
                        begin(e, note, pitch);
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!selected.includes(note.id) && !event.shiftKey) {
                          select([note.id]);
                          audition?.(pitch);
                        }
                      }}
                      onDoubleClick={() => {
                        select([note.id]);
                        setDetail(true);
                      }}
                      onPointerMove={(e) => {
                        noteGesture.onPointerMove(e);
                        const g = drag.current;
                        if (!g || g.id !== note.id) return;
                        const ticks = snap((e.clientX - g.x) / px, step);
                        const pitches = Math.round((g.y - e.clientY) / row);
                        const group = selectedNotes();
                        const pitchOf = (n: Note) => resolvePitch(n.pitch, keyFor(n.at));
                        const movement =
                          g.mode === 'resize'
                            ? {
                                ticks: Math.max(
                                  1 - g.duration,
                                  Math.min(
                                    endOf(rollSection(project, starts, g.at)!) - g.at - g.duration,
                                    ticks,
                                  ),
                                ),
                                pitches: 0,
                              }
                            : {
                                ticks: Math.min(
                                  ...group.map((n) => editLimit - n.at - n.duration),
                                  Math.max(ticks, ...group.map((n) => -n.at)),
                                ),
                                pitches: Math.min(
                                  ...group.map((n) => 127 - pitchOf(n)),
                                  Math.max(pitches, ...group.map((n) => -pitchOf(n))),
                                ),
                              };
                        const nextPitch = g.pitch + movement.pitches;
                        g.movement = movement;
                        if (g.lastPitch !== nextPitch) {
                          g.lastPitch = nextPitch;
                          audition?.(nextPitch);
                        }
                        setDelta((previous) =>
                          previous.ticks === movement.ticks && previous.pitches === movement.pitches
                            ? previous
                            : movement,
                        );
                      }}
                      onPointerUp={() => {
                        noteGesture.onPointerUp();
                        const g = drag.current;
                        drag.current = null;
                        if (g?.id === note.id) {
                          if (g.mode === 'resize' && g.movement.ticks)
                            patchNotes((n) =>
                              n.id === g.id
                                ? { duration: n.duration + g.movement.ticks }
                                : undefined,
                            );
                          if (g.mode === 'move')
                            moveSelected(g.movement.ticks, g.movement.pitches, false);
                        }
                        setDelta({ ticks: 0, pitches: 0 });
                      }}
                      onLostPointerCapture={() => {
                        noteGesture.onPointerCancel();
                        drag.current = null;
                        setDelta({ ticks: 0, pitches: 0 });
                      }}
                    >
                      <span>{pitchName(pitch, false, true)}</span>
                      {active && <i aria-hidden="true" className="roll-note-resize" />}
                    </div>
                  );
                })}
            <div ref={cursor} className="roll-playhead" />
          </div>
          <div
            className="roll-keys"
            role="group"
            aria-label="試聴用の鍵盤"
            onKeyDown={(event) => {
              const key = event.target;
              if (!(key instanceof HTMLButtonElement)) return;
              const next =
                event.key === 'ArrowUp'
                  ? key.previousElementSibling
                  : event.key === 'ArrowDown'
                    ? key.nextElementSibling
                    : null;
              if (!(next instanceof HTMLButtonElement)) return;
              event.preventDefault();
              next.focus();
            }}
          >
            {Array.from({ length: 128 }, (_, i) => {
              const midi = 127 - i;
              const name = pitchName(midi, false, true);
              return (
                <button
                  key={midi}
                  type="button"
                  disabled={!audition}
                  tabIndex={midi === Math.min(127, Math.max(0, center)) ? 0 : -1}
                  onClick={() => audition?.(midi)}
                  data-black={name.includes('♯')}
                  data-scale={guideKey !== null && inScale(midi, guideKey)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {context && contextNote && (
        <AppMenu
          id="note-menu-popup"
          anchor={context.anchor}
          close={() => setContext((current) => (current === context ? null : current))}
          groups={[
            {
              label: '音符',
              commands: [
                {
                  label: '移動',
                  icon: MousePointer2,
                  run: () => {
                    select([contextNote.id]);
                    setTool('select');
                    nextDrag.current = { id: contextNote.id, mode: 'move' };
                  },
                },
                {
                  label: '長さを変更',
                  icon: ScissorsLineDashed,
                  run: () => {
                    select([contextNote.id]);
                    setTool('resize');
                    nextDrag.current = { id: contextNote.id, mode: 'resize' };
                  },
                },
                {
                  label: '音符を編集',
                  icon: SlidersHorizontal,
                  run: () => {
                    select([contextNote.id]);
                    setDetail(true);
                  },
                },
                { label: '音符を削除', icon: Trash2, run: () => apply([contextNote], []) },
              ],
            },
          ]}
        />
      )}
      {detail && selectedNote && editable && (
        <Suspense fallback={null}>
          <NoteDialog
            mode={mode}
            note={selectedNote}
            length={endOf(rollSection(project, starts, selectedNote.at)!)}
            keyFor={keyFor}
            update={(patch) => patchNotes((n) => (n.id === selectedNote.id ? patch : undefined))}
            remove={remove}
            close={() => setDetail(false)}
          />
        </Suspense>
      )}
    </section>
  );
}
