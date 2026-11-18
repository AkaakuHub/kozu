import { lazy, memo, Suspense, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { PPQ } from '../../core/types.ts';
import type { Project, RenderedNote } from '../../core/types.ts';
import { ResizeHandle } from '../workbench/ResizeHandle.tsx';
import { arrangementRange, trackRange } from '../../core/preferences.ts';
import type { Preferences } from '../../core/preferences.ts';

const TrackVolumePopup = lazy(() =>
  import('../workbench/TrackVolumePopup.tsx').then((module) => ({
    default: module.TrackVolumePopup,
  })),
);

interface Props {
  project: Project;
  mode: 'light' | 'dark';
  notes: RenderedNote[];
  starts: Map<string, number>;
  active: string;
  choose: (id: string) => void;
  trackId: string;
  selectTrack: (id: string) => void;
  preferences: Preferences;
  updatePreferences: (preferences: Preferences) => void;
  change: (update: (project: Project) => void) => void;
}
export const Arrangement = memo(function Arrangement({
  project,
  mode,
  notes,
  starts,
  active,
  choose,
  trackId,
  selectTrack,
  change,
  preferences,
  updatePreferences,
}: Props) {
  const [popup, setPopup] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const popupTrack = project.tracks.find((track) => track.id === popup?.id);
  const [previewWidth, setWidth] = useState<number>();
  const [previewHeight, setHeight] = useState<number>();
  const small = matchMedia('(max-width: 680px)').matches;
  const width = previewWidth ?? preferences.trackWidth;
  const height = previewHeight ?? preferences.arrangementHeight;
  const occupied = new Map<string, Set<number>>();
  for (const { trackId: id, start } of notes) {
    let bins = occupied.get(id);
    if (!bins) occupied.set(id, (bins = new Set()));
    bins.add(Math.floor(start / PPQ));
  }
  const mix = (id: string, key: 'mute' | 'solo') =>
    change((next) => {
      const track = next.tracks.find((item) => item.id === id)!;
      track[key] = !track[key];
    });
  return (
    <div className="arrangement-pane">
      <section
        className="arrangement-view"
        aria-label="アレンジメント"
        style={height ? { maxHeight: `min(${height}px, 45dvh)` } : undefined}
      >
        <div
          className="arrangement-labels"
          style={width ? { flexBasis: `min(${width}px, 58vw)` } : undefined}
        >
          <div className="arrangement-heading">トラック</div>
          {project.tracks.map((track) => (
            <div key={track.id} className="track-strip" data-active={trackId === track.id}>
              <button
                className="track-name"
                type="button"
                onClick={() => selectTrack(track.id)}
                aria-pressed={trackId === track.id}
              >
                {track.name}
              </button>
              <span className="track-mix">
                <button
                  type="button"
                  className="tool-button"
                  aria-haspopup="dialog"
                  aria-label={`${track.name}の音量ミキサー`}
                  title={`音量 ${Math.round(track.gain * 100)}%`}
                  onClick={(event) => setPopup({ id: track.id, anchor: event.currentTarget })}
                >
                  {track.mute ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                </button>
              </span>
            </div>
          ))}
          <ResizeHandle
            axis="x"
            label="トラック列の幅"
            range={trackRange}
            value={width ?? (small ? 104 : 188)}
            preview={setWidth}
            commit={(trackWidth) => {
              setWidth(undefined);
              updatePreferences({ trackWidth });
            }}
          />
        </div>
        <div className="arrangement-timeline">
          {project.sections.map((section) => {
            const beats = Math.ceil(section.length / PPQ);
            const first = Math.floor(starts.get(section.id)! / PPQ);
            const bins = Math.min(beats, 64);
            return (
              <div
                key={section.id}
                className="arrangement-part"
                data-active={section.id === active}
                style={{ width: Math.max(82, Math.min(beats * 11, 500)) }}
              >
                <button
                  type="button"
                  aria-current={section.id === active}
                  onClick={() => choose(section.id)}
                >
                  <span className="part-index">{first + 1}</span>
                  {section.name}
                </button>
                {project.tracks.map((track) => (
                  <button
                    type="button"
                    key={track.id}
                    className="arrangement-track"
                    aria-label={`${section.name}の${track.name}`}
                    onClick={() => {
                      choose(section.id);
                      selectTrack(track.id);
                    }}
                    data-active={track.id === trackId}
                    data-muted={track.mute}
                  >
                    {Array.from({ length: bins }, (_, i) => {
                      for (
                        let beat = Math.floor((i * beats) / bins);
                        beat < Math.ceil(((i + 1) * beats) / bins);
                        beat++
                      )
                        if (occupied.get(track.id)?.has(first + beat))
                          return (
                            <span
                              key={i}
                              style={{ left: `${(100 * i) / bins}%`, width: `${80 / bins}%` }}
                            />
                          );
                      return null;
                    })}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>
      <ResizeHandle
        axis="y"
        label="アレンジメントの高さ"
        range={arrangementRange}
        value={height ?? (small ? 160 : 204)}
        preview={setHeight}
        commit={(arrangementHeight) => {
          setHeight(undefined);
          updatePreferences({ arrangementHeight });
        }}
      />
      {popupTrack && popup && (
        <Suspense fallback={null}>
          <TrackVolumePopup
            mode={mode}
            track={popupTrack}
            anchor={popup.anchor}
            close={() => setPopup(null)}
            volume={(gain) =>
              change((project) => {
                project.tracks.find((track) => track.id === popupTrack.id)!.gain = gain;
              })
            }
            mute={() => mix(popupTrack.id, 'mute')}
            solo={() => mix(popupTrack.id, 'solo')}
          />
        </Suspense>
      )}
    </div>
  );
});
