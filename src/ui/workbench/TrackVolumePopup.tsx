import { Drum, Headphones, Piano, VolumeX } from 'lucide-react';
import type { Track } from '../../core/types.ts';
import { AnchoredPopup } from './AnchoredPopup.tsx';
import { ToolButton } from './ToolButton.tsx';
import { VolumeFader } from './VolumeFader.tsx';

interface MixControls {
  track: Track;
  volume: (gain: number) => void;
  previewVolume: (gain: number) => void;
  toggle: (key: 'mute' | 'solo') => void;
  showButtons: boolean;
  showFader: boolean;
  chooseInstrument?: (() => void) | undefined;
}

export function TrackMixControls({
  track,
  volume,
  previewVolume,
  toggle,
  showButtons,
  showFader,
  chooseInstrument,
}: MixControls) {
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
      {chooseInstrument && (
        <ToolButton
          icon={track.kind === 'drums' ? Drum : Piano}
          label={`${track.name}の音源ライブラリ`}
          tooltip="音源ライブラリ"
          onClick={chooseInstrument}
        />
      )}
      {showFader && (
        <VolumeFader
          gain={track.gain}
          label={`${track.name}の音量`}
          change={volume}
          preview={previewVolume}
        />
      )}
    </>
  );
}

export function TrackVolumePopup({
  anchor,
  close,
  ...controls
}: MixControls & {
  anchor: HTMLElement;
  close: () => void;
}) {
  return (
    <AnchoredPopup
      id="track-volume-popup"
      role="dialog"
      label={`${controls.track.name}のミキサー`}
      anchor={anchor}
      close={close}
    >
      <section className="volume-popup">
        <TrackMixControls {...controls} />
      </section>
    </AnchoredPopup>
  );
}
