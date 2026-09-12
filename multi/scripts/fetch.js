// CLI：node multi/scripts/fetch.js [--force]  → 生成 multi/data/all.json
// 排列3/5 与 快乐8 优先复用仓库内已抓好的官方数据（pailie/data/pl.json、kuaile8/data/kuaile8.json），
// 不存在或 --force 时全部从官方接口重新抓取。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGame, GAME_META } from '../lib/fetchDraws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HOME = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'all.json');
const FORCE = process.argv.includes('--force');

function loadSeed(rel, transform) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(HOME, rel), 'utf8'));
    return transform(j);
  } catch {}
  return null;
}

async function main() {
  const out = {};
  const order = ['dlt', 'qxc', 'pl3', 'pl5', 'ssq', 'kl8', 'f3d'];
  // 复用已生成的 all.json（缺哪个补哪个）
  if (!FORCE) {
    try {
      const old = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      for (const k of Object.keys(old)) if (Array.isArray(old[k]) && old[k].length) out[k] = old[k];
      if (Object.keys(out).length) console.log(`✔ 复用 multi/data/all.json：${Object.keys(out).join(', ')}`);
    } catch {}
  }

  // 本地复用（默认）
  if (!FORCE) {
    const pl = loadSeed('pailie/data/pl.json', (j) => j);
    if (pl && Array.isArray(pl.pl3) && Array.isArray(pl.pl5)) { out.pl3 = pl.pl3; out.pl5 = pl.pl5; console.log(`✔ 复用 pailie/data/pl.json：排列3 ${out.pl3.length} 期 · 排列5 ${out.pl5.length} 期`); }
    const kl8 = loadSeed('kuaile8/data/kuaile8.json', (j) => j);
    if (kl8) { out.kl8 = kl8; console.log(`✔ 复用 kuaile8/data/kuaile8.json：快乐8 ${kl8.length} 期`); }
  }

  for (const key of order) {
    if (out[key] && out[key].length) continue;
    console.log(`抓取 ${GAME_META[key].label} (${key}) …`);
    const list = await fetchGame(key, (p, total) => { if (p % 5 === 0 || p === total) console.log(`  ${p}/${total} 页`); });
    out[key] = list;
    console.log(`  ✔ ${key} ${list.length} 期（最新 ${list[list.length - 1]?.code}）`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`✔ 已保存 → ${OUT}`);
  for (const k of Object.keys(out)) console.log(`  ${k}: ${out[k].length} 期`);
}

main().catch((e) => { console.error('✘ 失败：', e); process.exit(1); });
