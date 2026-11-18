import { useEffect, useRef, useState } from 'react';

export function VolumeFader({
  gain,
  label,
  change,
}: {
  gain: number;
  label: string;
  change: (gain: number) => void;
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
    <label className="volume-fader">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={volume}
        aria-valuetext={`${volume}%`}
        onChange={(event) => setVolume(event.target.valueAsNumber)}
        onPointerUp={(event) => apply(event.currentTarget.valueAsNumber)}
        onKeyUp={(event) => apply(event.currentTarget.valueAsNumber)}
        onBlur={(event) => apply(event.currentTarget.valueAsNumber)}
      />
      <output>{volume}%</output>
    </label>
  );
}
