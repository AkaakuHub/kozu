import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CircleAlert,
  GitBranch,
  CloudUpload,
  FileDown,
  FileMusic,
  FolderOpen,
  FilePlus2,
  FlipHorizontal2,
  Guitar,
  ListMusic,
  LibraryBig,
  Music2,
  AudioLines,
  Plus,
  Redo2,
  SlidersHorizontal,
  Undo2,
  WandSparkles,
} from 'lucide-react';
import { Player } from './audio/player.ts';
import { compile } from './core/compile.ts';
import { exportMidi } from './core/midi.ts';
import { createBlankProject, createSection, generateMelody } from './core/presets.ts';
import { sectionStarts, ticksToSeconds, valueAt } from './core/time.ts';
import { clone } from './core/types.ts';
import type { Note, Project, Section } from './core/types.ts';
import { parseProject } from './core/validate.ts';
import { Arrangement } from './ui/roll/Arrangement.tsx';
import { PianoRoll } from './ui/roll/PianoRoll.tsx';
import { download } from './infrastructure/persistence/download.ts';
import { usePreferences } from './ui/workbench/usePreferences.ts';
import { useAppearance } from './ui/workbench/appearance.ts';
import { useShortcuts } from './ui/workbench/useShortcuts.ts';
import { MenuBar } from './ui/workbench/MenuBar.tsx';
import { Transport } from './ui/workbench/Transport.tsx';
import { useProject } from './ui/workbench/useProject.ts';
import type { WindowName } from './ui/workbench/Windows.tsx';
import './ui/workbench/workbench.css';

const HistoryWindow = lazy(() =>
  import('./ui/history/HistoryWindow.tsx').then((module) => ({ default: module.HistoryWindow })),
);
const Windows = lazy(() =>
  import('./ui/workbench/Windows.tsx').then((module) => ({ default: module.Windows })),
);

export default function App() {
  const [message, notify] = useState('');
  const session = useProject(notify);
  const { preferences, update: updatePreferences } = usePreferences(notify);
  const appearance = preferences.appearance ?? 'system';
  const colorMode = useAppearance(appearance);
  const { project, commit } = session;
  const [timelineTick, setTimelineTick] = useState(0);
  const [windowName, open] = useState<WindowName | 'history' | 'commit' | null>(null);
  const [partId, setPart] = useState('');
  const [trackId, setTrack] = useState('');
  const [head, setHead] = useState(0);
  const [playback, setPlayback] = useState<'stopped' | 'loading' | 'playing'>('stopped');
  const [loop, setLoop] = useState(false);
  const [player] = useState(() => new Player());
  const request = useRef(0);
  const [clipboard, copyNotes] = useState<Note[]>([]);
  const realHead = useRef(0);
  const cursorFrame = useRef<((tick: number) => void) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const song = useMemo(() => compile(project), [project]);
  const draft = useMemo(() => compile(project, 'edit'), [project]);
  const starts = useMemo(() => sectionStarts(project), [project]);
  const part = project.sections.find((item) => item.id === partId) ?? project.sections[0]!;
  const sectionStart = starts.get(part.id)!;
  const track = project.tracks.find((item) => item.id === trackId) ?? project.tracks[0]!;
  const hasErrors = song.diagnostics.some((item) => item.severity === 'error');
  const playing = playback === 'playing';

  const change = (update: (project: Project) => void) => {
    const next = clone(project);
    update(next);
    commit(next);
  };
  const changeSection = (update: (section: Section, project: Project) => void) =>
    change((next) =>
      update(
        next.sections.find((item) => item.id === part.id)!,
        next,
      ),
    );

  const position = (tick: number) => {
    realHead.current = tick;
    setHead(tick);
  };
  const stop = () => {
    request.current++;
    player.stop();
    setHead(realHead.current);
    setPlayback('stopped');
  };
  useEffect(() => {
    const instance = player;
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      void instance.dispose();
    };
  }, []);

  const play = async (at: number) => {
    if (hasErrors) return;
    const id = ++request.current;
    const end = loop ? sectionStart + part.length : song.totalTicks;
    const first = loop ? sectionStart : 0;
    const start = at >= first && at < end ? at : first;
    let labelTick = -1;
    let lastPart = part.id;
    let started = false;
    setPlayback('loading');
    try {
      await player.play(song, project, start, end, loop ? first : null, (tick, active) => {
        if (request.current !== id) return;
        realHead.current = tick;
        cursorFrame.current?.(tick);
        const displayTick = active ? Math.floor(tick / 240) * 240 : tick;
        if (displayTick !== labelTick) {
          labelTick = displayTick;
          setHead(displayTick);
        }
        if (!started || !active) {
          setPlayback(active ? 'playing' : 'stopped');
          started = true;
        }
        if (active && !loop) {
          const current = project.sections.findLast((section) => starts.get(section.id)! <= tick);
          if (current && current.id !== lastPart) {
            lastPart = current.id;
            setPart(lastPart);
          }
        }
      });
    } catch (error) {
      if (request.current !== id) return;
      setPlayback('stopped');
      notify(error instanceof Error ? error.message : String(error));
    }
  };
  const refreshPlayback = useEffectEvent(() => {
    if (hasErrors) stop();
    else if (playback !== 'stopped') void play(realHead.current);
  });
  useEffect(() => {
    refreshPlayback();
  }, [project]);

  const choosePart = (id: string) => {
    stop();
    setPart(id);
    position(starts.get(id) ?? 0);
  };
  const seek = (tick: number) => {
    position(tick);
    if (playback !== 'stopped') void play(tick);
  };
  const focusProject = (next: Project) => {
    stop();
    setPart(next.sections[0]!.id);
    setTrack(next.tracks[0]!.id);
    position(0);
  };
  const openFile = async (file: File) => {
    try {
      if (file.size > 5_000_000) throw new Error('5MB以内のファイルを選択してください。');
      const next = /\.midi?$/i.test(file.name)
        ? (await import('./core/midi-import.ts')).importMidi(
            new Uint8Array(await file.arrayBuffer()),
            file.name.replace(/\.midi?$/i, ''),
          )
        : parseProject(await file.text());
      commit(next);
      focusProject(next);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };
  const midi = () => {
    try {
      const bytes = exportMidi(project, song);
      download(`${project.title || 'song'}.mid`, bytes.buffer as ArrayBuffer, 'audio/midi');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };
  const editTempo = (tick = Math.round(realHead.current - sectionStart)) => {
    setTimelineTick(Math.max(0, Math.min(part.length - 1, tick)));
    open('timeline');
  };
  const add = (name: string, ticks: number) => {
    const next = clone(project);
    const section = createSection(name, ticks);
    const lead = next.tracks.find((item) => item.kind === 'melody');
    if (lead) section.notes[lead.id] = generateMelody(section, lead.id, next.seed);
    next.sections.splice(next.sections.findIndex((item) => item.id === part.id) + 1, 0, section);
    commit(next);
    setPart(section.id);
    position(sectionStart + part.length);
    open(null);
  };
  const togglePlay = () => {
    if (playback === 'stopped') void play(realHead.current);
    else stop();
  };
  const rewind = () => choosePart(project.sections[0]!.id);
  const meter = song.meters.length ? valueAt(song.meters, head) : project.initialMeter;
  const tempo = song.tempos.length ? valueAt(song.tempos, head).bpm : project.initialTempo;

  const saveCloud = () => {
    if (!hasErrors) open('commit');
  };
  const toggleLoop = () => {
    stop();
    setLoop(!loop);
  };
  useShortcuts(
    {
      play: togglePlay,
      rewind,
      open: () => fileInput.current?.click(),
      save: saveCloud,
      undo: () => session.undo?.(),
      redo: () => session.redo?.(),
      loop: toggleLoop,
    },
    windowName !== null || !session.ready,
  );
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => notify(''), 5500);
    return () => clearTimeout(timeout);
  }, [message]);

  return (
    <main className="workbench" inert={!session.ready} aria-busy={!session.ready}>
      <MenuBar
        menus={[
          {
            label: 'ファイル',
            compact: true,
            commands: [
              {
                label: '新規プロジェクト',
                icon: FilePlus2,
                run: () => {
                  const next = createBlankProject();
                  commit(next);
                  focusProject(next);
                },
              },
              {
                label: 'MIDI・JSONを開く',
                icon: FolderOpen,
                shortcut: 'Ctrl/⌘+O',
                run: () => fileInput.current?.click(),
              },
              {
                label: '履歴とブランチ',
                icon: GitBranch,
                run: () => open('history'),
              },
              {
                label: '譜面をコミット',
                icon: CloudUpload,
                shortcut: 'Ctrl/⌘+S',
                disabled: hasErrors,
                run: saveCloud,
              },
              { label: 'MIDIを書き出す', icon: FileMusic, disabled: hasErrors, run: midi },
              {
                label: 'JSONを書き出す',
                icon: FileDown,
                run: () =>
                  download(
                    `${project.title || 'song'}.json`,
                    JSON.stringify(project, null, 2),
                    'application/json',
                  ),
              },
            ],
          },
          {
            label: '編集',
            compact: true,
            commands: [
              {
                label: '取り消す',
                icon: Undo2,
                shortcut: 'Ctrl/⌘+Z',
                disabled: !session.undo,
                run: () => session.undo?.(),
              },
              {
                label: 'やり直す',
                icon: Redo2,
                shortcut: 'Ctrl/⌘+Shift+Z',
                disabled: !session.redo,
                run: () => session.redo?.(),
              },
              {
                label: 'フレーズを変形',
                icon: FlipHorizontal2,
                disabled: !part.notes[track.id]?.length,
                run: () => open('motif'),
              },
            ],
          },
          {
            label: 'トラック',
            commands: [{ label: '楽器の設定', icon: Guitar, run: () => open('tracks') }],
          },
          {
            label: '作曲',
            commands: [
              {
                label: 'パートを追加',
                icon: Plus,
                disabled: project.sections.length >= 128,
                run: () => open('section'),
              },
              {
                label: 'ハモリを作成',
                icon: AudioLines,
                disabled:
                  track.kind === 'drums' ||
                  !part.notes[track.id]?.length ||
                  project.tracks.length >= 16 ||
                  project.tracks.filter((item) => item.kind !== 'drums').length >= 15,
                run: () => open('voice'),
              },
              { label: '曲の構成', icon: ListMusic, run: () => open('composition') },
              { label: 'コード進行', icon: Music2, run: () => open('harmony') },
              { label: 'コード進行ライブラリ', icon: LibraryBig, run: () => open('progressions') },
              { label: '作曲技法', icon: WandSparkles, run: () => open('technique') },
              { label: 'テンポ・キー・拍子', icon: Activity, run: () => editTempo() },
            ],
          },
          {
            label: '表示',
            commands: [
              { label: '設定', icon: SlidersHorizontal, run: () => open('settings') },
              { label: '曲の検証', icon: CircleAlert, run: () => open('diagnostics') },
              ...(session.storageBlocked
                ? [
                    {
                      label: '端末への保存を再開',
                      icon: SlidersHorizontal,
                      run: () => {
                        if (window.confirm('端末に保存された曲を現在の曲で上書きしますか？'))
                          session.resumeSaving();
                      },
                    },
                  ]
                : []),
            ],
          },
        ]}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".mid,.midi,audio/midi,application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openFile(file);
          event.target.value = '';
        }}
      />
      <Transport
        playing={playing}
        loading={playback === 'loading'}
        disabled={hasErrors}
        loop={loop}
        elapsed={ticksToSeconds(head, song.tempos)}
        duration={ticksToSeconds(song.totalTicks, song.tempos)}
        tempo={tempo}
        editTempo={() => editTempo()}
        meter={`${meter.numerator}/${meter.denominator}`}
        toggle={togglePlay}
        toggleLoop={() => {
          toggleLoop();
        }}
        rewind={rewind}
      />
      <Arrangement
        project={project}
        notes={draft.notes}
        starts={starts}
        active={part.id}
        choose={choosePart}
        trackId={track.id}
        selectTrack={setTrack}
        preferences={preferences}
        updatePreferences={updatePreferences}
        change={change}
      />
      <PianoRoll
        key={part.id}
        project={project}
        section={part}
        track={track}
        mode={colorMode}
        start={sectionStart}
        song={draft}
        playhead={head}
        cursorFrame={cursorFrame}
        cursorTick={realHead}
        clipboard={clipboard}
        copyNotes={copyNotes}
        notify={notify}
        playing={playing}
        seek={seek}
        editTempo={editTempo}
        generateMelody={() => open('melody')}
        change={changeSection}
      />
      <footer className="work-status">
        <span>
          {part.name}
          <span aria-hidden="true"> / </span>
          {track.name}
        </span>
        {hasErrors ? (
          <span role="status">譜面にエラーがあります</span>
        ) : (
          <span role="status">
            {!session.ready
              ? '譜面を復元中'
              : session.storageBlocked
                ? '端末への保存を停止'
                : session.saved
                  ? '端末に保存済み'
                  : '未保存'}
          </span>
        )}
      </footer>
      {(windowName === 'history' || windowName === 'commit') && (
        <Suspense fallback={null}>
          <HistoryWindow
            mode={colorMode}
            project={project}
            working={session.working}
            mark={session.mark}
            load={(next, working) => {
              commit(next);
              session.mark(working);
              focusProject(next);
            }}
            close={() => open(null)}
            commitMode={windowName === 'commit'}
          />
        </Suspense>
      )}
      {windowName && windowName !== 'history' && windowName !== 'commit' && (
        <Suspense fallback={null}>
          <Windows
            key={windowName}
            view={windowName}
            timelineTick={timelineTick}
            track={track}
            working={session.working}
            mode={colorMode}
            appearance={appearance}
            setAppearance={(value) => updatePreferences({ appearance: value })}
            open={open}
            close={() => open(null)}
            project={project}
            section={part}
            song={song}
            sectionStart={sectionStart}
            commit={commit}
            change={change}
            changeSection={changeSection}
            setSelected={(id) => {
              setPart(id);
              position(starts.get(id) ?? sectionStart);
            }}
            add={add}
          />
        </Suspense>
      )}
      {message && (
        <div role="status" className="work-toast" onClick={() => notify('')}>
          {message}
        </div>
      )}
    </main>
  );
}
