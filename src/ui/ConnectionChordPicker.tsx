import { Button, Stack } from '@mui/material';
import { useState } from 'react';
import { connectionChords } from '../core/harmony-techniques.ts';
import { chordName } from '../core/theory.ts';
import type { Chord, Key } from '../core/types.ts';
import { KeyFields, Panel } from './shared.tsx';

export function ConnectionChordPicker({
  chord,
  current,
  destination,
  close,
  apply,
}: {
  chord: Chord;
  current: Key;
  destination: Key;
  close: () => void;
  apply: (patch: Partial<Chord>) => void;
}) {
  const [target, setTarget] = useState(destination);
  const candidates = connectionChords(current, target);
  const choose = (patch: Partial<Chord>) => {
    apply(patch);
    close();
  };
  return (
    <Panel title="接続和音 · 移行先のキー">
      <Stack gap={1}>
        <KeyFields value={target} onChange={setTarget} />
        <Stack gap={1} direction="row" flexWrap="wrap">
          {candidates?.common.map((patch) => {
            const name = chordName({ ...chord, ...patch }, current);
            return (
              <Button key={name} variant="outlined" onClick={() => choose(patch)}>
                {name}
              </Button>
            );
          })}
          {candidates && (
            <Button variant="outlined" onClick={() => choose(candidates.dominant)}>
              {chordName({ ...chord, ...candidates.dominant }, target)} · 移行先の属七
            </Button>
          )}
          <Button onClick={close}>キャンセル</Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
