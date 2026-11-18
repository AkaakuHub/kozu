import { LoaderCircle, Pause, Play, Repeat2, SkipBack } from 'lucide-react';
import { ToolButton } from './ToolButton.tsx';
import { secondsLabel } from './time-label.ts';

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
}) {
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
