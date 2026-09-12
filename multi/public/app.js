// =============================================================
// 多游戏智能参考中心 · 前端逻辑（体彩 / 福彩 二大类 · 7 游戏）
// =============================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const ML = window.ML, E = window.MLE;
  const CATS = ML.CATS, G = ML.GAMES;

  // ---------- 状态 ----------
  const S = {
    cat: 'tc', game: 'dlt',
    cache: {}, info: null, updatedAt: null, static: false, staticData: null,
    draws: [], chkMode: 'direct',
    anaWin: 100,
    pick: { strategy: 'mix', win: 100, count: 5, mode: 'single', w: 6, params: {}, times: 1, append: false, periods: 1 },
    bt: { strategy: 'mix', len: 200, win: 100, w: 6 },
    lastTickets: null, lastPickInfo: null,
  };
  const STRATS = [['mix', '综合智选'], ['hot', '热号'], ['cold', '冷号'], ['balanced', '均衡'], ['trend', '走势'], ['rand', '机选对照']];
  const WINS = [[30, '近30期'], [100, '近100期'], [200, '近200期']];
  const CNTS = [[1, '1注'], [2, '2注'], [3, '3注'], [5, '5注'], [10, '10注']];
  const DRAW_WEEKDAYS = { dlt: [1, 3, 6], qxc: [2, 5, 0], ssq: [2, 4, 0] };
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  let gameLoadSeq = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(t._h); t._h = setTimeout(() => { t.className = 'toast'; }, 2600);
  }
  function fmtDate(d) { return d ? String(d) : '—'; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ballClass(g, idx) { // idx in ticket nums
    if (g.kind === 'digit') return (g.key === 'qxc' && idx === 6) ? 'purple' : 'blue';
    if (g.key === 'dlt') return idx < 5 ? 'red' : 'blue';
    if (g.key === 'ssq') return idx < 6 ? 'red' : 'blue';
    return 'gold'; // kl8
  }
  function ballText(g, v) { return g.kind === 'digit' ? String(v) : pad2(v); }
  function ballsHtml(g, nums, cls) {
    return nums.map((v, i) => `<span class="ball ${ballClass(g, i)} ${cls || ''}">${ballText(g, v)}</span>`).join('');
  }
  function fmtNums(g, nums) {
    // 复制用文本：组间以 + 分隔
    if (g.kind === 'digit') return nums.join(' ');
    if (g.key === 'kl8') return nums.map(pad2).join(' ');
    const mid = g.groups[0].pick;
    return nums.slice(0, mid).map(pad2).join(' ') + ' + ' + nums.slice(mid).map(pad2).join(' ');
  }
  function shapeOf(g, d) {
    const nums = d.nums;
    if (g.kind === 'digit') {
      let sum = 0, odd = 0; for (const n of nums) { sum += n; if (n % 2) odd++; }
      return { sum, odd, even: nums.length - odd, span: Math.max(...nums) - Math.min(...nums) };
    }
    if (g.key === 'kl8') {
      let sum = 0, odd = 0; const z = [0, 0, 0, 0];
      for (const n of nums) { sum += n; if (n % 2) odd++; z[Math.floor((n - 1) / 20)]++; }
      return { sum, odd, even: nums.length - odd, span: Math.max(...nums) - Math.min(...nums), zones: z };
    }
    // dlt/ssq：仅主组（前区/红球）
    const main = nums.slice(0, g.groups[0].pick);
    let sum = 0, odd = 0; for (const n of main) { sum += n; if (n % 2) odd++; }
    return { sum, odd, even: main.length - odd, span: Math.max(...main) - Math.min(...main) };
  }
  function segHtml(items, cur, dataKey) {
    return items.map((it) => {
      const [val, label] = Array.isArray(it) ? it : [it, it];
      const on = String(cur) === String(val) ? ' on' : '';
      return `<button class="${on}" data-${dataKey}="${val}">${label}</button>`;
    }).join('');
  }

  // ---------- 元数据 / 顶部 ----------
  async function fetchStaticData() {
    if (S.staticData) return S.staticData;
    const r = await fetch(new URL('data/all.json', document.baseURI));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    S.staticData = await r.json();
    return S.staticData;
  }
  async function loadMeta() {
    try {
      const r = await fetch('/api/meta');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      S.info = j.info; S.updatedAt = j.updatedAt; S.static = false;
      const parts = ML.order.map((k) => `${G[k].name}${j.info[k].total}`).join(' · ');
      $('dataInfo').textContent = '已内置官方历史 ' + parts;
    } catch (apiError) {
      try {
        const j = await fetchStaticData();
        S.info = Object.fromEntries(ML.order.map((k) => [k, { total: Array.isArray(j[k]) ? j[k].length : 0 }]));
        S.updatedAt = null; S.static = true;
        const parts = ML.order.map((k) => `${G[k].name}${S.info[k].total}`).join(' · ');
        $('dataInfo').textContent = '已内置官方历史 ' + parts;
      } catch (staticError) {
        $('dataInfo').textContent = '数据加载失败，请检查数据文件';
      }
    }
  }
  async function loadDraws(key) {
    if (S.cache[key]) { S.draws = S.cache[key]; return S.draws; }
    try {
      const r = await fetch('/api/draws?game=' + key);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      S.cache[key] = Array.isArray(j.draws) ? j.draws : [];
    } catch (apiError) {
      const all = await fetchStaticData();
      S.cache[key] = Array.isArray(all[key]) ? all[key] : [];
    }
    S.draws = S.cache[key];
    return S.draws;
  }

  // ---------- 分类 / 游戏切换 ----------
  function renderChips() {
    const list = ML.byCat[S.cat];
    $('gameChips').innerHTML = list.map((k) => {
      const g = G[k];
      return `<span class="chip${k === S.game ? ' on' : ''}" data-game="${k}"><span class="ic">${g.icon}</span>${g.name}</span>`;
    }).join('');
  }
  async function selectGame(key) {
    if (S.game !== key) S.pick.params = {};
    const seq = ++gameLoadSeq;
    S.game = key; S.lastTickets = null; S.lastPickInfo = null;
    renderChips(); renderGhead();
    await loadDraws(key);
    if (seq !== gameLoadSeq || S.game !== key) return;
    renderAll();
  }
  function setCat(cat) {
    S.cat = cat;
    if (!ML.byCat[cat].includes(S.game)) { S.game = ML.byCat[cat][0]; S.pick.params = {}; S.lastTickets = null; S.lastPickInfo = null; }
    document.querySelectorAll('#catSeg button').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
    selectGame(S.game);
  }
  function renderGhead() {
    const g = G[S.game]; const info = S.info ? S.info[S.game] : null;
    const meta = S.info ? (S.info[S.game] ? S.info[S.game].meta : null) : null;
    $('ghead').innerHTML = `
      <span class="gico">${g.icon}</span>
      <div><div class="gt1">${g.name} <span style="color:var(--mut);font-size:13px">(${g.short})</span></div>
      <div class="gt2">${g.intro}</div></div>
      <div class="gmeta">
        <span class="pill">📅 ${esc(g.schedule)}</span>
        <span class="pill">🏷 归属 <b>${CATS[g.cat].name}</b></span>
        <span class="pill">🗂 官方历史 <b>${info ? info.total : '…'}</b> 期</span>
        ${meta ? `<span class="pill">📡 ${esc(meta.source)}</span>` : ''}
      </div>`;
  }
  function renderTabs() { /* tab visibility is CSS-based via active class handled at bind */ }

  // ---------- 渲染入口 ----------
  function renderAll() {
    renderOverview(); renderAnalysis(); renderPickSettings(); renderCheck(); renderRules();
  }

  // =========================================================
  // ① 开奖总览
  // =========================================================
  function nextDrawDate(g) {
    const days = DRAW_WEEKDAYS[g.key];
    if (!days) return null;
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (days.includes(dt.getDay())) {
        if (i === 0 && now.getHours() >= 21) continue;
        return dt;
      }
    }
    return null;
  }
  function renderOverview() {
    const g = G[S.game]; const ds = S.draws;
    const last = ds.length ? ds[ds.length - 1] : null;
    $('ovLatestMeta').textContent = last ? `${last.code} 期 · ${fmtDate(last.date)}（周${last.week ? last.week : ''}）` : '';
    $('ovLatest').innerHTML = last ? ballsHtml(g, last.nums) : '<span class="muted">暂无数据</span>';
    if (last) {
      const sh = shapeOf(g, last);
      const chips = [];
      chips.push(`和值 ${sh.sum}`);
      chips.push(`奇数 ${sh.odd} 个`);
      chips.push(`跨度 ${sh.span}`);
      if (g.digits === 3 && !g.maxLast) chips.push(`形态 ${ML.numType(last.nums) === 'all' ? '豹子' : ML.numType(last.nums) === 'group3' ? '组三' : '组六'}`);
      if (g.key === 'kl8') chips.push(`区间 ${sh.zones.join('/')}`);
      $('ovLatestExtra').innerHTML = chips.map((c) => `<span class="chip" style="cursor:default">${c}</span>`).join('');
    }
    // 开奖安排
    const nd = nextDrawDate(g);
    const dstr = nd ? `${nd.getMonth() + 1}月${nd.getDate()}日（周${WEEK[nd.getDay()]}）` : '每天一期';
    const info = S.info && S.info[S.game] ? S.info[S.game] : null;
    $('ovSchedule').innerHTML = `
      <div class="row"><span class="k">开奖周期</span><span class="v">${esc(g.schedule.replace('（约', '（约'))}</span></div>
      <div class="row"><span class="k">下一期</span><span class="v big-v">${dstr}</span></div>
      <div class="row"><span class="k">玩法类型</span><span class="v">${g.kind === 'digit' ? '逐位数字彩' : '区间选号彩'}</span></div>
      <div class="row"><span class="k">官方数据源</span><span class="v">${esc(g.source)}</span></div>
      <div class="row"><span class="k">已收录</span><span class="v">${info ? info.total : '…'} 期</span></div>
      ${S.updatedAt ? `<div class="row"><span class="k">数据更新</span><span class="v">${new Date(S.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span></div>` : ''}
      <div class="note">体彩/福彩休市日除外；开奖时间以官方公告为准。</div>`;
    // 最近明细
    const n = Math.min(15, ds.length);
    const rows = ds.slice(-n).reverse();
    $('ovCount').textContent = `最近 ${n} 期（倒序）`;
    const trs = rows.map((d) => {
      const sh = shapeOf(g, d);
      const metaTxt = `<span class="code">${d.code}</span>`;
      const dateTxt = `${d.date}`;
      const balls = `<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">${ballsHtml(g, d.nums, 'sm')}</div>`;
      const sumTxt = `<span class="muted">和 ${sh.sum}</span>`;
      return `<tr><td>${metaTxt}</td><td class="muted">${dateTxt}</td><td>${balls}</td><td>${sumTxt}</td></tr>`;
    }).join('');
    $('ovRecent').innerHTML = `<table class="tbl"><thead><tr><th>期号</th><th>日期</th><th>开奖号码</th><th>形态</th></tr></thead><tbody>${trs}</tbody></table>`;
    // 矩阵（仅数字彩）
    const isDigit = g.kind === 'digit';
    $('ovMatrixCard').style.display = isDigit ? '' : 'none';
    if (isDigit) {
      $('ovMatrixLen').innerHTML = segHtml([[10, '10期'], [15, '15期'], [20, '20期'], [30, '30期']], 10, 'n');
      bindSeg('ovMatrixLen', 'n', (val) => renderMatrix(Number(val)));
      renderMatrix(10);
    }
  }
  function renderMatrix(n) {
    const g = G[S.game]; const ds = S.draws;
    const rows = ds.slice(-n).reverse();
    const head = `<th>期号</th>${g.positions.map((p) => `<th>${p}</th>`).join('')}<th>和值</th><th>跨度</th>`;
    const trs = rows.map((d) => {
      const sh = shapeOf(g, d);
      const tds = d.nums.map((v) => `<td><span class="hit">${v}</span></td>`).join('');
      return `<tr><td class="code">${d.code}</td>${tds}<td>${sh.sum}</td><td>${sh.span}</td></tr>`;
    }).join('');
    $('ovMatrix').innerHTML = `<table class="tbl mtx"><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  // =========================================================
  // ② 数据分析
  // =========================================================
  function renderAnalysis() {
    const g = G[S.game]; const ds = S.draws;
    $('anaWinSeg').innerHTML = segHtml([[30, '近30期'], [50, '近50期'], [100, '近100期'], [200, '近200期'], [0, '全部']], S.anaWin, 'n');
    bindSeg('anaWinSeg', 'n', (val) => { S.anaWin = Number(val); renderAnalysis(); });
    const win = S.anaWin || ds.length;
    $('anaNote').textContent = `统计窗口：${S.anaWin === 0 ? '全部历史' : '近' + S.anaWin + '期'}（共 ${Math.min(win, ds.length)} 期） · 红=热 / 蓝=冷`;
    renderFreq(g, ds, win);
    renderHotCold(g, ds, win);
    renderShape(g, ds, win);
  }
  function freqColor(v, max) {
    const t = max > 0 ? v / max : 0;
    const hue = 215 - t * 150; // 蓝→红
    return `linear-gradient(180deg, hsla(${hue},85%,55%,.85), hsla(${hue},85%,42%,.65))`;
  }
  function renderFreq(g, ds, win) {
    const w = ds.slice(-win);
    const gTitle = $('freqTitle'); gTitle.textContent = g.kind === 'digit' ? '🎨 各位数字出现频率（红=热 / 蓝=冷，格内=出现次数）' : `🎨 ${g.name} 号码出现频率（红=热 / 蓝=冷，格内=出现次数）`;
    let html = '';
    if (g.kind === 'digit') {
      html = '<div class="freq-pos">';
      for (let p = 0; p < g.digits; p++) {
        const maxD = p === g.digits - 1 && g.maxLast != null ? g.maxLast : 9;
        const cnt = new Array(maxD + 1).fill(0);
        for (const d of w) cnt[d.nums[p]]++;
        const mx = Math.max(1, ...cnt);
        const cells = cnt.map((c, d) => `<span class="cell" style="background:${freqColor(c, mx)}"><span class="n">${d}</span><span class="c">${c}</span></span>`).join('');
        html += `<div class="row"><span class="pn">${g.positions[p]}</span>${cells}</div>`;
      }
      html += '</div>';
    } else {
      html = g.groups.map((grp, gi) => {
        const cnt = new Array(grp.max + 1).fill(0);
        for (const d of w) {
          const nums = d.nums;
          let off = 0; for (let x = 0; x < gi; x++) off += g.groups[x].pick;
          for (let k = 0; k < grp.pick; k++) cnt[nums[off + k]]++;
        }
        const mx = Math.max(1, ...cnt);
        const cells = [];
        for (let v = 1; v <= grp.max; v++) cells.push(`<span class="cell" style="background:${freqColor(cnt[v], mx)}"><span class="n">${pad2(v)}</span><span class="c">${cnt[v]}</span></span>`);
        return `<div class="freq-grp"><div class="fg-title">${grp.name}（选 ${grp.pick} / ${grp.max}）</div><div class="freq-grid" style="grid-template-columns:repeat(${Math.min(grp.max, 10)},1fr)">${cells.join('')}</div></div>`;
      }).join('');
    }
    $('freqWrap').innerHTML = html;
  }
  function hotColdItems(g, ds, win) {
    const w = ds.slice(-win);
    if (g.kind === 'digit') {
      const out = [];
      for (let p = 0; p < g.digits; p++) {
        const maxD = p === g.digits - 1 && g.maxLast != null ? g.maxLast : 9;
        const cnt = new Array(maxD + 1).fill(0);
        for (const d of w) cnt[d.nums[p]]++;
        const arr = cnt.map((c, d) => ({ v: d, c })).sort((a, b) => b.c - a.c || a.v - b.v);
        out.push({ label: g.positions[p], hot: arr.slice(0, 2), cold: arr.slice(-2).reverse() });
      }
      return out;
    }
    return g.groups.map((grp, gi) => {
      const cnt = new Array(grp.max + 1).fill(0);
      for (const d of w) {
        let off = 0; for (let x = 0; x < gi; x++) off += g.groups[x].pick;
        for (let k = 0; k < grp.pick; k++) cnt[d.nums[off + k]]++;
      }
      const arr = [];
      for (let v = 1; v <= grp.max; v++) arr.push({ v, c: cnt[v] });
      arr.sort((a, b) => b.c - a.c || a.v - b.v);
      return { label: grp.name, hot: arr.slice(0, 4), cold: arr.slice(-4).reverse() };
    });
  }
  function renderHotCold(g, ds, win) {
    const items = hotColdItems(g, ds, win);
    const wrap = (list) => `<div class="hotcold">${list.map((it) => {
      const hot = it.hot.map((x) => `<span class="num" style="color:#ff6b81">${g.kind === 'digit' ? x.v : pad2(x.v)}</span><span class="dim">×${x.c}</span>`).join(' ');
      const cold = it.cold.map((x) => `<span class="num" style="color:#6fb1ff">${g.kind === 'digit' ? x.v : pad2(x.v)}</span><span class="dim">×${x.c}</span>`).join(' ');
      return `<div class="item"><span class="lb">${it.label}</span><span>🔥 ${hot}</span><span style="margin-left:auto">🧊 ${cold}</span></div>`;
    }).join('')}</div>`;
    $('hotWrap').innerHTML = wrap(items);
    $('coldWrap').innerHTML = `<div class="hotcold">${items.map((it) => {
      const cold = it.cold.map((x) => `<span class="num" style="color:#6fb1ff">${g.kind === 'digit' ? x.v : pad2(x.v)}</span><span class="dim">遗漏较大</span>`).join(' ');
      return `<div class="item"><span class="lb">${it.label}</span><span>${cold}</span></div>`;
    }).join('')}</div>`;
  }
  function renderShape(g, ds, win) {
    const w = ds.slice(-win);
    if (!w.length) { $('shapeStats').innerHTML = ''; return; }
    const sumA = [], oddA = [], spanA = [];
    for (const d of w) { const s = shapeOf(g, d); sumA.push(s.sum); oddA.push(s.odd); spanA.push(s.span); }
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const last = shapeOf(g, w[w.length - 1]);
    const rows = [
      ['和值', avg(sumA).toFixed(1), last.sum],
      ['奇数个数', avg(oddA).toFixed(1), last.odd],
      ['跨度', avg(spanA).toFixed(1), last.span],
    ];
    const label = g.kind === 'digit' ? '（号码整体）' : (g.key === 'kl8' ? '（20 个号码）' : `（${g.groups[0].name} ${g.groups[0].pick} 个）`);
    $('shapeStats').innerHTML = `<div class="shape-stats">${rows.map((r) => `<div class="item"><span class="lb" style="width:70px;color:var(--mut)">${r[0]}</span><span>窗口均值 <b>${r[1]}</b></span><span>最近一期 <b>${r[2]}</b></span></div>`).join('')}</div>
      <div class="note">统计对象${label}；仅描述历史分布，与下一期概率无关。</div>`;
  }

  // =========================================================
  // ③ 智能出号
  // =========================================================
  function pickModeOptions(g) {
    return ML.playOptions(g.key).map((x) => [x.key, x.label]);
  }
  function paramValue(key, fallback) {
    const v = S.pick.params[key];
    return v == null ? fallback : v;
  }
  function numberOptions(start, end, suffix) {
    const out = [];
    for (let i = start; i <= end; i++) out.push([i, String(i) + (suffix || '')]);
    return out;
  }
  function paramControl(key, label, options) {
    const current = paramValue(key, options[0] && options[0][0]);
    return `<div class="param-row pick-param" data-param-key="${key}"><label>${label}</label><div class="seg wrap param-seg">${segHtml(options, current, 'pv')}</div></div>`;
  }
  function renderPickSettings() {
    const g = G[S.game];
    const modes = pickModeOptions(g);
    const allowed = modes.map((m) => m[0]);
    if (!allowed.includes(S.pick.mode)) S.pick.mode = allowed[0] || 'single';
    $('pickStratSeg').innerHTML = segHtml(STRATS, S.pick.strategy, 's');
    bindSeg('pickStratSeg', 's', (v) => { S.pick.strategy = v; });
    $('pickModeField').style.display = modes.length > 1 ? '' : 'none';
    $('pickModeSeg').innerHTML = segHtml(modes, S.pick.mode, 'm');
    bindSeg('pickModeSeg', 'm', (v) => { S.pick.mode = v; renderPickSettings(); });
    const isKl8 = g.key === 'kl8';
    $('pickWField').style.display = isKl8 ? '' : 'none';
    if (isKl8) {
      $('pickWSeg').innerHTML = segHtml([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], S.pick.w, 'w');
      bindSeg('pickWSeg', 'w', (v) => {
        S.pick.w = Number(v);
        if (S.pick.mode === 'dantuo' && S.pick.w < 2) S.pick.mode = 'single';
        renderPickSettings();
      });
    }
    const controls = [];
    const mode = S.pick.mode;
    const maxTimes = g.key === 'kl8' ? 15 : 99;
    const allowedTimes = [1, 2, 5, 10, maxTimes];
    if (!allowedTimes.includes(Number(paramValue('times', 1)))) S.pick.params.times = 1;
    if (g.key === 'dlt') {
      const main = mode.includes('compound') && (mode === 'front_compound' || mode === 'full_compound') ? paramControl('mainSize', '前区选号个数', numberOptions(6, 10, '码')) : '';
      const sub = (mode === 'back_compound' || mode === 'full_compound') ? paramControl('subSize', '后区选号个数', numberOptions(3, 6, '码')) : '';
      const dan = mode.includes('dantuo') && (mode === 'front_dantuo' || mode === 'full_dantuo') ? paramControl('mainDan', '前区胆码', numberOptions(1, 4, '胆')) : '';
      const subDan = (mode === 'back_dantuo' || mode === 'full_dantuo') ? paramControl('subSize', '后区号码总数', numberOptions(3, 6, '码')) : '';
      controls.push(main, sub, dan, subDan);
    } else if (g.key === 'ssq') {
      const main = (mode === 'red_compound' || mode === 'full_compound' || mode === 'red_dantuo' || mode === 'full_dantuo') ? paramControl('mainSize', '红球号码总数', numberOptions(7, 10, '码')) : '';
      const sub = (mode === 'blue_compound' || mode === 'full_compound' || mode === 'full_dantuo') ? paramControl('subSize', '蓝球选号个数', numberOptions(2, 6, '码')) : '';
      const dan = (mode === 'red_dantuo' || mode === 'full_dantuo') ? paramControl('mainDan', '红球胆码', numberOptions(1, 5, '胆')) : '';
      controls.push(main, sub, dan);
    } else if (g.key === 'qxc' && mode !== 'direct') {
      controls.push(paramControl('digitsPerPos', '每个复式位选号', [[2, '2个'], [3, '3个']]));
    } else if (g.key === 'pl3' || g.key === 'pl5' || g.key === 'f3d') {
      if (mode === 'direct_compound') controls.push(paramControl('digitsPerPos', '每位置选号个数', [[2, '2个'], [3, '3个']]));
      if (mode === 'direct_combo_compound') controls.push(paramControl('poolSize', '组合选号个数', numberOptions(3, 6, '码')));
      if (mode === 'group3_compound') controls.push(paramControl('poolSize', '组选3选号个数', numberOptions(2, 6, '码')));
      if (mode === 'group6_compound') controls.push(paramControl('poolSize', '组选6选号个数', numberOptions(4, 8, '码')));
      if (mode === 'group3_dantuo') controls.push(paramControl('tuoCount', '拖码个数', numberOptions(2, 6, '拖')));
      if (mode === 'group6_dantuo' || mode === 'direct_combo_dantuo') {
        controls.push(paramControl('danCount', '胆码个数', numberOptions(1, 2, '胆')));
        controls.push(paramControl('totalSize', '胆码+拖码总数', numberOptions(4, 8, '码')));
      }
      if (mode.endsWith('_span')) controls.push(paramControl('spanCount', '选择跨度个数', numberOptions(1, 3, '个')));
      if (mode.endsWith('_sum')) controls.push(paramControl('sumCount', '选择和值个数', numberOptions(1, 4, '个')));
    } else if (g.key === 'kl8') {
      if (mode === 'compound' || (mode === 'dantuo' && S.pick.w > 1)) controls.push(paramControl('extra', '超出单式的加选码', numberOptions(1, 3, '码')));
      if (mode === 'dantuo' && S.pick.w > 1) controls.push(paramControl('danCount', '胆码个数', numberOptions(1, S.pick.w - 1, '胆')));
    } else if (g.key === 'f3d') {
      if (mode === '1d') controls.push(paramControl('pos', '指定位置', [[0, '百位'], [1, '十位'], [2, '个位']]));
      if (mode === '2d') controls.push(paramControl('positions', '指定两位', [['0,1', '百+十'], ['1,2', '十+个'], ['0,2', '百+个']]));
    }
    controls.push(paramControl('times', '多倍投注', [[1, '1倍'], [2, '2倍'], [5, '5倍'], [10, '10倍'], [maxTimes, maxTimes + '倍']]));
    if (g.key === 'dlt') controls.push(paramControl('append', '追加投注', [[false, '不追加'], [true, '追加 +1元']]));
    if (g.key === 'f3d') controls.push(paramControl('periods', '连续期数', [[1, '1期'], [3, '3期'], [5, '5期'], [7, '7期']]));
    $('pickParamField').style.display = controls.some(Boolean) ? '' : 'none';
    $('pickParamLabel').textContent = '官方投注参数（' + (ML.playLabel(g.key, mode) || '') + '）';
    $('pickParams').innerHTML = controls.filter(Boolean).join('');
    $('pickParams').querySelectorAll('.pick-param').forEach((row) => {
      const key = row.dataset.paramKey;
      row.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          let value = b.dataset.pv;
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (key === 'positions') value = value.split(',').map(Number);
          else if (/^\d+$/.test(value)) value = Number(value);
          S.pick.params[key] = value;
          renderPickSettings();
        };
      });
    });
    $('pickWinSeg').innerHTML = segHtml(WINS, S.pick.win, 'n');
    bindSeg('pickWinSeg', 'n', (v) => { S.pick.win = Number(v); });
    $('pickCountSeg').innerHTML = segHtml(CNTS, S.pick.count, 'c');
    bindSeg('pickCountSeg', 'c', (v) => { S.pick.count = Number(v); });
  }
  function doGenerate(salt) {
    const g = G[S.game]; const ds = S.draws;
    if (!ds.length) { toast('暂无数据，请先更新', 'err'); return null; }
    const params = Object.assign({}, S.pick.params);
    const times = Math.max(1, Number(params.times) || 1);
    const append = g.key === 'dlt' && params.append === true;
    const periods = g.key === 'f3d' ? Math.max(1, Math.min(7, Number(params.periods) || 1)) : 1;
    delete params.times; delete params.append; delete params.periods;
    const o = Object.assign({ g, draws: ds, win: S.pick.win, strategy: S.pick.strategy, count: S.pick.count, salt: salt || Math.floor(Math.random() * 1e9), mode: S.pick.mode }, params);
    if (g.key === 'kl8') o.w = S.pick.w;
    const res = E.generate(o);
    res.tickets.forEach((t) => {
      t.baseCost = t.cost || 2;
      t.times = times;
      t.append = append;
      t.periods = periods;
      t.cost = t.baseCost * times * periods + (append ? t.combos * times * periods : 0);
    });
    S.lastTickets = res.tickets; S.lastPickInfo = {
      g, strategy: S.pick.strategy, win: S.pick.win, mode: S.pick.mode, w: g.key === 'kl8' ? S.pick.w : null,
      count: res.tickets.length, salt: o.salt, feats: res.feats, params: Object.assign({}, params, { times, append, periods }),
    };
    renderPickResult();
    return res;
  }
  function ticketModeText(g, t, info) {
    const label = ML.playLabel(g.key, t.kind || (info && info.mode) || 'single');
    const parts = [];
    if (g.key === 'kl8') parts.push(`选${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][t.w || (info && info.w) || 10]}`);
    if (label) parts.push(label);
    if (t.append) parts.push('追加');
    if (t.times > 1) parts.push(t.times + '倍');
    if (t.periods > 1) parts.push(t.periods + '期');
    return parts.join(' · ');
  }
  function ballHtml(g, v, idx, extra) {
    const isDigit = g.kind === 'digit';
    const cls = isDigit ? ballClass(g, idx) : (extra || 'gold');
    return `<span class="ball sm ${cls}">${isDigit ? v : pad2(v)}</span>`;
  }
  function ticketSelectionHtml(g, t) {
    if (t.option) return `<div class="nums"><span class="grp">${t.kind === 'bigsmall' ? '大小' : '奇偶'}</span><span class="ball sm gold">${esc(t.label || t.option)}</span></div>`;
    if (t.selections) {
      if (g.kind === 'digit') {
        return '<div class="nums">' + t.selections.map((row, p) => `<span class="grp">${g.positions[p] || '第' + (p + 1) + '位'}</span>${row.map((v) => ballHtml(g, v, p)).join('')}`).join('<span class="sep-x">|</span>') + '</div>';
      }
      return '<div class="nums">' + t.selections.map((row, gi) => {
        const color = g.groups[gi] ? g.groups[gi].cls : 'gold';
        if (row.kind === 'dantuo') {
          return `<span class="grp">胆</span>${row.dan.map((v) => ballHtml(g, v, 0, color)).join('')}<span class="sep-x">/</span><span class="grp">拖</span>${row.tuo.map((v) => ballHtml(g, v, 0, color)).join('')}`;
        }
        return `<span class="grp">${g.groups[gi] ? g.groups[gi].name : ''}</span>${row.nums.map((v) => ballHtml(g, v, 0, color)).join('')}`;
      }).join('<span class="sep-x">+</span>') + '</div>';
    }
    if (t.dan && t.tuo) {
      return `<div class="nums"><span class="grp">胆</span>${t.dan.map((v) => `<span class="ball sm gold">${g.kind === 'digit' ? v : pad2(v)}</span>`).join('')}<span class="sep-x">/</span><span class="grp">拖</span>${t.tuo.map((v) => `<span class="ball sm gold dim">${g.kind === 'digit' ? v : pad2(v)}</span>`).join('')}</div>`;
    }
    if (t.kind === '1d') return `<div class="nums"><span class="grp">${g.positions[t.pos] || ''}</span>${ballHtml(g, t.nums[0], t.pos || 0)}</div>`;
    if (t.kind === 'guess1d') return `<div class="nums"><span class="grp">任意位置</span>${ballHtml(g, t.nums[0], 0)}</div>`;
    if (t.kind === '2d') return `<div class="nums"><span class="grp">${t.posName || '指定两位'}</span>${t.nums.map((v, i) => ballHtml(g, v, t.positions[i])).join('')}</div>`;
    if (t.kind === 'guess2d_same') return `<div class="nums"><span class="grp">两同号</span>${ballHtml(g, t.nums[0], 0)}</div>`;
    if (t.kind === 'guess2d_diff') return `<div class="nums"><span class="grp">两不同号</span>${t.nums.map((v) => ballHtml(g, v, 0)).join('')}</div>`;
    if (t.kind === 'triple') return `<div class="nums"><span class="grp">三位同号</span>${ballHtml(g, t.nums[0], 0)}</div>`;
    if (t.sums) return `<div class="nums"><span class="grp">和值</span>${t.sums.map((v) => `<span class="ball sm purple">${v}</span>`).join('')}</div>`;
    if (t.spans) return `<div class="nums"><span class="grp">跨度</span>${t.spans.map((v) => `<span class="ball sm purple">${v}</span>`).join('')}</div>`;
    if (t.kind === 'sum') return `<div class="nums"><span class="grp">和值</span><span class="ball sm purple">${t.nums[0]}</span></div>`;
    return `<div class="nums">${groupedNumsHtml(g, t.nums)}</div>`;
  }
  function ticketToText(g, t) {
    if (t.selections) {
      if (g.kind === 'digit') return t.selections.map((row) => row.join(' ')).join(' | ');
      return t.selections.map((row) => row.kind === 'dantuo' ? `胆:${row.dan.join(' ')} 拖:${row.tuo.join(' ')}` : row.nums.join(' ')).join(' + ');
    }
    if (t.dan && t.tuo) return `胆:${t.dan.join(' ')} 拖:${t.tuo.join(' ')}`;
    if (t.option) return t.label || t.option;
    if (t.kind === '1d') return `${g.positions[t.pos] || ''} ${t.nums[0]}`;
    if (t.kind === '2d') return `${t.posName || '指定两位'} ${t.nums.join(' ')}`;
    if (t.sums) return `和值 ${t.sums.join(' ')}`;
    if (t.spans) return `跨度 ${t.spans.join(' ')}`;
    if (t.kind === 'sum') return `和值 ${t.nums[0]}`;
    if (t.kind === 'triple') return `猜三同 ${t.nums[0]}`;
    return fmtNums(g, t.nums);
  }
  function renderPickResult() {
    const g = G[S.game];
    const stName = (STRATS.find((x) => x[0] === S.pick.strategy) || [])[1] || S.pick.strategy;
    if (!S.lastTickets) { $('pickResult').innerHTML = '<div class="pick-empty">点击「🎯 生成参考号码」开始出号</div>'; $('pickRec').innerHTML = ''; return; }
    const ts = S.lastTickets;
    const totalCost = ts.reduce((a, t) => a + (t.cost || 2), 0);
    const combos = ts.reduce((a, t) => a + (t.combos || 1), 0);
    const recHtml = S.lastPickInfo.feats ? poolRecHtml(g, S.lastPickInfo.feats, S.pick) : '';
    $('pickRec').innerHTML = recHtml;
    const cards = ts.map((t, i) => {
      const times = t.times || 1, periods = t.periods || 1;
      const appendTxt = t.append ? ` · 含追加` : '';
      const supplement = `${t.combos} 注组合 × ${times}倍${periods > 1 ? ` × ${periods}期` : ''}${appendTxt} = ${t.cost} 元`;
      return `<div class="ticket"><div class="t-head"><span class="t-no">方案 ${i + 1}</span><span class="t-mode">${esc(ticketModeText(g, t, S.lastPickInfo))}</span></div>${ticketSelectionHtml(g, t)}
        <div class="g-sum">${supplement}</div></div>`;
    }).join('');
    $('pickResult').innerHTML = `<div class="note" style="margin-bottom:8px">策略：<b style="color:var(--cyan)">${stName}</b> · 窗口：近${S.pick.win}期 · ${ts.length} 个方案 · ${combos} 注组合 · 合计 ${totalCost} 元</div>${cards || '<div class="pick-empty">该官方玩法没有生成到有效方案</div>'}`;
  }
  function groupedNumsHtml(g, nums) {
    if (g.kind === 'digit') return nums.map((v, i) => `<span class="ball sm ${ballClass(g, i)}">${v}</span>`).join('');
    if (g.key === 'kl8') return nums.map((v) => `<span class="ball sm gold">${pad2(v)}</span>`).join('');
    const mid = g.groups[0].pick;
    const a = nums.slice(0, mid).map((v) => `<span class="ball sm red">${pad2(v)}</span>`).join('');
    const b = nums.slice(mid).map((v) => `<span class="ball sm blue">${pad2(v)}</span>`).join('');
    return a + '<span class="sep-x">+</span>' + b;
  }
  function poolRecHtml(g, feats, pick) {
    // 数字彩：各位高分参考前5；区间彩：各组高分参考前10
    let html = '<div class="note" style="margin-bottom:6px">✦ 高分参考（按当前策略评分排序）</div>';
    if (g.kind === 'digit') {
      const rank = (a, b) => (b.fFreq * 2 + b.fRec + b.fTrend * 0.5) - (a.fFreq * 2 + a.fRec + a.fTrend * 0.5);
      const rows = feats.map((row, p) => {
        const top = row.slice().sort(rank).slice(0, 5).map((x) => x.d).join(' ');
        return `<span class="pool-num"><b>${g.positions[p]}</b> ${top}</span>`;
      }).join('');
      html += `<div class="pick-pool" style="margin-bottom:0">${rows}</div>`;
    } else {
      const rank = (a, b) => (b.fFreq * 2 + b.fRec + b.fTrend * 0.5) - (a.fFreq * 2 + a.fRec + a.fTrend * 0.5);
      const groups = feats.map((row) => row.slice().sort(rank).slice(0, 10).map((x) => pad2(x.n)).join(' '));
      html += `<div class="pick-pool" style="margin-bottom:0">${g.groups.map((grp, i) => `<span class="pool-num"><b>${grp.name}</b> ${groups[i]}</span>`).join('')}</div>`;
    }
    return html;
  }
  function copyPicks() {
    if (!S.lastTickets) { toast('请先生成号码', 'err'); return; }
    const g = G[S.game];
    const lines = S.lastTickets.map((t, i) => `方案${i + 1} [${ticketModeText(g, t, S.lastPickInfo)}] ${ticketToText(g, t)}（${t.combos}注组合，${t.cost}元）`);
    const text = `${g.name} 智能参考 ${S.lastTickets.length} 个官方投注方案（策略：${S.pick.strategy}）\n` + lines.join('\n') + '\n—— 仅供统计参考，理性购彩';
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => toast('已复制全部号码', 'ok')); return; }
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制全部号码', 'ok'); } catch (e) { toast('复制失败，请手动复制', 'err'); }
    ta.remove();
  }

  // =========================================================
  // ④ 验票复盘
  // =========================================================
  function renderCheck() {
    const g = G[S.game]; const ds = S.draws;
    // 文本验票目前支持“可直接输入单式号码”的官方基础玩法
    const supported = g.key === 'f3d' ? ['direct', 'group3', 'group6'] : g.key === 'kl8' ? ['single'] : g.key === 'pl3' ? ['direct', 'group3', 'group6'] : ['direct'];
    const modes = pickModeOptions(g).filter((m) => supported.includes(m[0]));
    if (!modes.length) modes.push(['direct', '直选']);
    if (!supported.includes(S.chkMode)) S.chkMode = modes[0][0];
    $('chkModeLabel').textContent = g.key === 'kl8' ? '快乐8 玩法' : '玩法 / 投注方式';
    $('chkModeSeg').innerHTML = modes.length > 1 ? segHtml(modes, S.chkMode, 'm') : `<span class="muted" style="padding:8px 6px;font-size:12px">${modes[0][1]}</span>`;
    if (modes.length > 1) bindSeg('chkModeSeg', 'm', (v) => { S.chkMode = v; renderCheck(); });
    // 号码输入提示
    const ph = inputPlaceholder(g);
    $('chkNumsLabel').textContent = '你的号码（' + ph + '）';
    $('chkNums').placeholder = ph;
    // 期号下拉
    const opts = ds.slice(-60).reverse().map((d) => `<option value="${d.code}">${d.code} 期 · ${d.date}</option>`).join('');
    $('chkDrawSel').innerHTML = opts || '<option>暂无数据</option>';
    // 回测控件
    $('btStratSeg').innerHTML = segHtml(STRATS, S.bt.strategy, 's');
    bindSeg('btStratSeg', 's', (v) => { S.bt.strategy = v; });
    $('btLenSeg').innerHTML = segHtml([[100, '100期'], [200, '200期'], [500, '500期']], S.bt.len, 'n');
    bindSeg('btLenSeg', 'n', (v) => { S.bt.len = Number(v); });
    const isKl8 = g.key === 'kl8';
    $('btWField').style.display = isKl8 ? '' : 'none';
    if (isKl8) {
      $('btWSeg').innerHTML = segHtml([5, 6, 7, 8, 9, 10], S.bt.w, 'w');
      bindSeg('btWSeg', 'w', (v) => { S.bt.w = Number(v); });
    }
    $('btNote').textContent = isKl8
      ? `回测规则：只用“该期之前”的数据，按 选${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][S.bt.w]} 出 1 注，统计命中数，绝无未来函数。`
      : '回测规则：只用“该期之前”的数据出 1 注，逐位/逐号统计命中，绝无未来函数。';
  }
  function inputPlaceholder(g) {
    if (g.key === 'kl8') return `快乐8 选${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][S.pick.w || 6]}：例如 01 06 11 22 33 45（空格分隔）`;
    if (g.kind === 'digit') {
      const n = g.digits;
      const ex = g.key === 'qxc' ? '1234567' : g.key === 'pl5' ? '12345' : '361';
      return `${g.positions.join(' / ')}：例如 ${ex}`;
    }
    if (g.key === 'dlt') return '前区5个 + 后区2个：例如 09 11 18 26 33 + 09 11';
    return '红球6个 + 蓝球1个：例如 03 04 10 13 16 25 + 09';
  }
  function parseTicket(g, text) {
    if (!text) return null;
    if (g.kind === 'digit') {
      const digits = String(text).replace(/\s+/g, '');
      if (!/^\d+$/.test(digits) || digits.length !== g.digits) return null;
      const nums = digits.split('').map(Number);
      const maxLast = g.maxLast;
      if (g.key === 'qxc' && (nums[6] == null || nums[6] > maxLast)) return null;
      return nums;
    }
    if (g.key === 'kl8') {
      const arr = ML.parseBallNums(text, 80);
      if (!arr || new Set(arr).size !== arr.length || arr.length !== (S.pick.w || 6)) return null;
      return arr.slice().sort((a, b) => a - b);
    }
    // dlt / ssq：支持 '+' '|' 或空格分隔；前/后区各自范围校验
    const cleaned = String(text).replace(/[＋\+]/g, ' ').replace(/[|｜]/g, ' ').trim();
    const arr = cleaned.split(/[\s,，;；]+/).map((s) => parseInt(s, 10)).filter((x) => Number.isInteger(x));
    if (arr.length !== g.groups[0].pick + g.groups[1].pick) return null;
    const main = arr.slice(0, g.groups[0].pick);
    const sub = arr.slice(g.groups[0].pick);
    if (main.some((v) => v < 1 || v > g.groups[0].max) || new Set(main).size !== main.length) return null;
    if (sub.some((v) => v < 1 || v > g.groups[1].max) || new Set(sub).size !== sub.length) return null;
    return main.slice().sort((a, b) => a - b).concat(sub.slice().sort((a, b) => a - b));
  }
  function doCheck() {
    const g = G[S.game]; const ds = S.draws;
    const code = $('chkDrawSel').value;
    const draw = ds.find((d) => String(d.code) === String(code));
    if (!draw) { toast('请选择要对照的开奖期号', 'err'); return; }
    const ticketNums = parseTicket(g, $('chkNums').value);
    if (!ticketNums) { toast('号码格式不正确，请按提示输入', 'err'); return; }
    const ticket = { nums: ticketNums };
    if (g.kind === 'digit' && (g.key === 'pl3' || g.key === 'f3d')) ticket.mode = S.chkMode;
    if (g.key === 'kl8') ticket.w = S.pick.w || 6;
    const r = ML.verify(g.key, ticket, draw.nums);
    const winCls = r.win ? 'ok' : 'no';
    const prizeTxt = r.float ? '浮动奖（以当期公告为准）' : (r.prize > 0 ? `${ML.fmtMoney(r.prize)} 元` : '—');
    const tierName = r.tier > 0 ? (g.key === 'dlt' ? ['一', '二', '三', '四', '五', '六', '七', '八', '九'][r.tier - 1] : g.key === 'ssq' || g.key === 'qxc' ? ['一', '二', '三', '四', '五', '六'][r.tier - 1] : r.tier) : '';
    $('chkResult').innerHTML = `<div class="check-result ${winCls}">
      ${r.win ? `<span class="big">🎉 命中${tierName}等奖</span><span>${prizeTxt}</span>` : '<span class="big">😔 未中奖</span>'}
      <div>${esc(r.desc)}</div>
      <div style="font-size:12px;margin-top:6px">对照：${draw.code} 期 · ${draw.date} · 开奖 ${esc(fmtNums(g, draw.nums))}</div>
    </div>`;
  }
  function doBacktest() {
    const g = G[S.game]; const ds = S.draws;
    const len = Math.min(S.bt.len, ds.length - 5);
    const win = 80;
    if (len < 30) { toast('数据不足，无法回测', 'err'); return; }
    const o = { g, draws: ds, len, win, strategy: S.bt.strategy };
    if (g.key === 'kl8') o.w = S.bt.w;
    const t0 = performance.now();
    const rows = E.backtest(o);
    const s = E.summarize(g, rows);
    const dt = ((performance.now() - t0) / 1000).toFixed(1);
    const theory = E.theoryMean(g, g.key === 'kl8' ? S.bt.w : null);
    const strName = (STRATS.find((x) => x[0] === S.bt.strategy) || [])[1];
    // 分布条
    const maxLen = g.kind === 'digit' ? g.digits : (g.key === 'kl8' ? S.bt.w : g.groups[0].pick);
    let distHtml = '';
    if (g.kind === 'digit') {
      const perPos = [];
      for (let p = 0; p < g.digits; p++) perPos.push(rows.filter((r) => r.same >= p + 1).length / (rows.length || 1));
      distHtml = `<div class="tbl"><table class="tbl"><thead><tr><th>指标</th>${g.positions.map((p) => `<th>${p}</th>`).join('')}<th>全中</th></tr></thead>
        <tbody><tr><td>命中率</td>${perPos.map((v) => `<td>${(v * 100).toFixed(1)}%</td>`).join('')}<td>${(s.fullRate * 100).toFixed(2)}%</td></tr></tbody></table>
        <div class="note">理论：每位命中率 10%（排列类/3D 每位 0-9；七星彩末位 1/15）。回测均值 ${s.mean.toFixed(3)} · 近${len}期 · ${dt}s</div></div>`;
    } else {
      const cnt = rows.length || 1;
      const dist = [];
      for (let h = 0; h <= maxLen; h++) dist.push({ h, c: rows.filter((r) => r.same === h).length });
      distHtml = `<table class="tbl"><thead><tr><th>命中数</th>${dist.map((d) => `<th>${d.h}</th>`).join('')}</tr></thead>
        <tbody><tr><td>期数</td>${dist.map((d) => `<td>${d.c}</td>`).join('')}</tr>
        <tr><td>占比</td>${dist.map((d) => `<td>${((d.c / cnt) * 100).toFixed(1)}%</td>`).join('')}</tr></tbody></table>
        <div class="note">策略 <b style="color:var(--cyan)">${strName}</b> · 均值命中 ${s.mean.toFixed(2)}（理论 ${theory.toFixed(2)}）· 中任意奖 ${(s.fullRate * 100).toFixed(2)}% · ${len} 期 · ${dt}s</div>`;
    }
    $('btResult').innerHTML = distHtml;
  }

  // =========================================================
  // ⑤ 玩法奖金
  // =========================================================
  function renderRules() {
    const g = G[S.game];
    const rulesIntro = `${g.intro} 每注 2 元（大乐透可追加 +1 元）。${g.schedule}。`;
    $('rulesIntro').textContent = rulesIntro;
    // 奖级表
    let tableHtml = '';
    if (g.key === 'pl3') {
      tableHtml = rowsHtml([['玩法', '中奖条件', '单注奖金'], ...ML.P3_PRIZES.map((p) => [p.name, p.desc, p.prize + ' 元'])]);
    } else if (g.key === 'f3d') {
      tableHtml = rowsHtml([['玩法', '中奖条件', '单注奖金'], ...ML.F3D_PRIZES.map((p) => [p.name, p.desc, p.prize + ' 元'])]);
    } else if (g.key === 'pl5') {
      tableHtml = rowsHtml([['奖级', '中奖条件', '单注奖金'], ...ML.P5_PRIZES.map((p) => [p.name, p.desc, p.prize + ' 元'])]);
    } else if (g.key === 'qxc') {
      tableHtml = rowsHtml([['奖级', '中奖条件', '单注奖金'], ...ML.QXC_PRIZES.map((p) => [p.name + (p.tier <= 2 ? '(浮动)' : ''), p.cond, p.prize === '浮动' ? p.cap : p.prize + ' 元'])]);
    } else if (g.key === 'dlt') {
      tableHtml = rowsHtml([['奖级', '中奖条件', '单注奖金'], ...ML.DLT_PRIZES.map((p) => [p.name, p.cond, p.prize === '浮动' ? (p.cap || '浮动') : p.prize + ' 元'])]);
    } else if (g.key === 'ssq') {
      tableHtml = rowsHtml([['奖级', '中奖条件', '单注奖金'], ...ML.SSQ_PRIZES.map((p) => [p.name, p.cond, p.prize === '浮动' ? (p.cap || '浮动') : p.prize + ' 元'])]);
    } else {
      const rows = [['玩法', '中奖条件', '单注奖金']];
      for (const w of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        for (const row of ML.KL8_PRIZES[w]) {
          rows.push([ML.KL8_PLAY(w), `${ML.KL8_PLAY(w)}中${row.hit}`, row.prize == null ? '浮动(最高' + (w === 9 ? '25万' : '500万') + ')' : row.prize + ' 元']);
        }
      }
      tableHtml = rowsHtml(rows);
    }
    $('prizeTable').innerHTML = tableHtml;
    $('prizeNote').textContent = '数据依据：' + g.source + '官网现行玩法与投注规则。浮动奖、派奖及官方特别规定以当期公告为准。';
    // 概率表
    $('probTable').innerHTML = renderProb(g);
  }
  function rowsHtml(rows) {
    const head = rows[0];
    return `<table class="tbl prize-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.slice(1).map((r) => `<tr>${r.map((c, i) => i === r.length - 1 && !/浮动|—/.test(c) ? `<td class="prize-amt">${c}</td>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderProb(g) {
    if (g.key === 'pl3') {
      return rowsHtml([['玩法', '理论概率', '约 1 注中奖概率'], ...ML.P3_PRIZES.map((p) => [p.name, (p.prob * 100).toFixed(3) + '%', '1 / ' + ML.odds(p.prob)])]);
    }
    if (g.key === 'f3d') {
      return rowsHtml([['玩法', '参考概率', '说明'], ...ML.F3D_PRIZES.map((p) => [p.name, p.prob === 1 ? '按号码/和值条件' : (p.prob * 100).toFixed(3) + '%', p.desc])]);
    }
    if (g.key === 'pl5') return rowsHtml([['玩法', '理论概率', '约 1 注中奖概率'], ...ML.P5_PRIZES.map((p) => [p.name, (p.prob * 100).toFixed(4) + '%', '1 / ' + ML.odds(p.prob)])]);
    if (g.key === 'qxc') {
      const probs = ML.qxcProb();
      return rowsHtml([['奖级', '理论概率', '约 1 /'], ...probs.map((r, i) => {
        const row = ML.QXC_PRIZES[i];
        return [row.name, (r.p * 100).toFixed(6) + '%', ML.odds(r.p)];
      })]);
    }
    if (g.key === 'dlt' || g.key === 'ssq') {
      const table = g.key === 'dlt' ? ML.DLT_PRIZES : ML.SSQ_PRIZES;
      const rows = [];
      for (let tier = 1; tier <= table.length; tier++) {
        let p = 0;
        const pick = g.key === 'dlt' ? 5 : 6, pick2 = g.key === 'dlt' ? 2 : 1;
        for (let i = 0; i <= pick; i++) for (let j = 0; j <= pick2; j++) {
          const hitMap = g.key === 'dlt' ? ML.DLT_MATCH : ML.SSQ_MATCH;
          if ((hitMap[i] || {})[j] === tier) p += g.key === 'dlt' ? ML.dltProbIJ(i, j) : ML.ssqProbIJ(i, j);
        }
        rows.push([table[tier - 1].name, (p * 100).toFixed(6) + '%', p > 0 ? '1 / ' + ML.odds(p) : '—']);
      }
      return rowsHtml([['奖级', '理论概率', '约 1 /'], ...rows]);
    }
    // kl8
    const rows = [];
    for (const w of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const row of ML.KL8_PRIZES[w]) {
        const p = ML.kl8Prob(w, row.hit);
        rows.push([ML.KL8_PLAY(w) + '中' + row.hit, (p * 100).toFixed(5) + '%', p > 0 ? '1 / ' + ML.odds(p) : '—']);
      }
    }
    return rowsHtml([['中奖档', '理论概率', '约 1 /'], ...rows]);
  }

  // =========================================================
  // ⑥ 导出结果图片（1080 宽 · 槽位化绘制 · 科技风）
  // =========================================================
  function exportPickImage() {
    const g = G[S.game];
    if (!S.lastTickets) { const ok = doGenerate(); if (!ok) return; }
    const ts = S.lastTickets; const info = S.lastPickInfo;
    const W = 1080, M = 64;
    const stName = (STRATS.find((x) => x[0] === S.pick.strategy) || [])[1];
    const modeName = info ? modeLabel(g, info.mode, info.w) : '';
    const n = ts.length;
    // 估算高度：页眉 + 信息条 + 每注卡 + 底部
    const headH = 300, metaH = 120, footH = 230;
    const perCard = g.key === 'kl8' ? 168 : 148;
    const H = headH + metaH + n * perCard + footH;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const cn = (px, bold) => `${bold ? '700 ' : '400 '}${px}px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;
    // 背景
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a1024'); bg.addColorStop(.5, '#0e1735'); bg.addColorStop(1, '#081020');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 网格线
    ctx.strokeStyle = 'rgba(53,224,255,.06)';
    for (let x = 0; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // 对角光带
    const lg = ctx.createLinearGradient(0, 0, W, 300);
    lg.addColorStop(0, 'rgba(53,224,255,.16)'); lg.addColorStop(1, 'rgba(124,77,255,.10)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W - 260, headH); ctx.lineTo(0, headH - 60); ctx.closePath(); ctx.fill();
    // —— 页眉 ——
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#35e0ff'; ctx.font = cn(15, false);
    ctx.fillText('体彩 · 福彩 多游戏智能参考中心', M, 46);
    ctx.fillStyle = 'rgba(53,224,255,.5)'; ctx.font = cn(12, false);
    ctx.textAlign = 'right'; ctx.fillText('DATA · SMART REFERENCE', W - M, 46);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = cn(44, true);
    ctx.fillText(`${g.icon} ${g.name} · 智能参考出号`, M, 118);
    ctx.fillStyle = '#9fb6ea'; ctx.font = cn(17, false);
    ctx.fillText(`归属：${CATS[g.cat].name} ｜ ${g.schedule} ｜ 数据源：${g.source}`, M, 164);
    // 信息条（黄金分隔槽）
    const infoY = headH - 76;
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    roundRect(ctx, M, infoY, W - M * 2, 64, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(53,224,255,.25)'; ctx.stroke();
    const segW = (W - M * 2) / 5;
    const infoRows = [
      ['出号策略', stName], ['统计窗口', `近 ${info.win} 期`], ['玩法', modeName],
      ['生成注数', `${n} 注`], ['生成时间', nowStr()],
    ];
    ctx.textAlign = 'center';
    infoRows.forEach((it, i) => {
      const cx = M + segW * i + segW / 2;
      ctx.fillStyle = '#6f86c4'; ctx.font = cn(13, false);
      ctx.fillText(it[0], cx, infoY + 24);
      ctx.fillStyle = '#eaf3ff'; ctx.font = cn(17, true);
      ctx.fillText(it[1], cx, infoY + 47);
    });
    // —— 每注卡片 ——
    let y = headH + metaH - 30;
    ts.forEach((t, i) => {
      const cardH = g.key === 'kl8' ? 168 : 148;
      const cy = y;
      // 卡背景
      ctx.fillStyle = 'rgba(23,35,74,.75)';
      roundRect(ctx, M, cy, W - M * 2, cardH - 16, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(90,120,220,.35)'; ctx.stroke();
      // 序号
      ctx.fillStyle = 'rgba(255,207,92,.15)';
      ctx.beginPath(); ctx.arc(M + 42, cy + (cardH - 16) / 2, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf5c'; ctx.font = cn(22, true); ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), M + 42, cy + (cardH - 16) / 2 + 1);
      ctx.textAlign = 'left';
      const modeTxt = ticketModeText(g, t);
      ctx.fillStyle = 'rgba(53,224,255,.9)'; ctx.font = cn(14, false);
      ctx.fillText(modeTxt, M + 84, cy + 26);
      ctx.fillStyle = '#9fb6ea'; ctx.font = cn(12, false);
      const costTxt = t.combos > 1 ? `${t.combos} 注组合 · 投注 ${t.cost} 元` : '单式 1 注 · 2 元';
      ctx.textAlign = 'right'; ctx.fillText(costTxt, W - M, cy + 26); ctx.textAlign = 'left';
      // 球
      drawTicketBalls(ctx, g, t, M + 84, cy + 78, W, M);
      y += cardH;
    });
    // —— 底部 ——
    ctx.fillStyle = 'rgba(53,224,255,.55)'; ctx.font = cn(13, false); ctx.textAlign = 'center';
    ctx.fillText('✦ 高分参考与回测请于系统内查看 · 长图已含全部生成注数 ✦', W / 2, y + 46);
    ctx.fillStyle = '#8fa3cf'; ctx.font = cn(15, false);
    ctx.fillText('以上号码仅为历史统计参考，不构成中奖预测；每期开奖相互独立，请理性购彩。', W / 2, y + 82);
    ctx.fillStyle = '#6f86c4'; ctx.font = cn(13, false);
    ctx.fillText('彩票有风险，投注需理性 · 未成年人不得购买彩票 · 数据来源：体彩 sporttery.cn / 福彩 cwl.gov.cn', W / 2, y + 112);
    const link = document.createElement('a');
    link.download = `${g.name}_智能参考_${dateStamp()}_${n}注.png`;
    link.href = cv.toDataURL('image/png');
    link.click();
    toast(`已导出结果图片（1080 宽 PNG，含全部 ${n} 注）`, 'ok');
  }
  function nowStr() {
    const d = new Date();
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function dateStamp() { const d = new Date(); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; }
  function modeLabel(g, mode, w) {
    const base = ML.playLabel(g.key, mode || 'direct');
    return g.key === 'kl8' ? `选${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][w || 10]} · ${base}` : base;
  }
  function ballColors(g, t) {
    // 返回每个球的 (类名) — 复用前端规则
    if (t.kind === 'dantuo') {
      return { dan: 'gold', tuo: 'goldDim' };
    }
    const cls = [];
    if (g.kind === 'digit') { for (let i = 0; i < g.digits; i++) cls.push(g.key === 'qxc' && i === 6 ? '#a879ff' : '#4da6ff'); return cls; }
    if (g.key === 'dlt') { for (let i = 0; i < 7; i++) cls.push(i < 5 ? '#ff5f77' : '#4da6ff'); return cls; }
    if (g.key === 'ssq') { for (let i = 0; i < 7; i++) cls.push(i < 6 ? '#ff5f77' : '#4da6ff'); return cls; }
    return null;
  }
  function drawTicketBalls(ctx, g, t, x0, y0, W, M) {
    const R = 24, gap = 12;
    const colors = ballColors(g, t);
    const slots = [];
    const addSlot = (v, color, dim) => slots.push({ v, color, dim });
    if (t.option) {
      ctx.fillStyle = '#ffcf5c'; ctx.font = `700 26px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label || t.option, x0, y0 + R);
      return;
    }
    if (t.selections) {
      const flat = [];
      t.selections.forEach((row) => {
        if (row.kind === 'dantuo') flat.push(...row.dan, null, ...row.tuo);
        else flat.push(...row.nums);
        flat.push(null);
      });
      if (flat[flat.length - 1] === null) flat.pop();
      flat.forEach((v, i) => addSlot(v, colors && colors[Math.min(i, colors.length - 1)] || '#ffcf5c', false));
    } else if (t.kind === 'dantuo') {
      t.dan.forEach((v) => addSlot(v, '#ffcf5c', false));
      addSlot(null, '#6f86c4', false); // 分隔
      t.tuo.forEach((v) => addSlot(v, '#ffcf5c', true));
    } else if (t.kind === 'compound') {
      t.nums.forEach((v) => addSlot(v, '#ffcf5c', false));
    } else if (g.kind === 'digit') {
      t.nums.forEach((v, i) => addSlot(v, colors && colors[i] || '#4da6ff', false));
    } else if (g.key === 'kl8') {
      t.nums.forEach((v) => addSlot(v, '#ffcf5c', false));
    } else {
      t.nums.forEach((v, i) => addSlot(v, colors[i], false));
      // 主/次组之间加分隔
      const mid = g.groups[0].pick;
      slots.splice(mid, 0, { v: null, color: '#6f86c4', dim: false });
    }
    const maxRow = Math.floor((W - M * 2 - (x0 - M)) / (R * 2 + gap));
    let row = 0, col = 0;
    slots.forEach((s) => {
      const x = x0 + col * (R * 2 + gap);
      if (s.v === null) { ctx.fillStyle = '#5f76b0'; ctx.font = '700 22px sans-serif'; ctx.fillText('＋', x, y0 + 1); col++; if (col >= maxRow) { col = 0; row++; } return; }
      if (x + R * 2 > W - M) { col = 0; row++; }
      const cx = x0 + col * (R * 2 + gap), cy = y0 + row * (R * 2 + 10);
      ctx.globalAlpha = s.dim ? .55 : 1;
      const grad = ctx.createRadialGradient(cx + R * .7, cy + R * .7, 2, cx + R, cy + R, R * 1.2);
      grad.addColorStop(0, lighten(s.color)); grad.addColorStop(1, s.color);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx + R, cy + R, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#0b1020'; ctx.font = `700 ${g.kind === 'digit' ? 20 : 18}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.kind === 'digit' ? String(s.v) : pad2(s.v), cx + R, cy + R + 1);
      ctx.globalAlpha = 1;
      col++;
      if (col >= maxRow) { col = 0; row++; }
    });
    ctx.textAlign = 'left';
  }
  function lighten(hex) {
    // 简化：浅色高光
    return 'rgba(255,255,255,.45)';
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // =========================================================
  // ⑦ 弹窗 / 刷新 / 事件
  // =========================================================
  function bindSeg(containerId, dataKey, cb) {
    const el = $(containerId); if (!el) return;
    el.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        el.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        cb(b.dataset[dataKey]);
      };
    });
  }
  function switchTab(name) {
    document.querySelectorAll('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + name));
  }
  async function openLan() {
    $('lanModal').classList.remove('hidden');
    $('lanBody').innerHTML = '加载中…';
    if (S.static) {
      $('lanBody').innerHTML = `<div class="lan-link"><small>当前在线地址</small>${esc(location.href)}</div><div class="note">GitHub Pages 版本已上传到公网，可直接复制当前网址分享。</div>`;
      return;
    }
    try {
      const r = await fetch('/api/lan'); const j = await r.json();
      $('lanBody').innerHTML = `<div class="lan-link"><small>本机访问</small>${j.local}</div>` +
        (j.lan.length ? j.lan.map((x) => `<div class="lan-link"><small>${esc(x.name)}（同一Wi-Fi）</small>${x.url}</div>`).join('') : '<div class="note">未检测到局域网地址：请确认电脑已连接 Wi-Fi 且防火墙放行。</div>') +
        '<div class="note">手机/微信打开：把上面链接发到微信即可点开（需与电脑同一网络）。</div>';
    } catch (e) { $('lanBody').innerHTML = '<div class="note">获取地址失败：' + esc(e.message) + '</div>'; }
  }
  async function doRefresh() {
    if (S.static) { toast('GitHub Pages 为静态版本，请在本机刷新数据后重新发布', 'err'); return; }
    const btn = $('btnRefresh'); const old = btn.textContent;
    btn.disabled = true; btn.textContent = '⟳ 更新中…';
    try {
      const r = await fetch('/api/refresh?game=' + S.game); const j = await r.json();
      if (j.ok) { S.cache[S.game] = null; await loadDraws(S.game); await loadMeta(); renderAll(); toast(j.message, 'ok'); }
      else toast('刷新失败：' + j.message, 'err');
    } catch (e) { toast('刷新失败：' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = old;
  }

  function bindAll() {
    document.querySelectorAll('#catSeg button').forEach((b) => b.onclick = () => setCat(b.dataset.cat));
    $('gameChips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-game]'); if (!chip) return;
      selectGame(chip.dataset.game);
    });
    document.querySelectorAll('#tabs .tab').forEach((t) => t.onclick = () => switchTab(t.dataset.tab));
    $('btnLan').onclick = openLan;
    $('lanClose').onclick = () => $('lanModal').classList.add('hidden');
    $('lanModal').addEventListener('click', (e) => { if (e.target === $('lanModal')) $('lanModal').classList.add('hidden'); });
    $('btnRefresh').onclick = doRefresh;
    $('btnGenerate').onclick = () => { doGenerate(Math.floor(Math.random() * 1e9)); };
    $('btnShuffle').onclick = () => { if (S.draws.length) doGenerate(Math.floor(Math.random() * 1e9)); };
    $('btnCopy').onclick = copyPicks;
    $('btnExportImg').onclick = exportPickImage;
    $('btnCheck').onclick = doCheck;
    $('btnBacktest').onclick = doBacktest;
    $('btnUseLastPick').onclick = () => {
      if (!S.lastTickets || !S.lastTickets[0]) { toast('请先在「智能出号」生成一组号码', 'err'); return; }
      const t = S.lastTickets[0];
      if (t.selections || t.option || !['single', 'direct', 'group3', 'group6'].includes(t.kind)) { toast('该官方投注方式不适合单期文本验票，请在出号结果中查看', 'err'); return; }
      $('chkNums').value = ticketToText(G[S.game], t);
      toast('已填入上次智选第 1 个方案', 'ok');
    };
  }

  async function boot() {
    bindAll();
    await loadMeta();
    await selectGame('dlt');
    switchTab('overview');
  }
  boot();
})();
