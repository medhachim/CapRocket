// Project model + reducer (with undo/redo).
//
// The video track is "magnetic" like CapCut's main track: clips play back to back,
// so their timeline position is derived from order. Text and music clips have a free `start`.

export const uid = () => Math.random().toString(36).slice(2, 10);
export const MIN_CLIP = 0.1;

export function emptyProject() {
  return { name: 'Untitled', width: 1280, height: 720, fps: 30, media: [], videoClips: [], textClips: [], audioClips: [] };
}

export function videoLayout(videoClips) {
  let t = 0;
  return videoClips.map((c) => {
    const item = { clip: c, start: t, end: t + (c.out - c.in) };
    t = item.end;
    return item;
  });
}

export function projectDuration(p) {
  const v = videoLayout(p.videoClips);
  const ends = [v.length ? v[v.length - 1].end : 0];
  p.textClips.forEach((c) => ends.push(c.start + c.duration));
  p.audioClips.forEach((c) => ends.push(c.start + (c.out - c.in)));
  return Math.max(0, ...ends);
}

// Total duration of what gets exported (the video track drives the output length).
export function exportDuration(p) {
  const v = videoLayout(p.videoClips);
  return v.length ? v[v.length - 1].end : 0;
}

export function videoClipAt(p, t) {
  return videoLayout(p.videoClips).find((l) => t >= l.start && t < l.end) || null;
}

const TRACKS = { video: 'videoClips', text: 'textClips', audio: 'audioClips' };

function reduceProject(p, a) {
  switch (a.type) {
    case 'load':
      return a.project;
    case 'addMedia':
      return { ...p, media: [...p.media, ...a.items] };
    case 'removeMedia':
      return {
        ...p,
        media: p.media.filter((m) => m.id !== a.id),
        videoClips: p.videoClips.filter((c) => c.mediaId !== a.id),
        audioClips: p.audioClips.filter((c) => c.mediaId !== a.id),
      };
    case 'addToTimeline': {
      const m = p.media.find((x) => x.id === a.mediaId);
      if (!m) return p;
      if (m.type === 'video') {
        return { ...p, videoClips: [...p.videoClips, { id: a.clipId, mediaId: m.id, in: 0, out: m.duration, volume: 1, muted: false }] };
      }
      return { ...p, audioClips: [...p.audioClips, { id: a.clipId, mediaId: m.id, start: a.at, in: 0, out: m.duration, volume: 1 }] };
    }
    case 'addText':
      return {
        ...p,
        textClips: [
          ...p.textClips,
          { id: a.clipId, text: 'Kteb hna', start: a.at, duration: 3, x: 0.5, y: 0.85, size: 56, color: '#ffffff' },
        ],
      };
    case 'update': {
      const key = TRACKS[a.track];
      return { ...p, [key]: p[key].map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
    }
    case 'delete': {
      const key = TRACKS[a.track];
      return { ...p, [key]: p[key].filter((c) => c.id !== a.id) };
    }
    case 'moveVideo': {
      const list = [...p.videoClips];
      const from = list.findIndex((c) => c.id === a.id);
      if (from < 0) return p;
      const [c] = list.splice(from, 1);
      list.splice(Math.max(0, Math.min(a.toIndex, list.length)), 0, c);
      return { ...p, videoClips: list };
    }
    case 'split':
      return splitAt(p, a.track, a.id, a.t, a.newId);
    default:
      return p;
  }
}

function splitAt(p, track, id, t, newId) {
  if (track === 'video') {
    const l = videoLayout(p.videoClips).find((x) => x.clip.id === id);
    if (!l || t - l.start < MIN_CLIP || l.end - t < MIN_CLIP) return p;
    const cut = l.clip.in + (t - l.start);
    const list = [];
    p.videoClips.forEach((c) => {
      if (c.id !== id) return list.push(c);
      list.push({ ...c, out: cut }, { ...c, id: newId, in: cut });
    });
    return { ...p, videoClips: list };
  }
  if (track === 'audio') {
    const c = p.audioClips.find((x) => x.id === id);
    const len = c ? c.out - c.in : 0;
    if (!c || t - c.start < MIN_CLIP || c.start + len - t < MIN_CLIP) return p;
    const cut = c.in + (t - c.start);
    return {
      ...p,
      audioClips: p.audioClips.flatMap((x) => (x.id !== id ? [x] : [{ ...x, out: cut }, { ...x, id: newId, start: t, in: cut }])),
    };
  }
  if (track === 'text') {
    const c = p.textClips.find((x) => x.id === id);
    if (!c || t - c.start < MIN_CLIP || c.start + c.duration - t < MIN_CLIP) return p;
    return {
      ...p,
      textClips: p.textClips.flatMap((x) =>
        x.id !== id ? [x] : [{ ...x, duration: t - x.start }, { ...x, id: newId, start: t, duration: x.start + x.duration - t }]
      ),
    };
  }
  return p;
}

// History wrapper. Actions with `transient: true` (e.g. live drag updates) don't push undo steps;
// a 'commit' action records the state captured at drag start.
export function historyReducer(state, a) {
  if (a.type === 'undo') {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (a.type === 'redo') {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  if (a.type === 'beginGesture') return { ...state, gestureStart: state.present };
  if (a.type === 'endGesture') {
    const start = state.gestureStart;
    if (!start || start === state.present) return { ...state, gestureStart: null };
    return { past: [...state.past, start].slice(-100), present: state.present, future: [], gestureStart: null };
  }
  const next = reduceProject(state.present, a);
  if (next === state.present) return state;
  if (a.type === 'load') return { past: [], present: next, future: [] };
  if (a.transient || state.gestureStart) return { ...state, present: next };
  return { past: [...state.past, state.present].slice(-100), present: next, future: [] };
}

export function toFileUrl(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  return 'file:///' + parts.map((s, i) => (i === 0 && /^[a-zA-Z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}
