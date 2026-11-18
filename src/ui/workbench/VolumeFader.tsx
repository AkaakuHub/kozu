import { useEffect, useRef, useState } from 'react';

export function VolumeFader({
  gain,
  label,
  change,
  preview,
}: {
  gain: number;
  label: string;
  change: (gain: number) => void;
  preview: (gain: number) => void;
}) {
  const [volume, setVolume] = useState(Math.round(gain * 100));
  const committed = useRef(volume);
  useEffect(() => {
    const next = Math.round(gain * 100);
    setVolume(next);
    committed.current = next;
  }, [gain]);
  const apply = (next: number) => {
    if (committed.current === next) return;
    committed.current = next;
    change(next / 100);
  };
  return (
    <input
      className="volume-fader"
      aria-label={label}
      type="range"
      min={0}
      max={100}
      step={1}
      value={volume}
      aria-valuetext={`${volume}%`}
      onChange={(event) => {
        const next = event.target.valueAsNumber;
        setVolume(next);
        preview(next / 100);
      }}
      onPointerUp={(event) => apply(event.currentTarget.valueAsNumber)}
      onPointerCancel={() => {
        setVolume(committed.current);
        preview(committed.current / 100);
      }}
      onKeyUp={(event) => apply(event.currentTarget.valueAsNumber)}
      onBlur={(event) => apply(event.currentTarget.valueAsNumber)}
    />
  );
}
