import React from 'react';

export default function ExportDialog({ state, onCancel, onClose, onShow }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        {state.error ? (
          <>
            <h3>Export fchel</h3>
            <pre className="error">{state.error}</pre>
            <button onClick={onClose}>Sedd</button>
          </>
        ) : state.done ? (
          <>
            <h3>Export sala ✅</h3>
            <p className="dim">{state.file}</p>
            <div className="modal-actions">
              <button onClick={onShow}>Wrri f dossier</button>
              <button className="primary" onClick={onClose}>OK</button>
            </div>
          </>
        ) : (
          <>
            <h3>Export MP4…</h3>
            <div className="progress"><div style={{ width: `${(state.progress * 100).toFixed(1)}%` }} /></div>
            <p>{(state.progress * 100).toFixed(0)}%</p>
            <button onClick={onCancel}>Annuler</button>
          </>
        )}
      </div>
    </div>
  );
}
