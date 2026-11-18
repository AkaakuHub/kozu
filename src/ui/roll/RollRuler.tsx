import { chordName } from '../../core/theory.ts';
import { PPQ } from '../../core/types.ts';
import type { Chord, Key, Project, Section } from '../../core/types.ts';

interface Props {
  project: Project;
  section: Section;
  starts: Map<string, number>;
  chords: (Chord & { sectionId: string })[];
  keyFor: ((tick: number) => Key) | undefined;
  range: { first: number; last: number };
  editLimit: number;
  total: number;
  width: number;
  keyboard: number;
  pixelsPerTick: number;
  step: number;
  seek: (tick: number) => void;
  editTempo: (tick: number) => void;
}

export function RollRuler({
  project,
  section,
  starts,
  chords,
  keyFor,
  range,
  editLimit,
  total,
  width,
  keyboard,
  pixelsPerTick: px,
  step,
  seek,
  editTempo,
}: Props) {
  return (
    <div className="roll-ruler" style={{ width: width + keyboard }}>
      <span className="roll-corner">MIDI</span>
      <div
        className="roll-time"
        style={{ width }}
        onClick={(e) => {
          const tick =
            Math.round((e.clientX - e.currentTarget.getBoundingClientRect().left) / px / step) *
            step;
          seek(Math.min(total - 1, Math.max(0, tick)));
        }}
      >
        {!project.tempoChanges.some(
          (event) => starts.get(event.at.sectionId) === 0 && event.at.tick === 0,
        ) && (
          <button
            className="roll-tempo"
            type="button"
            style={{ left: 0 }}
            onClick={(event) => {
              event.stopPropagation();
              editTempo(0);
            }}
          >
            {project.initialTempo} BPM
          </button>
        )}
        {project.tempoChanges.map((event) => (
          <button
            className="roll-tempo"
            type="button"
            key={event.id}
            style={{ left: (starts.get(event.at.sectionId)! + event.at.tick) * px }}
            onClick={(click) => {
              click.stopPropagation();
              editTempo(starts.get(event.at.sectionId)! + event.at.tick);
            }}
          >
            {Number(event.bpm.toFixed(1))}
            {event.ramp ? ` → ${Number(event.ramp.toBpm.toFixed(1))}` : ''} BPM
          </button>
        ))}
        {keyFor &&
          chords.map((chord) => (
            <strong
              key={JSON.stringify([chord.sectionId, chord.id])}
              style={{ left: chord.at * px, width: chord.duration * px }}
            >
              {chordName(chord, keyFor(chord.at))}
            </strong>
          ))}
        {project.sections.map((part) => (
          <button
            type="button"
            key={part.id}
            className="roll-section"
            aria-current={part.id === section.id ? 'location' : undefined}
            style={{ left: starts.get(part.id)! * px, width: part.length * px }}
            onClick={(event) => {
              event.stopPropagation();
              seek(starts.get(part.id)!);
            }}
          >
            {part.name}
          </button>
        ))}
        {Array.from(
          {
            length: Math.max(
              0,
              Math.min(Math.ceil(editLimit / PPQ), Math.ceil(range.last / PPQ)) -
                Math.floor(range.first / PPQ),
            ),
          },
          (_, index) => Math.floor(range.first / PPQ) + index,
        ).map((i) => (
          <span key={i} style={{ left: i * PPQ * px }}>
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
