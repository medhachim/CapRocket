// Automated UI smoke test: FVE_SMOKE=<dir> electron .
// Loads <dir>/project.json, takes screenshots while editing/playing, writes them to <dir>.
const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function smoke(win, app, dir) {
  const wc = win.webContents;
  const shot = async (name) => fs.writeFileSync(path.join(dir, name), (await win.capturePage()).toPNG());
  const run = (js) => wc.executeJavaScript(js);
  const errors = [];
  wc.on('console-message', (_e, level, msg) => level >= 2 && errors.push(msg));
  try {
    await wait(800);
    const project = fs.readFileSync(path.join(dir, 'project.json'), 'utf8');
    await run(`window.__fve.load(${project}); window.__fve.seek(1.5);`);
    await wait(1500);
    await shot('1-loaded.png');
    await run(`window.__fve.select({ track: 'text', id: 't1' })`);
    await run(`window.__fve.seek(0.8); window.__fve.play();`);
    await wait(2000);
    await run(`window.__fve.pause()`);
    await wait(500);
    await shot('2-played.png');
    const t = await run(`document.querySelector('.tc').textContent`);
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ timecode: t, errors }, null, 2));
  } catch (e) {
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ error: e.message, errors }));
  }
  app.quit();
};
