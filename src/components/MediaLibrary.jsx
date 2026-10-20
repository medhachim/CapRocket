import React from 'react';
import { formatTime, toFileUrl } from '../store.js';

export default function MediaLibrary({ media, onImport, onAdd, onAddText, onRemove }) {
  return (
    <aside className="panel library">
      <div className="panel-title">
        Media
        <button className="primary small" onClick={onImport}>+ Import</button>
      </div>
      {!media.length && (
        <div className="empty" onClick={onImport}>
          Clicki hna bach t-importi vidéos (MP4, MOV…) wla musique (MP3, WAV…)
        </div>
      )}
      <div className="media-grid">
        {media.map((m) => (
          <div key={m.id} className="media-item" onDoubleClick={() => onAdd(m.id)} title={m.path}>
            <div className="thumb">
              {m.type === 'video'
                ? <video src={toFileUrl(m.path) + '#t=0.5'} preload="metadata" muted />
                : <div className="audio-thumb">♪</div>}
              <span className="dur">{formatTime(m.duration).slice(0, 5)}</span>
              <button className="add" onClick={() => onAdd(m.id)} title="Zid l-timeline">+</button>
              <button className="remove" onClick={() => onRemove(m.id)} title="7yed">×</button>
            </div>
            <div className="media-name">{m.name}</div>
          </div>
        ))}
      </div>
      <div className="panel-title sub">Texte</div>
      <button className="text-preset" onClick={onAddText}>Aa  Zid texte</button>
    </aside>
  );
}
