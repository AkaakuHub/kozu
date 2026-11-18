import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { MuiAppearance } from './MuiAppearance.tsx';

export function TrackDeleteDialog({
  name,
  mode,
  close,
  remove,
}: {
  name: string;
  mode: 'light' | 'dark';
  close: () => void;
  remove: () => void;
}) {
  return (
    <MuiAppearance mode={mode}>
      <Dialog
        open
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby="track-delete-title"
        aria-describedby="track-delete-description"
      >
        <DialogTitle id="track-delete-title">トラックを削除</DialogTitle>
        <DialogContent id="track-delete-description">
          「{name}」と曲全体の音符を削除しますか？
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={close}>
            キャンセル
          </Button>
          <Button color="error" variant="contained" onClick={remove}>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </MuiAppearance>
  );
}
