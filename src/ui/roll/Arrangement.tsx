import { memo, useLayoutEffect, useRef, useState } from 'react';
import { TrackMixControls, TrackVolumePopup } from '../workbench/TrackVolumePopup.tsx';
import { ToolButton } from '../workbench/ToolButton.tsx';
import { SlidersHorizontal } from 'lucide-react';
import { PPQ } from '../../core/types.ts';
import type { Project, RenderedNote } from '../../core/types.ts';
import { ResizeHandle } from '../workbench/ResizeHandle.tsx';
import { arrangementRange, trackRange } from '../../core/preferences.ts';
import type { Preferences } from '../../core/preferences.ts';

interface Props {
  project: Project;
  notes: RenderedNote[];
  starts: Map<string, number>;
  active: string;
  choose: (id: string) => void;
  trackId: string;
  selectTrack: (id: string) => void;
  chooseInstrument: (id: string) => void;
  preferences: Preferences;
  updatePreferences: (preferences: Preferences) => void;
  change: (update: (project: Project) => void) => void;
}
export const Arrangement = memo(function Arrangement({
  project,
  notes,
  starts,
  active,
  choose,
  trackId,
  selectTrack,
  chooseInstrument,
  change,
  preferences,
  updatePreferences,
}: Props) {
  const [popup, setPopup] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const popupTrack = project.tracks.find((track) => track.id === popup?.id);
  const labels = useRef<HTMLDivElement>(null);
  const [mixLayout, setMixLayout] = useState<'compact' | 'buttons' | 'full'>('compact');
  const [previewWidth, setWidth] = useState<number>();
  const [previewHeight, setHeight] = useState<number>();
  const small = matchMedia('(max-width: 680px)').matches;
  const width = previewWidth ?? preferences.trackWidth;
  const height = previewHeight ?? preferences.arrangementHeight;
  const showButtons = mixLayout !== 'compact';
  const showFader = mixLayout === 'full';
  useLayoutEffect(() => {
    const column = labels.current;
    if (!column) return;
    const measure = () => {
      const width = column.clientWidth;
      const layout = width >= 220 ? 'full' : width >= 150 ? 'buttons' : 'compact';
      setMixLayout(layout);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    measure();
    return () => observer.disconnect();
  }, []);
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
  const volume = (id: string, gain: number) =>
    change((next) => {
      next.tracks.find((track) => track.id === id)!.gain = gain;
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
          ref={labels}
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
                <TrackMixControls
                  track={track}
                  showButtons={showButtons}
                  showFader={showFader}
                  toggle={(key) => mix(track.id, key)}
                  volume={(gain) => volume(track.id, gain)}
                />
                {(!showFader || track.kind !== 'drums') && (
                  <ToolButton
                    icon={SlidersHorizontal}
                    popup="dialog"
                    popupTarget={popup?.id === track.id ? 'track-volume-popup' : undefined}
                    label={`${track.name}の操作`}
                    onClick={(event) => {
                      event.preventDefault();
                      const anchor = event.currentTarget;
                      setPopup((current) =>
                        current?.id === track.id ? null : { id: track.id, anchor },
                      );
                    }}
                  />
                )}
              </span>
            </div>
          ))}
          <ResizeHandle
            axis="x"
            label="トラック列の幅"
            range={trackRange}
            value={width ?? (small ? 104 : 248)}
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
      {popupTrack && popup && (!showFader || popupTrack.kind !== 'drums') && (
        <TrackVolumePopup
          key={popupTrack.id}
          track={popupTrack}
          anchor={popup.anchor}
          close={() => setPopup((current) => (current === popup ? null : current))}
          volume={(gain) => volume(popupTrack.id, gain)}
          toggle={(key) => mix(popupTrack.id, key)}
          showButtons={!showButtons}
          showFader={!showFader}
          chooseInstrument={
            popupTrack.kind === 'drums'
              ? undefined
              : () => {
                  setPopup(null);
                  chooseInstrument(popupTrack.id);
                }
          }
        />
      )}
    </div>
  );
});
