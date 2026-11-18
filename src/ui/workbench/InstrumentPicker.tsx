import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react';
import { Button, List, ListItemButton, ListItemText, Stack, TextField } from '@mui/material';
import { instrumentFamilies, instruments } from '../../core/instrument-catalog.ts';
import type { InstrumentProgram } from '../../core/instruments.ts';

export function InstrumentPicker({
  selected,
  choose,
}: {
  selected: InstrumentProgram | undefined;
  choose: (program: InstrumentProgram | undefined) => void;
}) {
  const [family, setFamily] = useState<number | null>(
    selected === undefined ? null : Math.floor(selected / 8),
  );
  const [query, search] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const patches = needle
    ? instruments.filter(
        ({ name, english }) =>
          name.includes(needle) || english.toLocaleLowerCase().includes(needle),
      )
    : instruments.filter((patch) => patch.family === family);
  return (
    <Stack spacing={1}>
      <TextField
        label="音源を検索"
        fullWidth
        value={query}
        onChange={(event) => search(event.target.value)}
      />
      {!needle && family !== null && (
        <Button
          startIcon={<ChevronLeft size={16} />}
          onClick={() => setFamily(null)}
          sx={{ alignSelf: 'start' }}
        >
          {instrumentFamilies[family]}
        </Button>
      )}
      <List
        disablePadding
        aria-label={
          needle ? '検索結果' : family === null ? '音源カテゴリ' : instrumentFamilies[family]
        }
      >
        {!needle && family === null && (
          <>
            <ListItemButton selected={selected === undefined} onClick={() => choose(undefined)}>
              <ListItemText primary="トラックの既定音色" />
              {selected === undefined && <CircleCheck aria-hidden size={16} />}
            </ListItemButton>
            {instrumentFamilies.map((name, index) => (
              <ListItemButton key={name} onClick={() => setFamily(index)}>
                <ListItemText primary={name} />
                <ChevronRight aria-hidden size={16} />
              </ListItemButton>
            ))}
          </>
        )}
        {patches.map(({ program, name }) => (
          <ListItemButton
            key={program}
            selected={selected === program}
            onClick={() => choose(program)}
          >
            <ListItemText primary={name} />
            {selected === program && <CircleCheck aria-hidden size={16} />}
          </ListItemButton>
        ))}
        {needle && patches.length === 0 && <ListItemText primary="該当する音源がありません" />}
      </List>
    </Stack>
  );
}
