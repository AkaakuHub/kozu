import { Button, Popover } from '@mui/material';
import type { Track } from '../../core/types.ts';
import { MuiAppearance } from './MuiAppearance.tsx';
import { VolumeFader } from './VolumeFader.tsx';

export function TrackVolumePopup({
  track,
  anchor,
  mode,
  close,
  volume,
  mute,
  solo,
}: {
  track: Track;
  anchor: HTMLElement;
  mode: 'light' | 'dark';
  close: () => void;
  volume: (gain: number) => void;
  mute: () => void;
  solo: () => void;
}) {
  return (
    <MuiAppearance mode={mode}>
      <Popover
        open
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <section
          role="dialog"
          aria-label={`${track.name}のミキサー`}
          className="track-volume-popup"
        >
          <VolumeFader gain={track.gain} label={`${track.name}の音量`} change={volume} />
          <div>
            <Button
              aria-pressed={track.mute}
              variant={track.mute ? 'contained' : 'text'}
              onClick={mute}
            >
              ミュート
            </Button>
            <Button
              aria-pressed={track.solo}
              variant={track.solo ? 'contained' : 'text'}
              onClick={solo}
            >
              ソロ
            </Button>
          </div>
        </section>
      </Popover>
    </MuiAppearance>
  );
}
