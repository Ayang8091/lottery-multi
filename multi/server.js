// 多游戏智能参考中心（体彩+福彩 二大类 7 游戏）—— 本地 HTTP 服务（零第三方依赖，端口 8790，监听局域网）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { fetchGame, GAME_META } from './lib/fetchDraws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'all.json');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
};
const data = Object.fromEntries(Object.keys(GAME_META).map((k) => [k, []]));
let updatedAt = null;

function loadData() {
  try {
    const j = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const k of Object.keys(GAME_META)) data[k] = Array.isArray(j[k]) ? j[k] : [];
    updatedAt = new Date(fs.statSync(DATA_FILE).mtimeMs);
  } catch { updatedAt = null; }
}
function saveData() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
  updatedAt = new Date();
}
function lanAddresses() {
  const out = [];
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const it of os.networkInterfaces()[name] || []) {
      if (it.family === 'IPv4' && !it.internal) out.push({ name, address: it.address });
    }
  }
  return out;
}
function gameOf(key) {
  const k = String(key || '').toLowerCase();
  return GAME_META[k] ? k : 'dlt';
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function safeJoin(base, rel) {
  const t = path.resolve(base, '.' + path.sep + rel);
  return t !== base && !t.startsWith(base + path.sep) ? null : t;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const q = url.searchParams;
  const game = gameOf(q.get('game'));

  if (p === '/api/meta') {
    const info = {};
    for (const k of Object.keys(GAME_META)) info[k] = { meta: GAME_META[k], total: data[k].length, last: data[k].length ? data[k][data[k].length - 1] : null };
    sendJson(res, 200, { info, updatedAt });
    return;
  }
  if (p === '/api/draws') {
    const list = data[game];
    sendJson(res, 200, { game, total: list.length, updatedAt, draws: list });
    return;
  }
  if (p === '/api/refresh') {
    try {
      data[game] = await fetchGame(game);
      saveData();
      sendJson(res, 200, { ok: true, game, total: data[game].length, updatedAt, message: `${GAME_META[game].label} 已更新到最新（共 ${data[game].length} 期）` });
    } catch (e) { sendJson(res, 502, { ok: false, message: `刷新失败：${e.message}` }); }
    return;
  }
  if (p === '/api/lan') {
    sendJson(res, 200, { local: `http://127.0.0.1:${PORT}`, lan: lanAddresses().map((x) => ({ name: x.name, url: `http://${x.address}:${PORT}` })) });
    return;
  }
  if (p === '/api/health') {
    const info = Object.fromEntries(Object.keys(GAME_META).map((k) => [k, data[k].length]));
    sendJson(res, 200, { ok: true, info, updatedAt });
    return;
  }

  const target = safeJoin(PUBLIC, p === '/' ? '/index.html' : p);
  if (!target) { sendJson(res, 403, { error: 'forbidden' }); return; }
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
});

loadData();
server.listen(PORT, HOST, () => {
  console.log('🎰 体彩·福彩 多游戏智能参考中心已启动：http://127.0.0.1:' + PORT);
  const info = Object.keys(GAME_META).map((k) => `${GAME_META[k].label} ${data[k].length}`).join(' · ');
  console.log('   内置（官方历史）：' + info);
  const lans = lanAddresses();
  if (lans.length) console.log('📱 同一Wi-Fi手机/微信访问：' + lans.map((x) => `http://${x.address}:${PORT}`).join(' 或 '));
  console.log('   数据来源：中国体育彩票 sporttery.cn / 中国福利彩票 cwl.gov.cn；仅供参考，理性购彩。');
});
