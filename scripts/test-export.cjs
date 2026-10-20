// Generates sample media with FFmpeg, then exports a small project through the real pipeline.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ffmpegPath, probe, runExport } = require('../electron/ffmpeg.cjs');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fve-test-'));
  const gen = (args) => execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
  const a = path.join(dir, 'a.mp4');
  const b = path.join(dir, 'b no audio.mp4');
  const music = path.join(dir, 'music.mp3');
  gen(['-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30:duration=5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-shortest', a]);
  gen(['-f', 'lavfi', '-i', 'smptebars=size=640x480:rate=25:duration=4', b]);
  gen(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=10', music]);

  const media = [];
  for (const [id, p] of [['m1', a], ['m2', b], ['m3', music]]) {
    const info = await probe(p);
    media.push({ id, path: p, name: path.basename(p), type: info.hasVideo ? 'video' : 'audio', ...info });
  }
  const project = {
    width: 1280, height: 720, fps: 30, media,
    videoClips: [
      { id: 'c1', mediaId: 'm1', in: 1, out: 3 },
      { id: 'c2', mediaId: 'm2', in: 0, out: 2.5 },
      { id: 'c3', mediaId: 'm1', in: 3, out: 4 },
    ],
    textClips: [{ id: 't1', text: "Salam: 100% free 'test'", start: 0.5, duration: 3, x: 0.5, y: 0.85, size: 56, color: '#ffcc00' }],
    audioClips: [{ id: 'a1', mediaId: 'm3', start: 1, in: 0, out: 4, volume: 0.5 }],
  };
  const out = path.join(dir, 'out.mp4');
  const job = runExport(project, out, (p) => process.stdout.write(`\rprogress ${(p * 100).toFixed(0)}%`));
  await job.promise;
  const info = await probe(out);
  console.log('\n', out, info);
  if (Math.abs(info.duration - 5.5) > 0.2 || !info.hasAudio || info.width !== 1280) throw new Error('Unexpected output');
  console.log('EXPORT OK');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
