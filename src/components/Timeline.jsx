import React, { useRef, useState } from 'react';
import { MIN_CLIP, formatTime, videoLayout } from '../store.js';

const HEADER = 84;

export default function Timeline({ project, time, duration, selection, onSelect, onSeek, dispatch, onSplit, onDelete, onAddText }) {
  const [pps, setPps] = useState(60); // pixels per second (zoom)
  const scrollRef = useRef(null);
  const mediaById = Object.fromEntries(project.media.map((m) => [m.id, m]));
  const layout = videoLayout(project.videoClips);
  const width = Math.max((duration + 15) * pps, 800);

  const timeFromEvent = (e) => {
    const rect = scrollRef.current.getBoundingClientRect();
    return Math.max(0, (e.clientX - rect.left - HEADER + scrollRef.current.scrollLeft) / pps);
  };

  // Generic pointer drag: calls onMove(deltaSeconds, event) until release, wrapped in one undo step.
  const drag = (e, onMove) => {
    e.stopPropagation();
    e.preventDefault();
    const x0 = e.clientX;
    dispatch({ type: 'beginGesture' });
    const move = (ev) => onMove((ev.clientX - x0) / pps, ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dispatch({ type: 'endGesture' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const scrub = (e) => {
    onSelect(null);
    onSeek(timeFromEvent(e));
    const move = (ev) => onSeek(timeFromEvent(ev));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startVideoDrag = (e, clip, mode) => {
    onSelect({ track: 'video', id: clip.id });
    const media = mediaById[clip.mediaId];
    const o = { ...clip };
    drag(e, (d, ev) => {
      if (mode === 'left') {
        dispatch({ type: 'update', track: 'video', id: clip.id, patch: { in: clamp(o.in + d, 0, o.out - MIN_CLIP) } });
      } else if (mode === 'right') {
        dispatch({ type: 'update', track: 'video', id: clip.id, patch: { out: clamp(o.out + d, o.in + MIN_CLIP, media.duration) } });
      } else {
        // Reorder on the magnetic main track: drop index from the pointer position among the other clips.
        const others = videoLayout(project.videoClips.filter((c) => c.id !== clip.id));
        const pos = timeFromEvent(ev);
        const toIndex = others.filter((l) => (l.start + l.end) / 2 < pos).length;
        dispatch({ type: 'moveVideo', id: clip.id, toIndex });
      }
    });
  };

  const startFreeDrag = (e, track, clip, mode) => {
    onSelect({ track, id: clip.id });
    const o = { ...clip };
    drag(e, (d) => {
      let patch;
      if (track === 'text') {
        if (mode === 'left') {
          const start = clamp(o.start + d, 0, o.start + o.duration - MIN_CLIP);
          patch = { start, duration: o.start + o.duration - start };
        } else if (mode === 'right') patch = { duration: Math.max(MIN_CLIP, o.duration + d) };
        else patch = { start: Math.max(0, o.start + d) };
      } else {
        const len = mediaById[o.mediaId]?.duration ?? o.out;
        if (mode === 'left') {
          const dd = clamp(d, -Math.min(o.in, o.start), o.out - o.in - MIN_CLIP);
          patch = { in: o.in + dd, start: o.start + dd };
        } else if (mode === 'right') patch = { out: clamp(o.out + d, o.in + MIN_CLIP, len) };
        else patch = { start: Math.max(0, o.start + d) };
      }
      dispatch({ type: 'update', track, id: clip.id, patch });
    });
  };


  // Ruler ticks: pick a step that keeps labels ~80px apart.
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s * pps >= 80) || 120;
  const ticks = [];
  for (let t = 0; t * pps < width; t += step) ticks.push(t);

  return (
    <section className="timeline">
      <div className="tl-toolbar">
        <button onClick={onSplit} title="Ctrl+B / S">✂ Split</button>
        <button onClick={onDelete} disabled={!selection} title="Delete">🗑 Delete</button>
        <button onClick={onAddText}>T+ Texte</button>
        <div className="spacer" />
        <span className="dim">Zoom</span>
        <input type="range" min="10" max="300" value={pps} onChange={(e) => setPps(Number(e.target.value))} />
      </div>
      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-content" style={{ width: width + HEADER }}>
          <div className="tl-row ruler" onPointerDown={scrub}>
            <div className="tl-head" />
            <div className="tl-lane">
              {ticks.map((t) => (
                <div key={t} className="tick" style={{ left: t * pps }}>{formatTime(t).slice(0, 5)}</div>
              ))}
            </div>
          </div>

          <div className="tl-row">
            <div className="tl-head">Texte</div>
            <div className="tl-lane" onPointerDown={scrub}>
              {project.textClips.map((c) => (
                <Clip pps={pps} selection={selection} key={c.id} track="text" clip={c} start={c.start} length={c.duration} label={c.text}
                  onDown={(e, mode) => startFreeDrag(e, 'text', c, mode)} />
              ))}
            </div>
          </div>

          <div className="tl-row main">
            <div className="tl-head">Vidéo</div>
            <div className="tl-lane" onPointerDown={scrub}>
              {layout.map((l) => (
                <Clip pps={pps} selection={selection} key={l.clip.id} track="video" clip={l.clip} start={l.start} length={l.end - l.start}
                  label={mediaById[l.clip.mediaId]?.name ?? '?'} onDown={(e, mode) => startVideoDrag(e, l.clip, mode)} />
              ))}
            </div>
          </div>

          <div className="tl-row">
            <div className="tl-head">Musique</div>
            <div className="tl-lane" onPointerDown={scrub}>
              {project.audioClips.map((c) => (
                <Clip pps={pps} selection={selection} key={c.id} track="audio" clip={c} start={c.start} length={c.out - c.in}
                  label={'♪ ' + (mediaById[c.mediaId]?.name ?? '?')} onDown={(e, mode) => startFreeDrag(e, 'audio', c, mode)} />
              ))}
            </div>
          </div>

          <div className="playhead" style={{ left: HEADER + time * pps }} />
        </div>
      </div>
    </section>
  );
}

function Clip({ pps, selection, track, clip, start, length, label, onDown }) {
  const selected = selection && selection.track === track && selection.id === clip.id;
  return (
    <div className={`clip ${track} ${selected ? 'selected' : ''}`}
      style={{ left: start * pps, width: Math.max(4, length * pps) }}
      onPointerDown={(e) => onDown(e, 'move')} title={label}>
      <div className="handle left" onPointerDown={(e) => onDown(e, 'left')} />
      <span className="clip-label">{label}</span>
      <div className="handle right" onPointerDown={(e) => onDown(e, 'right')} />
    </div>
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
