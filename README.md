# Free Video Editor

Éditeur vidéo desktop gratuit w open-source (Electron + React + FFmpeg), inspiré mn l-architecture dyal CapCut.
Ma fih la compte, la abonnement, la watermark.

## Fonctions (MVP)
- Import vidéos (MP4, MOV, MKV, WEBM…) w musique (MP3, WAV, M4A…)
- Timeline b 3 pistes: Texte, Vidéo (magnétique bhal CapCut), Musique
- Cut / Split (S wla Ctrl+B), trim b les bords dyal clip, drag bach tbeddel l-ordre
- Texte: taille, couleur, position, début/durée
- Volume / muet l kol clip
- Undo / Redo, Save / Open projet (.json)
- Export MP4 (H.264 + AAC, 1280×720, 30 fps) b FFmpeg

## Lancement
```bash
npm install
npm start
```

## Test dyal export
```bash
npm run test:export
```

## Architecture
| Dossier | Dor |
|---|---|
| `electron/main.cjs` | Process principal: dialogs, import (ffprobe), export |
| `electron/ffmpeg.cjs` | Kaybni `filter_complex` dyal FFmpeg (trim, scale, concat, drawtext, amix) |
| `src/store.js` | Model dyal projet + reducer + undo/redo |
| `src/components/` | MediaLibrary, Preview, Timeline, Inspector, ExportDialog |

FFmpeg kayji mn `ffmpeg-static` (build GPL). Ila bghiti tdistribui l-app, khass t7tarem licence GPL dyal FFmpeg.
