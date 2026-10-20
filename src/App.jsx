import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { emptyProject, historyReducer, projectDuration, uid, videoClipAt } from './store.js';
import MediaLibrary from './components/MediaLibrary.jsx';
import Preview from './components/Preview.jsx';
import Timeline from './components/Timeline.jsx';
import Inspector from './components/Inspector.jsx';
import ExportDialog from './components/ExportDialog.jsx';

export default function App() {
  const [state, dispatch] = useReducer(historyReducer, { past: [], present: emptyProject(), future: [] });
  const project = state.present;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState(null); // { track, id }
  const [exporting, setExporting] = useState(null);
  const duration = projectDuration(project);

  const [seekVer, setSeekVer] = useState(0);
  const seek = useCallback((t) => {
    setTime(Math.max(0, t));
    setSeekVer((v) => v + 1);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) return setPlaying(false);
    if (time >= duration - 0.05) setTime(0);
    if (duration > 0) setPlaying(true);
  }, [playing, time, duration]);

  const importMedia = async () => {
    const items = await window.api.importMedia();
    const ok = items.filter((i) => !i.error).map((i) => ({ ...i, id: uid() }));
    const bad = items.filter((i) => i.error);
    if (bad.length) alert('Ma t9drch tdkhol:\n' + bad.map((b) => `${b.name}: ${b.error}`).join('\n'));
    if (ok.length) dispatch({ type: 'addMedia', items: ok });
  };

  const addToTimeline = (mediaId) => {
    const clipId = uid();
    dispatch({ type: 'addToTimeline', mediaId, clipId, at: time });
    const m = project.media.find((x) => x.id === mediaId);
    setSelection({ track: m.type === 'video' ? 'video' : 'audio', id: clipId });
  };

  const addText = () => {
    const clipId = uid();
    dispatch({ type: 'addText', clipId, at: time });
    setSelection({ track: 'text', id: clipId });
  };

  const split = useCallback(() => {
    let target = selection;
    if (!target) {
      const v = videoClipAt(project, time);
      if (v) target = { track: 'video', id: v.clip.id };
    }
    if (target) dispatch({ type: 'split', track: target.track, id: target.id, t: time, newId: uid() });
  }, [selection, project, time]);

  const remove = useCallback(() => {
    if (!selection) return;
    dispatch({ type: 'delete', ...selection });
    setSelection(null);
  }, [selection]);

  const save = async () => {
    await window.api.saveProject(JSON.stringify(project, null, 2));
  };

  const open = async () => {
    const json = await window.api.openProject();
    if (!json) return;
    try {
      dispatch({ type: 'load', project: JSON.parse(json) });
      setTime(0);
      setSelection(null);
    } catch (e) {
      alert('Fichier ghalat: ' + e.message);
    }
  };

  const startExport = async () => {
    if (!project.videoClips.length) return alert('Zid chi vidéo l-timeline 9bel l-export.');
    setPlaying(false);
    setExporting({ progress: 0 });
    const off = window.api.onExportProgress((p) => setExporting((e) => e && { ...e, progress: p }));
    const res = await window.api.exportVideo(project);
    off();
    if (res.canceled) return setExporting(null);
    setExporting(res.ok ? { done: true, file: res.file, progress: 1 } : { error: res.error });
  };

  // Hook used by the automated smoke test (electron/smoke.cjs).
  useEffect(() => {
    window.__fve = {
      load: (p) => dispatch({ type: 'load', project: p }),
      seek,
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      select: setSelection,
      dispatch,
    };
  }, [seek]);

  // Keyboard shortcuts (CapCut-like).
  const keys = useRef({});
  keys.current = { togglePlay, split, remove, seek, time };
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const k = keys.current;
      if (e.code === 'Space') { e.preventDefault(); k.togglePlay(); }
      else if ((e.ctrlKey && e.key.toLowerCase() === 'b') || e.key.toLowerCase() === 's' && !e.ctrlKey) { e.preventDefault(); k.split(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') k.remove();
      else if (e.ctrlKey && e.key.toLowerCase() === 'z') dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') dispatch({ type: 'redo' });
      else if (e.key === 'ArrowLeft') k.seek(k.time - (e.shiftKey ? 1 : 1 / 30));
      else if (e.key === 'ArrowRight') k.seek(k.time + (e.shiftKey ? 1 : 1 / 30));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">▶ Free Video Editor</div>
        <div className="actions">
          <button onClick={open}>Open</button>
          <button onClick={save}>Save</button>
          <button onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length} title="Ctrl+Z">↶</button>
          <button onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length} title="Ctrl+Y">↷</button>
          <button className="primary" onClick={startExport}>Export MP4</button>
        </div>
      </header>

      <div className="workspace">
        <MediaLibrary media={project.media} onImport={importMedia} onAdd={addToTimeline} onAddText={addText}
          onRemove={(id) => dispatch({ type: 'removeMedia', id })} />
        <Preview project={project} time={time} seekVer={seekVer} playing={playing} duration={duration}
          onTime={setTime} onEnd={() => setPlaying(false)} onTogglePlay={togglePlay} />
        <Inspector project={project} selection={selection} dispatch={dispatch} />
      </div>

      <Timeline project={project} time={time} duration={duration} selection={selection}
        onSelect={setSelection} onSeek={seek} dispatch={dispatch}
        onSplit={split} onDelete={remove} onAddText={addText} />

      {exporting && <ExportDialog state={exporting} onCancel={() => window.api.cancelExport()}
        onClose={() => setExporting(null)} onShow={() => window.api.showInFolder(exporting.file)} />}
    </div>
  );
}
