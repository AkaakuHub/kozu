import type { Track } from '../../core/types.ts';
import { AnchoredPopup } from './AnchoredPopup.tsx';
import { VolumeFader } from './VolumeFader.tsx';

export function TrackVolumePopup({
  track,
  anchor,
  close,
  volume,
  mute,
  solo,
}: {
  track: Track;
  anchor: HTMLElement;
  close: () => void;
  volume: (gain: number) => void;
  mute: () => void;
  solo: () => void;
}) {
  return (
    <AnchoredPopup
      id="track-volume-popup"
      role="dialog"
      label={`${track.name}のミキサー`}
      anchor={anchor}
      close={close}
    >
      <section className="track-volume-popup">
        <VolumeFader gain={track.gain} label={`${track.name}の音量`} change={volume} />
        <div>
          <button type="button" aria-pressed={track.mute} onClick={mute}>
            ミュート
          </button>
          <button type="button" aria-pressed={track.solo} onClick={solo}>
            ソロ
          </button>
        </div>
      </section>
    </AnchoredPopup>
  );
}
