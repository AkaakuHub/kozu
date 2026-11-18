import { LoaderCircle, Pause, Play, Repeat2, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { AnchoredPopup } from './AnchoredPopup.tsx';
import { ToolButton } from './ToolButton.tsx';
import { secondsLabel } from './time-label.ts';
import { VolumeFader } from './VolumeFader.tsx';

export function Transport({
  playing,
  loading,
  loop,
  disabled,
  elapsed,
  duration,
  tempo,
  editTempo,
  meter,
  toggle,
  toggleLoop,
  rewind,
  masterGain,
  previewMasterGain,
  changeMasterGain,
}: {
  playing: boolean;
  loading: boolean;
  loop: boolean;
  disabled: boolean;
  elapsed: number;
  duration: number;
  tempo: number;
  editTempo: () => void;
  meter: string;
  toggle: () => void;
  toggleLoop: () => void;
  rewind: () => void;
  masterGain: number;
  previewMasterGain: (gain: number) => void;
  changeMasterGain: (gain: number) => void;
}) {
  const [volumeAnchor, setVolumeAnchor] = useState<HTMLElement | null>(null);
  return (
    <div className="transport" aria-label="再生">
      <div className="tool-group">
        <ToolButton icon={SkipBack} label="曲の先頭へ" onClick={rewind} />
        <ToolButton
          icon={loading ? LoaderCircle : playing ? Pause : Play}
          label={loading ? '音源の読み込みを中止' : playing ? '一時停止 (Space)' : '再生 (Space)'}
          primary
          disabled={disabled}
          onClick={toggle}
        />
        <ToolButton icon={Repeat2} label="パートをループ" pressed={loop} onClick={toggleLoop} />
        <ToolButton
          icon={masterGain === 0 ? VolumeX : Volume2}
          label="マスター音量"
          popup="dialog"
          popupTarget={volumeAnchor ? 'master-volume-popup' : undefined}
          onClick={(event) => {
            event.preventDefault();
            const anchor = event.currentTarget;
            setVolumeAnchor((open) => (open ? null : anchor));
          }}
        />
        {volumeAnchor && (
          <AnchoredPopup
            id="master-volume-popup"
            role="dialog"
            label="マスター音量"
            anchor={volumeAnchor}
            close={() => setVolumeAnchor(null)}
          >
            <div className="volume-popup">
              <VolumeFader
                gain={masterGain}
                label="マスター音量"
                change={changeMasterGain}
                preview={previewMasterGain}
              />
            </div>
          </AnchoredPopup>
        )}
      </div>
      <div className="transport-readout">
        <span>
          {secondsLabel(elapsed)} <small>/ {secondsLabel(duration)}</small>
        </span>
        <button
          type="button"
          className="tempo-button"
          onClick={editTempo}
          aria-label="現在位置のBPMを変更"
        >
          {Number(tempo.toFixed(1))} <small>BPM</small>
        </button>
        <span className="transport-meter">{meter}</span>
      </div>
    </div>
  );
}
