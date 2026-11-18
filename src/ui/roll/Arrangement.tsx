import { memo, useLayoutEffect, useRef, useState } from 'react';
import { TrackMixControls, TrackVolumePopup } from '../workbench/TrackVolumePopup.tsx';
import { ToolButton } from '../workbench/ToolButton.tsx';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { AppMenu } from '../workbench/AppMenu.tsx';
import { TrackName } from './TrackName.tsx';
import { PPQ } from '../../core/types.ts';
import type { Project, RenderedNote } from '../../core/types.ts';
import type { TrackMix } from '../../core/track-mix.ts';
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
  changeMix: (id: string, patch: Partial<TrackMix>) => void;
  previewVolume: (id: string, gain: number) => void;
  requestDelete: (id: string) => void;
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
  changeMix,
  previewVolume,
  preferences,
  updatePreferences,
  requestDelete,
}: Props) {
  const [popup, setPopup] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const popupTrack = project.tracks.find((track) => track.id === popup?.id);
  const [context, setContext] = useState<{ id: string; anchor: HTMLButtonElement } | null>(null);
  const contextTrack = project.tracks.find((track) => track.id === context?.id);
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
      if (layout === 'full') setPopup(null);
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
  const mix = (track: Project['tracks'][number], key: 'mute' | 'solo') =>
    changeMix(track.id, { [key]: !track[key] });
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
              <TrackName
                name={track.name}
                selected={trackId === track.id}
                expanded={context?.id === track.id}
                select={() => selectTrack(track.id)}
                open={(anchor) => setContext({ id: track.id, anchor })}
              />
              <span className="track-mix">
                <TrackMixControls
                  track={track}
                  showButtons={showButtons}
                  showFader={showFader}
                  chooseInstrument={
                    showButtons && track.kind !== 'drums'
                      ? () => chooseInstrument(track.id)
                      : undefined
                  }
                  toggle={(key) => mix(track, key)}
                  volume={(gain) => changeMix(track.id, { gain })}
                  previewVolume={(gain) => previewVolume(track.id, gain)}
                />
                {!showFader && (
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
      {context && contextTrack && (
        <AppMenu
          id="track-menu-popup"
          anchor={context.anchor}
          close={() => setContext((current) => (current === context ? null : current))}
          groups={[
            {
              label: contextTrack.name,
              commands: [
                {
                  label: 'トラックを削除',
                  icon: Trash2,
                  disabled: project.tracks.length <= 1,
                  run: () => requestDelete(contextTrack.id),
                },
              ],
            },
          ]}
        />
      )}
      {popupTrack && popup && !showFader && (
        <TrackVolumePopup
          key={popupTrack.id}
          track={popupTrack}
          anchor={popup.anchor}
          close={() => setPopup((current) => (current === popup ? null : current))}
          volume={(gain) => changeMix(popupTrack.id, { gain })}
          previewVolume={(gain) => previewVolume(popupTrack.id, gain)}
          toggle={(key) => mix(popupTrack, key)}
          showButtons={!showButtons}
          showFader={!showFader}
          chooseInstrument={
            showButtons || popupTrack.kind === 'drums'
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
