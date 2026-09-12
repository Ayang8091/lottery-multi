// 多游戏智能参考中心 —— 官方历史抓取（零第三方依赖）
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
// 体彩：大乐透(85)、七星彩(04)、排列3(35)、排列5(350133)  → webapi.sporttery.cn
// 福彩：双色球(ssq)、快乐8(kl8)、福彩3D(3d)              → www.cwl.gov.cn
const SPORT_API = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry';
const CWL_API = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SPORT_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Referer': 'https://www.lottery.gov.cn/',
};
const CWL_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
  'Referer': 'https://www.cwl.gov.cn/',
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
const SPORT_COOKIE = `${os.tmpdir()}/sporttery-cookies.txt`;
let sportWarmed = false;
async function warmSportSession() {
  if (sportWarmed) return;
  const args = ['-sS', '-L', '--max-time', '30', '-c', SPORT_COOKIE, '-A', UA, '-H', 'Referer: https://www.lottery.gov.cn/', '-o', '/dev/null', 'https://www.lottery.gov.cn/kj/kjlb.html?dlt'];
  await execFileAsync('curl', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  sportWarmed = true;
}
async function requestJson(url, headers, label, cookieFile) {
  let last;
  if (cookieFile) await warmSportSession();
  const curlArgs = ['-sS', '-L', '--fail-with-body', '--max-time', '30', '-A', headers['User-Agent']];
  if (cookieFile) curlArgs.push('-b', cookieFile);
  for (const [key, value] of Object.entries(headers)) {
    if (key !== 'User-Agent') curlArgs.push('-H', `${key}: ${value}`);
  }
  curlArgs.push(url);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { stdout } = await execFileAsync('curl', curlArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      return JSON.parse(stdout);
    } catch (e) {
      const detail = String(e.stderr || e.stdout || e.message || '').replace(/\s+/g, ' ').slice(0, 180);
      last = new Error(`${label} 请求失败：${detail}`);
    }
    if (attempt < 3) await sleep(1200 * (attempt + 1));
  }
  throw last;
}

// 游戏元信息（gameNo / cwl name / 号码分组）
export const GAME_META = {
  dlt:  { cat: 'tc', label: '超级大乐透', short: '大乐透', sport: '85', groups: [['前区', 35, 5], ['后区', 12, 2]] },
  qxc:  { cat: 'tc', label: '7星彩', short: '七星彩', sport: '04', digits: 7 },
  pl3:  { cat: 'tc', label: '排列3', short: '排列三', sport: '35', digits: 3 },
  pl5:  { cat: 'tc', label: '排列5', short: '排列五', sport: '350133', digits: 5 },
  ssq:  { cat: 'fc', label: '双色球', short: '双色球', cwl: 'ssq', groups: [['红球', 33, 6], ['蓝球', 16, 1]] },
  kl8:  { cat: 'fc', label: '快乐8', short: '快乐8', cwl: 'kl8', groups: [['选号区', 80, 20]] },
  f3d:  { cat: 'fc', label: '福彩3D', short: '3D', cwl: '3d', digits: 3 },
};

// ---------- 体彩 sporttery ----------
async function sportPage(gameNo, pageNo, pageSize) {
  const url = `${SPORT_API}?gameNo=${gameNo}&provinceId=0&pageSize=${pageSize}&isVerify=1&pageNo=${pageNo}`;
  const json = await requestJson(url, SPORT_HEADERS, '体彩接口', SPORT_COOKIE);
  if (!json.success) throw new Error(`体彩接口错误 ${json.errorCode || ''} ${json.errorMessage || ''}`);
  return json.value || {};
}
function sportPick(o) {
  const nums = String(o.lotteryDrawResult || '').split(/[\s,]+/).filter(Boolean).map((s) => parseInt(s, 10));
  return {
    code: String(o.lotteryDrawNum || ''),
    date: String(o.lotteryDrawTime || '').replace(/\(.*\)$/, '').trim(),
    nums,
    sales: 0,
    prize: String(o.prizeLevelList?.[0]?.stakeAmountFormat || ''),
  };
}
async function fetchSport(key, onProgress) {
  const meta = GAME_META[key];
  const gameNo = meta.sport;
  const pageSize = 100;
  const first = await sportPage(gameNo, 1, pageSize);
  const total = Number(first.total) || 0;
  const pages = Number(first.pages) || Math.ceil(total / pageSize) || 0;
  const list = (first.list || []).map(sportPick);
  for (let p = 2; p <= pages; p++) {
    const j = await sportPage(gameNo, p, pageSize);
    list.push(...(j.list || []).map(sportPick));
    if (onProgress) onProgress(p, pages);
    await new Promise((r) => setTimeout(r, 140));
  }
  return clean(key, list);
}

// ---------- 福彩 cwl ----------
async function cwlPage(name, pageNo, pageSize) {
  const url = `${CWL_API}?name=${name}&pageNo=${pageNo}&pageSize=${pageSize}&systemType=PC`;
  const json = await requestJson(url, CWL_HEADERS, '福彩接口');
  if (json.state !== 0) throw new Error(`福彩接口 state=${json.state} ${json.message || ''}`);
  return json;
}
function cwlPick(o, meta) {
  const reds = String(o.red || '').split(',').filter(Boolean).map((s) => parseInt(s, 10));
  let nums = reds;
  if (meta.groups) {
    // 分组玩法：红球区排序；若有蓝球/后区（单独字段）追加
    const groups = meta.groups;
    const mainSize = groups[0][2];
    const main = reds.slice(0, mainSize).sort((a, b) => a - b);
    nums = main;
    if (groups.length > 1) {
      const blue = String(o.blue || '').split(',').filter(Boolean).map((s) => parseInt(s, 10));
      nums = nums.concat(blue);
    }
  } else {
    nums = reds;
  }
  const date = String(o.date || '').replace(/\(.*\)$/, '').trim();
  return {
    code: String(o.code || ''),
    date,
    week: String(o.week || ''),
    nums,
    sales: Number(o.sales) || 0,
    pool: Number(o.poolmoney) || 0,
  };
}
async function fetchCwl(key, onProgress) {
  const meta = GAME_META[key];
  const pageSize = 100;
  const first = await cwlPage(meta.cwl, 1, pageSize);
  const total = Number(first.total) || 0;
  const pages = Math.ceil(total / pageSize);
  const list = (first.result || []).map((o) => cwlPick(o, meta));
  for (let p = 2; p <= pages; p++) {
    const j = await cwlPage(meta.cwl, p, pageSize);
    list.push(...(j.result || []).map((o) => cwlPick(o, meta)));
    if (onProgress) onProgress(p, pages);
    await new Promise((r) => setTimeout(r, 180));
  }
  return clean(key, list);
}

// 清洗：按 code 去重 + 正序 + 校验号码数量
function clean(key, list) {
  const meta = GAME_META[key];
  const expect = meta.digits || (meta.groups ? meta.groups.reduce((a, g) => a + g[2], 0) : 0);
  const ok = list.filter((d) => d.nums.length === expect && /^\d{4,9}$/.test(d.code) && d.date);
  ok.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const seen = new Map();
  ok.forEach((d) => seen.set(d.code, d));
  return [...seen.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

export async function fetchGame(key, onProgress) {
  if (!GAME_META[key]) throw new Error('未知游戏 ' + key);
  const meta = GAME_META[key];
  if (meta.sport) return fetchSport(key, onProgress);
  return fetchCwl(key, onProgress);
}

// 仅抓取官方接口第一页最新结果，供定时增量同步使用。
export async function fetchLatest(key, pageSize = 100) {
  if (!GAME_META[key]) throw new Error('未知游戏 ' + key);
  const meta = GAME_META[key];
  if (meta.sport) {
    const page = await sportPage(meta.sport, 1, pageSize);
    return clean(key, (page.list || []).map(sportPick));
  }
  const page = await cwlPage(meta.cwl, 1, pageSize);
  return clean(key, (page.result || []).map((o) => cwlPick(o, meta)));
}
