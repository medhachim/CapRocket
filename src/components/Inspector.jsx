import React from 'react';
import { formatTime } from '../store.js';

function Num({ label, value, onChange, step = 0.1, min, max }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={Number(value.toFixed(2))} step={step} min={min} max={max}
        onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </label>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, fmt = (v) => v }) {
  return (
    <label className="field">
      <span>{label} <b>{fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function Inspector({ project, selection, dispatch }) {
  const track = selection?.track;
  const list = track === 'video' ? project.videoClips : track === 'text' ? project.textClips : track === 'audio' ? project.audioClips : [];
  const clip = list.find((c) => c.id === selection?.id);
  const set = (patch) => dispatch({ type: 'update', track, id: clip.id, patch });
  const media = clip?.mediaId && project.media.find((m) => m.id === clip.mediaId);
  const pct = (v) => `${Math.round(v * 100)}%`;

  return (
    <aside className="panel inspector">
      <div className="panel-title">Propriétés</div>
      {!clip && <div className="empty">Khtar clip f l-timeline bach tbeddel l-propriétés dyalo.</div>}

      {clip && track === 'text' && (
        <div className="fields">
          <label className="field">
            <span>Texte</span>
            <textarea rows={3} value={clip.text} onChange={(e) => set({ text: e.target.value })} />
          </label>
          <Slider label="Taille" value={clip.size} min={12} max={200} step={1} onChange={(size) => set({ size })} />
          <label className="field row">
            <span>Couleur</span>
            <input type="color" value={clip.color} onChange={(e) => set({ color: e.target.value })} />
          </label>
          <Slider label="Position X" value={clip.x} fmt={pct} onChange={(x) => set({ x })} />
          <Slider label="Position Y" value={clip.y} fmt={pct} onChange={(y) => set({ y })} />
          <Num label="Début (s)" value={clip.start} min={0} onChange={(start) => set({ start: Math.max(0, start) })} />
          <Num label="Durée (s)" value={clip.duration} min={0.1} onChange={(duration) => set({ duration: Math.max(0.1, duration) })} />
        </div>
      )}

      {clip && track === 'video' && (
        <div className="fields">
          <div className="info">{media?.name}<br /><span className="dim">{media?.width}×{media?.height} · {formatTime(media?.duration ?? 0)}</span></div>
          <Num label="Début source (s)" value={clip.in} min={0} onChange={(v) => set({ in: Math.max(0, Math.min(v, clip.out - 0.1)) })} />
          <Num label="Fin source (s)" value={clip.out} onChange={(v) => set({ out: Math.max(clip.in + 0.1, Math.min(v, media?.duration ?? v)) })} />
          <Slider label="Volume" value={clip.volume ?? 1} max={2} fmt={pct} onChange={(volume) => set({ volume })} />
          <label className="field row">
            <span>Muet</span>
            <input type="checkbox" checked={!!clip.muted} onChange={(e) => set({ muted: e.target.checked })} />
          </label>
        </div>
      )}

      {clip && track === 'audio' && (
        <div className="fields">
          <div className="info">{media?.name}</div>
          <Num label="Début timeline (s)" value={clip.start} min={0} onChange={(start) => set({ start: Math.max(0, start) })} />
          <Slider label="Volume" value={clip.volume ?? 1} max={2} fmt={pct} onChange={(volume) => set({ volume })} />
        </div>
      )}

      <div className="shortcuts dim">
        <b>Raccourcis</b><br />
        Space: play/pause · S / Ctrl+B: split<br />
        Delete: msa7 · Ctrl+Z / Ctrl+Y: undo/redo<br />
        ← →: frame · Shift+← →: 1s
      </div>
    </aside>
  );
}
