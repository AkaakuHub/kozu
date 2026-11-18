import { Headphones, Piano, VolumeX } from 'lucide-react';
import type { Track } from '../../core/types.ts';
import { AnchoredPopup } from './AnchoredPopup.tsx';
import { ToolButton } from './ToolButton.tsx';
import { VolumeFader } from './VolumeFader.tsx';

interface MixControls {
  track: Track;
  volume: (gain: number) => void;
  toggle: (key: 'mute' | 'solo') => void;
  showButtons: boolean;
  showFader: boolean;
}

export function TrackMixControls({ track, volume, toggle, showButtons, showFader }: MixControls) {
  return (
    <>
      {showButtons && (
        <>
          <ToolButton
            icon={VolumeX}
            label={`${track.name}をミュート`}
            tooltip="ミュート"
            pressed={track.mute}
            onClick={() => toggle('mute')}
          />
          <ToolButton
            icon={Headphones}
            label={`${track.name}をソロ`}
            tooltip="ソロ"
            pressed={track.solo}
            onClick={() => toggle('solo')}
          />
        </>
      )}
      {showFader && <VolumeFader gain={track.gain} label={`${track.name}の音量`} change={volume} />}
    </>
  );
}

export function TrackVolumePopup({
  anchor,
  close,
  chooseInstrument,
  ...controls
}: MixControls & {
  anchor: HTMLElement;
  close: () => void;
  chooseInstrument: (() => void) | undefined;
}) {
  return (
    <AnchoredPopup
      id="track-volume-popup"
      role="dialog"
      label={`${controls.track.name}のミキサー`}
      anchor={anchor}
      close={close}
    >
      <section className="track-volume-popup">
        <TrackMixControls {...controls} />
        {chooseInstrument && (
          <ToolButton icon={Piano} label="音源ライブラリ" onClick={chooseInstrument} />
        )}
      </section>
    </AnchoredPopup>
  );
}
