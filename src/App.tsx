import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CircleAlert,
  GitBranch,
  CloudUpload,
  FileDown,
  FileMusic,
  FolderOpen,
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
import { hasUncommittedChanges } from './core/history/fingerprint.ts';
import { defaultMasterGain } from './core/preferences.ts';
import { createSection } from './core/presets.ts';
import { growSection, measureTicks } from './core/section-length.ts';
import { sharesScore } from './core/track-mix.ts';
import { sectionStarts, ticksToSeconds, valueAt } from './core/time.ts';
import { clone } from './core/types.ts';
import type { Note, Project, Section } from './core/types.ts';
import { importScore } from './infrastructure/persistence/import-score.ts';
import { loadDraft } from './infrastructure/persistence/project-storage.ts';
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
const ProjectForm = lazy(() =>
  import('./ui/history/ProjectLibrary.tsx').then((module) => ({ default: module.ProjectForm })),
);
const Windows = lazy(() =>
  import('./ui/workbench/Windows.tsx').then((module) => ({ default: module.Windows })),
);

export default function App() {
  const [message, notify] = useState('');
  const session = useProject(notify);
  const { preferences, update: updatePreferences, flush: savePreferences } = usePreferences(notify);
  const appearance = preferences.appearance ?? 'system';
  const scaleGuide = preferences.scaleGuide ?? true;
  const notePreview = preferences.notePreview ?? true;
  const masterGain = preferences.masterGain ?? defaultMasterGain;
  const colorMode = useAppearance(appearance);
  const { project, commit } = session;
  const previousProject = useRef(project);
  const [timelineTick, setTimelineTick] = useState(0);
  const [windowName, open] = useState<WindowName | 'history' | 'commit' | 'registerProject' | null>(
    null,
  );
  const [leaving, setLeaving] = useState(false);
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
  const sectionMeasure = measureTicks(
    song.meters.length
      ? valueAt(song.meters, sectionStart + part.length - 1)
      : project.initialMeter,
  );
  const track = project.tracks.find((item) => item.id === trackId) ?? project.tracks[0]!;
  const hasErrors = song.diagnostics.some((item) => item.severity === 'error');
  const playing = playback === 'playing';

  useEffect(() => player.setMasterGain(masterGain), [player, masterGain]);

  useEffect(() => {
    return () => player.stopAudition();
  }, [player, track.id, track.program, track.guitar.output, notePreview]);

  const change = (update: (project: Project) => void) => {
    const next = clone(project);
    update(next);
    commit(next);
  };
  const changeSection = (update: (section: Section, project: Project) => void) =>
    change((next) => {
      const section = next.sections.find((item) => item.id === part.id)!;
      update(section, next);
      growSection(next, section, sectionMeasure);
    });

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
      if (document.hidden) {
        player.stopAudition();
        stop();
      }
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
      const preview = compile(project, 'preview');
      const issue = preview.diagnostics.find(({ severity }) => severity === 'error');
      if (issue) throw new Error(issue.message);
      await player.play(preview, project, start, end, loop ? first : null, (tick, active) => {
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
  const refreshPlayback = useEffectEvent((previous: Project) => {
    if (hasErrors) stop();
    else if (sharesScore(previous, project)) player.mix(project.tracks);
    else if (playback !== 'stopped') void play(realHead.current);
  });
  useEffect(() => {
    const previous = previousProject.current;
    previousProject.current = project;
    refreshPlayback(previous);
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
      if (
        (!session.working || (await loadDraft(null))) &&
        !window.confirm('端末の下書きを置き換えますか？')
      )
        return;
      const next = await importScore(file);
      await session.replace(next, null);
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
  const add = (name: string, ticks: number, autoExtend: boolean) => {
    const next = clone(project);
    const section = createSection(name, ticks, null);
    if (autoExtend) section.autoExtend = true;
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
    if (!hasErrors) open(session.working ? 'commit' : 'registerProject');
  };
  const goHome = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (
        (await hasUncommittedChanges(project, session.working)) &&
        !window.confirm(
          'コミットしていない変更があります。端末に下書きを残してプロジェクト一覧へ戻りますか？',
        )
      )
        return;
      await Promise.all([session.flush(), savePreferences()]);
      location.assign('/');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setLeaving(false);
    }
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
    windowName !== null || !session.ready || leaving,
  );
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => notify(''), 5500);
    return () => clearTimeout(timeout);
  }, [message]);

  return (
    <main
      className="workbench"
      inert={!session.ready || leaving}
      aria-busy={!session.ready || leaving}
    >
      <MenuBar
        goHome={() => void goHome()}
        menus={[
          {
            label: 'ファイル',
            compact: true,
            commands: [
              {
                label: 'MIDI・JSONを開く',
                icon: FolderOpen,
                shortcut: 'Ctrl/⌘+O',
                run: () => fileInput.current?.click(),
              },
              {
                label: '履歴とブランチ',
                icon: GitBranch,
                disabled: !session.working,
                run: () => open('history'),
              },
              {
                label: session.working ? '譜面をコミット' : 'プロジェクトに保存',
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
            commands: [{ label: 'トラック設定', icon: Guitar, run: () => open('tracks') }],
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
                  !(
                    project.sections.some((section) => section.notes[track.id]?.length) ||
                    project.tracks.some((voice) => voice.harmonySource === track.id)
                  ),
                run: () => open('voice'),
              },
              { label: 'セクション管理', icon: ListMusic, run: () => open('composition') },
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
        masterGain={masterGain}
        previewMasterGain={(gain) => player.setMasterGain(gain)}
        changeMasterGain={(gain) => updatePreferences({ masterGain: gain })}
      />
      <Arrangement
        project={project}
        notes={draft.notes}
        starts={starts}
        active={part.id}
        choose={choosePart}
        trackId={track.id}
        selectTrack={setTrack}
        chooseInstrument={(id) => {
          setTrack(id);
          open('instruments');
        }}
        preferences={preferences}
        updatePreferences={updatePreferences}
        previewVolume={(id, gain) => player.previewGain(project.tracks, id, gain)}
        changeMix={(id, patch) =>
          commit({
            ...project,
            tracks: project.tracks.map((track) =>
              track.id === id ? { ...track, ...patch } : track,
            ),
          })
        }
      />
      <PianoRoll
        key={part.id}
        project={project}
        section={part}
        track={track}
        mode={colorMode}
        start={sectionStart}
        sectionMeasure={sectionMeasure}
        song={draft}
        scaleGuide={scaleGuide}
        audition={
          notePreview
            ? (pitch) => {
                void player.audition(track, pitch).catch((error: unknown) => {
                  notify(error instanceof Error ? error.message : '音を試聴できませんでした。');
                });
              }
            : undefined
        }
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
      {windowName === 'registerProject' && (
        <Suspense fallback={null}>
          <ProjectForm
            project={project}
            mode={colorMode}
            load={async (next, working) => {
              await session.replace(next, working);
              focusProject(next);
            }}
            close={() => open(null)}
          />
        </Suspense>
      )}
      {(windowName === 'history' || windowName === 'commit') && session.working && (
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
      {windowName &&
        windowName !== 'history' &&
        windowName !== 'commit' &&
        windowName !== 'registerProject' && (
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
              scaleGuide={scaleGuide}
              setScaleGuide={(value) => updatePreferences({ scaleGuide: value })}
              notePreview={notePreview}
              setNotePreview={(value) => updatePreferences({ notePreview: value })}
              open={open}
              close={() => open(null)}
              project={project}
              section={part}
              song={song}
              sectionStart={sectionStart}
              sectionMeasure={sectionMeasure}
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
