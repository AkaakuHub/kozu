import {
  CheckCheck,
  Copy,
  CopyPlus,
  ClipboardPaste,
  Layers3,
  MousePointer2,
  Pencil,
  ListFilter,
  Magnet,
  ScissorsLineDashed,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
  ZoomIn,
} from 'lucide-react';
import { ToolButton } from '../workbench/ToolButton.tsx';
import type { Track } from '../../core/types.ts';
import { PPQ } from '../../core/types.ts';

export type RollTool = 'select' | 'draw' | 'resize';

interface Props {
  track: Track;
  tool: RollTool;
  setTool: (tool: RollTool) => void;
  auto: boolean;
  valid: boolean;
  selected: boolean;
  hasNotes: boolean;
  openDetails: () => void;
  duplicate: () => void;
  copy: () => void;
  paste: () => void;
  canPaste: boolean;
  remove: () => void;
  selectAll: () => void;
  quantize: () => void;
  step: number;
  setStep: (step: number) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  ghosts: boolean;
  toggleGhosts: () => void;
  generate: () => void;
}
export function RollTools({
  track,
  tool,
  setTool,
  auto,
  valid,
  selected,
  hasNotes,
  openDetails,
  duplicate,
  copy,
  paste,
  canPaste,
  remove,
  selectAll,
  quantize,
  step,
  setStep,
  zoom,
  setZoom,
  ghosts,
  toggleGhosts,
  generate,
}: Props) {
  return (
    <div className="roll-tools">
      <div className="tool-group" role="group" aria-label="編集モード">
        <ToolButton
          icon={MousePointer2}
          label="選択と移動"
          pressed={tool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolButton
          icon={Pencil}
          label="音符を追加"
          disabled={!valid}
          pressed={tool === 'draw'}
          onClick={() => setTool('draw')}
        />
        <ToolButton
          icon={ScissorsLineDashed}
          label="音符の長さを変更"
          disabled={!valid}
          pressed={tool === 'resize'}
          onClick={() => setTool('resize')}
        />
      </div>
      <div className="tool-group note-actions" role="group" aria-label="音符の操作">
        <ToolButton
          icon={SlidersHorizontal}
          label="選択した音符の詳細"
          disabled={!selected}
          onClick={openDetails}
        />
        <ToolButton
          icon={CopyPlus}
          label="選択した音符を複製 (Ctrl/⌘+D)"
          disabled={!selected}
          onClick={duplicate}
        />
        <ToolButton
          icon={Copy}
          label="音符をコピー (Ctrl/⌘+C)"
          disabled={!selected}
          onClick={copy}
        />
        <ToolButton
          icon={ClipboardPaste}
          label="再生位置に貼り付け (Ctrl/⌘+V)"
          disabled={!canPaste}
          onClick={paste}
        />
        <ToolButton
          icon={Trash2}
          label="選択した音符を削除"
          disabled={!selected}
          onClick={remove}
        />
        <ToolButton
          icon={CheckCheck}
          label="すべての音符を選択"
          disabled={!hasNotes}
          onClick={selectAll}
        />
        <ToolButton
          icon={Magnet}
          label="選択した音符をクオンタイズ"
          disabled={!selected}
          onClick={quantize}
        />
      </div>
      <label className="roll-field">
        <ListFilter aria-hidden="true" size={15} />
        <select
          aria-label="スナップ"
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        >
          {(
            [
              [32, '1/32'],
              [24, '1/16 三連'],
              [16, '1/16'],
              [12, '1/8 三連'],
              [8, '1/8'],
              [6, '1/4 三連'],
              [4, '1/4'],
              [2, '1/2'],
            ] as const
          ).map(([division, label]) => (
            <option key={division} value={(PPQ * 4) / division}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="roll-field zoom-field">
        <ZoomIn aria-hidden="true" size={16} />
        <input
          aria-label="横方向のズーム"
          type="range"
          min={24}
          max={240}
          step={8}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
      <ToolButton
        icon={Layers3}
        label="他トラックの音符を表示"
        pressed={ghosts}
        onClick={toggleGhosts}
      />
      {auto ? (
        <button type="button" className="roll-command" disabled={!valid} onClick={generate}>
          <WandSparkles size={16} aria-hidden="true" />
          伴奏を展開
        </button>
      ) : (
        <ToolButton
          icon={WandSparkles}
          label={track.kind === 'melody' ? '旋律を生成' : '自動伴奏に戻す'}
          onClick={generate}
        />
      )}
    </div>
  );
}
