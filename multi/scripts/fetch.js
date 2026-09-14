// 官方数据同步：
//   node scripts/fetch.js                         增量更新全部游戏
//   node scripts/fetch.js --games=dlt,kl8         仅增量更新指定游戏
//   node scripts/fetch.js --force                 全量重抓全部游戏
// 自动写入 multi/data/all.json 和 GitHub Pages 使用的 multi/public/data/all.json。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGame, fetchLatest, GAME_META } from '../lib/fetchDraws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'all.json');
const PUBLIC_OUT = path.join(ROOT, 'public', 'data', 'all.json');
const ORDER = ['dlt', 'qxc', 'pl3', 'pl5', 'ssq', 'kl8', 'f3d'];
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const gamesArg = args.find((x) => x.startsWith('--games='));
const requested = gamesArg
  ? gamesArg.slice('--games='.length).split(',').map((x) => x.trim()).filter(Boolean)
  : ORDER;

for (const key of requested) {
  if (!GAME_META[key]) throw new Error(`未知游戏：${key}`);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function mergeDraws(oldList = [], latestList = []) {
  const map = new Map();
  for (const d of oldList) if (d && d.code) map.set(String(d.code), d);
  for (const d of latestList) if (d && d.code) map.set(String(d.code), d);
  return [...map.values()].sort((a, b) => {
    const ac = String(a.code), bc = String(b.code);
    return ac < bc ? -1 : ac > bc ? 1 : 0;
  });
}

function writeOutput(out) {
  const body = JSON.stringify(out);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  fs.writeFileSync(PUBLIC_OUT, body);
}

async function main() {
  const existing = { ...readJson(PUBLIC_OUT), ...readJson(OUT) };
  const out = { ...existing };
  const failed = [];

  for (const key of requested) {
    const before = Array.isArray(existing[key]) ? existing[key] : [];
    const newestBefore = before[before.length - 1]?.code || '—';

    try {
      if (!FORCE && before.length) {
        console.log(`增量同步 ${GAME_META[key].label} (${key}) …`);
        const latest = await fetchLatest(key, 100);
        out[key] = mergeDraws(before, latest);
        const added = out[key].length - before.length;
        console.log(`  ✔ ${key}：新增 ${added} 期，最新 ${out[key][out[key].length - 1]?.code || newestBefore}`);
      } else {
        console.log(`全量抓取 ${GAME_META[key].label} (${key}) …`);
        const list = await fetchGame(key, (p, total) => {
          if (p % 5 === 0 || p === total) console.log(`  ${p}/${total} 页`);
        });
        out[key] = mergeDraws(before, list);
        console.log(`  ✔ ${key} ${out[key].length} 期（最新 ${out[key][out[key].length - 1]?.code || '—'}）`);
      }
    } catch (e) {
      // 单个游戏接口不可用时不影响其它游戏：保留原数据继续
      failed.push(key);
      console.log(`  ⚠ ${key} 同步失败（保留原数据）：${String(e && e.message || e).slice(0, 160)}`);
    }
  }

  writeOutput(out);
  console.log(`✔ 已保存 → ${OUT}`);
  console.log(`✔ 已同步 → ${PUBLIC_OUT}`);
  for (const key of ORDER) if (out[key]) console.log(`  ${key}: ${out[key].length} 期`);
  if (failed.length) {
    console.log(`\n⚠ 本次有 ${failed.length} 个游戏未同步成功：${failed.join(', ')}（数据保持原样，不影响其它游戏）`);
  }
  if (failed.length === requested.length) {
    console.log('提示：所有接口本次均不可达。若运行在海外机房（如 GitHub Actions），属正常现象——国内彩票官网会拦截海外机房 IP。');
  }
}

main().catch((e) => {
  // 兜底：脚本层面不抛错退出，避免定时任务被判失败（数据保持不变）
  console.error('⚠ 同步异常（数据保持不变）：', e && e.message ? e.message : e);
});
