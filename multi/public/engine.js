// =============================================================
// 多游戏智能参考中心 · 统一统计/出号/回测引擎（纯函数，浏览器/Node 通用）
// 数字彩(pl3/pl5/f3d/qxc)：按“位”打分；区间彩(dlt/ssq/kl8)：按“号”打分。
// 出号仅为历史统计参考，不改变独立随机开奖的概率。
// =============================================================
(function (root) {
  const E = (root.MLE = root.MLE || {});
  const ML = root.ML;

  E.numsOf = (d) => d.nums || [];
  E.hashStr = function (s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  E.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // 窗口（不含 idx 当期）
  E.windowDraws = function (draws, idx, win) {
    const end = idx == null ? draws.length : idx;
    return draws.slice(Math.max(0, end - win), end);
  };

  // ---------- 数字彩：按位统计 ----------
  // 每位 digits 0..maxD；maxD=9 或七星彩末位 14
  E.digitStats = function (g, draws, idx, win) {
    const w = E.windowDraws(draws, idx, win);
    const n = g.digits;
    const maxes = g.positions.map((_, i) => (i === n - 1 && g.maxLast != null ? g.maxLast : 9));
    const counts = [], recency = [];
    for (let p = 0; p < n; p++) { counts.push(new Array(maxes[p] + 1).fill(0)); recency.push(new Array(maxes[p] + 1).fill(0)); }
    for (let i = 0; i < w.length; i++) {
      const nums = E.numsOf(w[i]);
      for (let p = 0; p < n; p++) { const dg = nums[p]; if (dg <= maxes[p]) { counts[p][dg]++; recency[p][dg] += i + 1; } }
    }
    const maxCount = [], maxRec = [];
    for (let p = 0; p < n; p++) {
      maxCount.push(Math.max(1, ...counts[p])); maxRec.push(Math.max(1, ...recency[p]));
    }
    return { n: w.length, counts, recency, maxCount, maxRec, maxes };
  };
  E.digitMiss = function (g, draws, p, d, idx) {
    const end = idx == null ? draws.length : idx;
    for (let j = end - 1; j >= 0; j--) if (draws[j].nums[p] === d) return end - 1 - j;
    return end;
  };
  E.digitTrend = function (g, draws, idx) {
    const end = idx == null ? draws.length : idx;
    const n = g.digits;
    const maxes = g.positions.map((_, i) => (i === n - 1 && g.maxLast != null ? g.maxLast : 9));
    const out = [];
    for (let p = 0; p < n; p++) out.push(new Array(maxes[p] + 1).fill(0));
    if (end - 1 < 0) return out;
    const last = E.numsOf(draws[end - 1]);
    const prev = end - 2 >= 0 ? E.numsOf(draws[end - 2]) : null;
    for (let p = 0; p < n; p++) {
      const ld = last[p], pd = prev ? prev[p] : null;
      for (let dg = 0; dg <= maxes[p]; dg++) {
        if (dg === ld) out[p][dg] += 3;
        if (Math.abs(dg - ld) === 1) out[p][dg] += 2;
        if (pd != null && Math.abs(dg - pd) === 1) out[p][dg] += 1;
      }
    }
    return out;
  };
  // 返回 feats[p] = [{d,fFreq,fRec,fCold,fTrend,miss,count}]
  E.digitFeatures = function (g, draws, idx, win) {
    const st = E.digitStats(g, draws, idx, win);
    const tr = E.digitTrend(g, draws, idx);
    const feats = [];
    for (let p = 0; p < g.digits; p++) {
      const row = [];
      const expected = st.n / (st.maxes[p] + 1);
      for (let d = 0; d <= st.maxes[p]; d++) {
        const fFreq = st.counts[p][d] / st.maxCount[p];
        const fRec = st.recency[p][d] / st.maxRec[p];
        const deficit = expected > 0 ? Math.max(0, expected - st.counts[p][d]) / expected : 0;
        const maxT = Math.max(1, ...tr[p]);
        row.push({ d, fFreq, fRec, fCold: deficit, fTrend: tr[p][d] / maxT, miss: E.digitMiss(g, draws, p, d, idx), count: st.counts[p][d] });
      }
      feats.push(row);
    }
    return feats;
  };

  // ---------- 区间彩：按号统计（按组） ----------
  E.setStats = function (g, draws, idx, win) {
    const w = E.windowDraws(draws, idx, win);
    const groups = g.groups;
    const stats = groups.map((grp) => {
      const counts = new Array(grp.max + 1).fill(0);
      const recency = new Array(grp.max + 1).fill(0);
      return { counts, recency, n: w.length };
    });
    for (let i = 0; i < w.length; i++) {
      const nums = E.numsOf(w[i]);
      let off = 0;
      for (let gi = 0; gi < groups.length; gi++) {
        const grp = groups[gi];
        for (let k = 0; k < grp.pick; k++) {
          const v = nums[off + k];
          if (v >= 1 && v <= grp.max) { stats[gi].counts[v]++; stats[gi].recency[v] += i + 1; }
        }
        off += grp.pick;
      }
    }
    stats.forEach((st) => { st.maxCount = Math.max(1, ...st.counts); st.maxRec = Math.max(1, ...st.recency); });
    return stats;
  };
  E.setMiss = function (g, draws, gi, v, idx) {
    const end = idx == null ? draws.length : idx;
    let off = 0; for (let i = 0; i < gi; i++) off += g.groups[i].pick;
    for (let j = end - 1; j >= 0; j--) {
      const nums = E.numsOf(draws[j]);
      for (let k = 0; k < g.groups[gi].pick; k++) if (nums[off + k] === v) return end - 1 - j;
    }
    return end;
  };
  E.setTrend = function (g, draws, idx) {
    const end = idx == null ? draws.length : idx;
    const groups = g.groups;
    const out = groups.map((grp) => new Array(grp.max + 1).fill(0));
    if (end - 1 < 0) return out;
    const lastSets = [], prevSets = [];
    const numsL = E.numsOf(draws[end - 1]);
    const numsP = end - 2 >= 0 ? E.numsOf(draws[end - 2]) : null;
    let off = 0;
    for (const grp of groups) {
      const sL = new Set(), sP = new Set();
      for (let k = 0; k < grp.pick; k++) { sL.add(numsL[off + k]); if (numsP) sP.add(numsP[off + k]); }
      lastSets.push(sL); prevSets.push(sP); off += grp.pick;
    }
    for (let gi = 0; gi < groups.length; gi++) {
      for (let v = 1; v <= groups[gi].max; v++) {
        if (lastSets[gi].has(v)) out[gi][v] += 3;
        for (const m of lastSets[gi]) { if (m !== v && Math.abs(m - v) === 1) { out[gi][v] += 2; break; } }
        for (const m of prevSets[gi]) { if (m !== v && Math.abs(m - v) === 1) { out[gi][v] += 1; break; } }
      }
    }
    return out;
  };
  E.setFeatures = function (g, draws, idx, win) {
    const stats = E.setStats(g, draws, idx, win);
    const tr = E.setTrend(g, draws, idx);
    return stats.map((st, gi) => {
      const grp = g.groups[gi];
      const expected = st.n * grp.pick / grp.max;
      const row = [];
      const maxT = Math.max(1, ...tr[gi]);
      for (let v = 1; v <= grp.max; v++) {
        row.push({
          n: v, fFreq: st.counts[v] / st.maxCount, fRec: st.recency[v] / st.maxRec,
          fCold: expected > 0 ? Math.max(0, expected - st.counts[v]) / expected : 0,
          fTrend: tr[gi][v] / maxT, miss: E.setMiss(g, draws, gi, v, idx), count: st.counts[v],
        });
      }
      return row;
    });
  };

  // ---------- 打分 ----------
  const WSET = {
    mix: { freq: 0.26, rec: 0.30, cold: 0.18, trend: 0.10, jit: 0.16 },
    hot: { freq: 0.42, rec: 0.42, cold: 0.0, trend: 0.06, jit: 0.10 },
    cold: { freq: 0.0, rec: 0.05, cold: 0.75, trend: 0.0, jit: 0.20 },
    balanced: { freq: 0.20, rec: 0.22, cold: 0.12, trend: 0.06, jit: 0.40 },
    trend: { freq: 0.08, rec: 0.25, cold: 0.0, trend: 0.60, jit: 0.07 },
    rand: { freq: 0, rec: 0, cold: 0, trend: 0, jit: 1 },
  };
  E.scoreRow = function (row, strategy, rnd, valKey) {
    const w = WSET[strategy] || WSET.mix;
    return row.map((f) => {
      const jit = w.jit > 0 ? (rnd() - 0.5) * 2 * w.jit : 0;
      const s = strategy === 'rand' ? rnd() : f.fFreq * w.freq + f.fRec * w.rec + f.fCold * w.cold + f.fTrend * w.trend + jit;
      return { v: f[valKey], s };
    });
  };
  E.sampleOne = function (arr, rnd) {
    const weights = arr.map((x) => Math.max(x.s, 0) + 0.001);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i].v; }
    return arr[arr.length - 1].v;
  };
  E.sampleDistinct = function (arr, k, rnd) {
    const used = new Set(); const out = []; let guard = 0;
    while (out.length < k && guard++ < Math.max(300, k * 20)) {
      const v = E.sampleOne(arr, rnd);
      if (!used.has(v)) { used.add(v); out.push(v); }
    }
    for (const c of arr) { if (out.length >= k) break; if (!used.has(c.v)) { out.push(c.v); used.add(c.v); } }
    return out;
  };

  // ---------- 生成辅助 ----------
  function sampleSorted(row, k, rnd) {
    return E.sampleDistinct(row, k, rnd).sort((a, b) => a - b);
  }
  const DIGIT_EXTENDED = new Set([
    'direct_compound', 'direct_combo_compound', 'group3_compound', 'group6_compound',
    'group3_dantuo', 'group6_dantuo', 'direct_combo_dantuo',
    'direct_span', 'group3_span', 'group6_span', 'direct_sum', 'group_sum',
  ]);
  const SPAN_COUNTS = { direct: new Array(10).fill(0), group3: new Array(10).fill(0), group6: new Array(10).fill(0) };
  const SUM_COUNTS = { direct: new Array(28).fill(0), group: new Array(28).fill(0) };
  (() => {
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let c = 0; c < 10; c++) {
      const sum = a + b + c, span = Math.max(a, b, c) - Math.min(a, b, c), type = new Set([a, b, c]).size;
      SPAN_COUNTS.direct[span]++;
      SUM_COUNTS.direct[sum]++;
      if (type === 2) SPAN_COUNTS.group3[span]++;
      if (type === 3) SPAN_COUNTS.group6[span]++;
    }
    for (let a = 0; a < 10; a++) for (let b = a; b < 10; b++) for (let c = b; c < 10; c++) {
      if (a === b && b === c) continue;
      SUM_COUNTS.group[a + b + c]++;
    }
  })();
  function digitAggregate(feats, strategy) {
    const out = [];
    for (let d = 0; d < 10; d++) {
      let count = 0, rec = 0, trend = 0, cold = 0;
      for (const row of feats) {
        const f = row.find((x) => x.d === d);
        if (f) { count += f.count; rec += f.miss; trend += f.fTrend; cold += f.fCold; }
      }
      const s = strategy === 'cold' ? cold * 20 + rec : count + rec / 12 + trend * 2;
      out.push({ v: d, s: Math.max(.001, s) });
    }
    return out;
  }
  function spanScores(draws, idx, win, strategy, rnd) {
    const rows = E.windowDraws(draws, idx, win), counts = new Array(10).fill(0);
    for (const d of rows) counts[Math.max(...d.nums) - Math.min(...d.nums)]++;
    const max = Math.max(1, ...counts);
    return counts.map((c, span) => ({ v: span, s: Math.max(.001, strategy === 'rand' ? rnd() : strategy === 'cold' ? 1 - c / max : c / max) }));
  }
  function sumScores(draws, idx, win, strategy, rnd, group) {
    const rows = E.windowDraws(draws, idx, win), counts = new Array(28).fill(0);
    for (const d of rows) counts[d.nums.reduce((a, b) => a + b, 0)]++;
    const max = Math.max(1, ...counts);
    return counts.map((c, sum) => ({ v: sum, s: Math.max(.001, strategy === 'rand' ? rnd() : strategy === 'cold' ? 1 - c / max : c / max) })).filter((x) => !group || (x.v > 0 && x.v < 27));
  }
  function permutation(n, k) { let r = 1; for (let i = 0; i < k; i++) r *= Math.max(0, n - i); return r; }
  E.generateDigitExtended = function (opts, feats, scored, rnd) {
    const { g, draws, idx = draws.length, win = 100, strategy = 'mix', count = 3 } = opts;
    const mode = opts.mode;
    const agg = digitAggregate(feats, strategy);
    const tickets = [], seen = new Set();
    let guard = 0;
    const push = (t) => {
      if (!t.combos || t.combos > 10000) return;
      const key = JSON.stringify([t.kind, t.nums, t.selections, t.dan, t.tuo, t.spans, t.sums]);
      if (seen.has(key)) return;
      seen.add(key); tickets.push(Object.assign({ cost: t.combos * 2 }, t));
    };
    while (tickets.length < count && guard++ < Math.max(50, count * 40)) {
      if (mode === 'direct_compound') {
        const per = Math.max(2, Math.min(3, Number(opts.digitsPerPos) || 2));
        const selections = scored.map((row) => sampleSorted(row, per, rnd));
        const combos = selections.reduce((n, row) => n * row.length, 1);
        push({ kind: mode, selections, nums: selections.flat(), combos });
      } else if (mode === 'direct_combo_compound') {
        const size = Math.max(3, Math.min(6, Number(opts.poolSize) || 4));
        const nums = sampleSorted(agg, size, rnd);
        push({ kind: mode, nums, combos: permutation(nums.length, 3) });
      } else if (mode === 'group3_compound') {
        const size = Math.max(2, Math.min(6, Number(opts.poolSize) || 4));
        const nums = sampleSorted(agg, size, rnd);
        push({ kind: mode, nums, combos: nums.length * (nums.length - 1) });
      } else if (mode === 'group6_compound') {
        const size = Math.max(4, Math.min(8, Number(opts.poolSize) || 4));
        const nums = sampleSorted(agg, size, rnd);
        push({ kind: mode, nums, combos: ML.comb(nums.length, 3) });
      } else if (mode === 'group3_dantuo') {
        const tuoCount = Math.max(2, Math.min(6, Number(opts.tuoCount) || 3));
        const dan = sampleSorted(agg, 1, rnd), used = new Set(dan);
        const tuo = sampleSorted(agg.filter((x) => !used.has(x.v)), tuoCount, rnd);
        push({ kind: mode, dan, tuo, nums: dan.concat(tuo), combos: 2 * tuo.length });
      } else if (mode === 'group6_dantuo' || mode === 'direct_combo_dantuo') {
        const danCount = mode === 'group6_dantuo' ? Math.max(1, Math.min(2, Number(opts.danCount) || 1)) : Math.max(1, Math.min(2, Number(opts.danCount) || 1));
        const minTuo = Math.max(2, 4 - danCount);
        const tuoCount = Math.max(minTuo, Number(opts.tuoCount) || minTuo);
        const dan = sampleSorted(agg, danCount, rnd), used = new Set(dan);
        const tuo = sampleSorted(agg.filter((x) => !used.has(x.v)), tuoCount, rnd);
        const combos = mode === 'group6_dantuo'
          ? ML.comb(tuo.length, 3 - dan.length)
          : permutation(dan.length + tuo.length, 3) - permutation(tuo.length, 3);
        push({ kind: mode, dan, tuo, nums: dan.concat(tuo), combos });
      } else if (mode.endsWith('_span')) {
        const spanCount = Math.max(1, Math.min(3, Number(opts.spanCount) || 1));
        const spans = E.sampleDistinct(spanScores(draws, idx, win, strategy, rnd), spanCount, rnd).sort((a, b) => a - b);
        const key = mode.startsWith('direct') ? 'direct' : mode.startsWith('group3') ? 'group3' : 'group6';
        const combos = spans.reduce((n, span) => n + SPAN_COUNTS[key][span], 0);
        push({ kind: mode, spans, nums: spans, combos });
      } else if (mode.endsWith('_sum')) {
        const sumCount = Math.max(1, Math.min(4, Number(opts.sumCount) || 1));
        const group = mode === 'group_sum';
        const sums = E.sampleDistinct(sumScores(draws, idx, win, strategy, rnd, group), sumCount, rnd).sort((a, b) => a - b);
        const combos = sums.reduce((n, sum) => n + SUM_COUNTS[group ? 'group' : 'direct'][sum], 0);
        push({ kind: mode, sums, nums: sums, combos });
      } else break;
    }
    return { strategy, mode, win, tickets, kind: 'digit', feats };
  };

  function makeSelectionGroup(row, pick, size, danCount, rnd) {
    const total = Math.max(pick, Math.min(80, size));
    if (danCount > 0) {
      const dan = sampleSorted(row, Math.min(danCount, pick - 1), rnd);
      const used = new Set(dan);
      const rest = row.filter((x) => !used.has(x.v));
      const tuoSize = Math.max(pick - dan.length + 1, total - dan.length);
      const tuo = sampleSorted(rest, Math.min(tuoSize, rest.length), rnd);
      return { kind: 'dantuo', dan, tuo, combos: ML.comb(tuo.length, pick - dan.length) };
    }
    const nums = sampleSorted(row, total, rnd);
    return { kind: 'plain', nums, combos: ML.comb(nums.length, pick) };
  }
  function makeSetTicket(scored, groups, sizes, dans, kind, extra) {
    const picks = extra.picks || groups.map((grp) => grp.pick);
    const selections = groups.map((grp, i) => makeSelectionGroup(scored[i], picks[i], sizes[i], dans[i] || 0, extra.rnd));
    const combos = selections.reduce((n, x) => n * (x.combos || 0), 1);
    const nums = selections.flatMap((x) => x.kind === 'dantuo' ? x.dan.concat(x.tuo) : x.nums);
    const first = selections[0];
    return Object.assign({
      kind, nums, selections, combos, cost: combos * 2,
      dan: first.kind === 'dantuo' ? first.dan : undefined,
      tuo: first.kind === 'dantuo' ? first.tuo : undefined,
    }, extra.rest || {});
  }
  function f3dSumScores(draws, idx, win, strategy, rnd) {
    const rows = E.windowDraws(draws, idx, win);
    const counts = new Array(28).fill(0);
    for (const d of rows) counts[d.nums.reduce((a, b) => a + b, 0)]++;
    const max = Math.max(1, ...counts);
    return counts.map((count, sum) => {
      const freq = count / max;
      const s = strategy === 'rand' ? rnd() : freq + (strategy === 'cold' ? Math.max(0, 1 - freq) : 0) + (rnd() - 0.5) * .2;
      return { v: sum, s: Math.max(0.001, s) };
    });
  }
  E.generateQxcComplex = function (opts, scored, rnd) {
    const { g, strategy = 'mix', win = 100, count = 3 } = opts;
    const mode = opts.mode || 'direct';
    const per = Math.max(2, Math.min(3, Number(opts.digitsPerPos) || 2));
    const tickets = [], seen = new Set();
    let guard = 0;
    while (tickets.length < count && guard++ < Math.max(40, count * 30)) {
      const selections = scored.map((row, p) => {
        const multi = mode === 'full_compound' || (mode === 'front_compound' && p < 6) || (mode === 'last_compound' && p === 6);
        return sampleSorted(row, multi ? per : 1, rnd);
      });
      const combos = selections.reduce((n, row) => n * row.length, 1);
      const key = selections.map((row) => row.join(',')).join('/');
      if (seen.has(key)) continue;
      seen.add(key);
      tickets.push({ kind: mode, selections, nums: selections.flat(), combos, cost: combos * 2 });
    }
    return { strategy, mode, win, tickets, kind: 'digit', feats: opts.feats };
  };

  E.generateF3DSpecial = function (opts, feats, scored, rnd) {
    const { g, draws, idx = draws.length, win = 100, strategy = 'mix', count = 3 } = opts;
    const mode = opts.mode;
    const tickets = [], seen = new Set();
    let guard = 0;
    const add = (t) => {
      const k = JSON.stringify([t.kind, t.nums, t.pos, t.positions, t.option]);
      if (seen.has(k)) return false;
      seen.add(k); tickets.push(Object.assign({ combos: 1, cost: 2 }, t)); return true;
    };
    while (tickets.length < count && guard++ < Math.max(40, count * 30)) {
      if (mode === '1d') {
        const p = Math.min(2, Math.max(0, Number(opts.pos) || 0));
        add({ kind: mode, nums: [E.sampleOne(scored[p], rnd)], pos: p, posName: g.positions[p] });
      } else if (mode === 'guess1d') {
        const agg = [];
        for (let d = 0; d < 10; d++) {
          let s = 0;
          for (let p = 0; p < 3; p++) { const f = feats[p].find((x) => x.d === d); if (f) s += f.fFreq + f.fRec * .2 + (strategy === 'cold' ? f.fCold : 0); }
          agg.push({ v: d, s: Math.max(.001, strategy === 'rand' ? rnd() : s) });
        }
        add({ kind: mode, nums: [E.sampleOne(agg, rnd)] });
      } else if (mode === '2d') {
        const pos = (opts.positions || [0, 1]).map(Number).slice(0, 2);
        add({ kind: mode, nums: pos.map((p) => E.sampleOne(scored[p], rnd)), positions: pos, posName: pos.map((p) => g.positions[p]).join('+') });
      } else if (mode === 'guess2d_same') {
        const agg = [];
        for (let d = 0; d < 10; d++) {
          let c = 0; for (let p = 0; p < 3; p++) c += feats[p].find((x) => x.d === d).count;
          agg.push({ v: d, s: Math.max(.001, strategy === 'rand' ? rnd() : c) });
        }
        add({ kind: mode, nums: [E.sampleOne(agg, rnd)] });
      } else if (mode === 'guess2d_diff') {
        const agg = [];
        for (let d = 0; d < 10; d++) {
          let c = 0; for (let p = 0; p < 3; p++) c += feats[p].find((x) => x.d === d).count;
          agg.push({ v: d, s: Math.max(.001, strategy === 'rand' ? rnd() : c) });
        }
        add({ kind: mode, nums: sampleSorted(agg, 2, rnd) });
      } else if (mode === 'tx') {
        add({ kind: mode, nums: scored.map((row) => E.sampleOne(row, rnd)) });
      } else if (mode === 'sum') {
        add({ kind: mode, nums: [E.sampleOne(f3dSumScores(draws, idx, win, strategy, rnd), rnd)] });
      } else if (mode === 'package3') {
        const agg = [];
        for (let d = 0; d < 10; d++) {
          let c = 0, rec = 0; for (let p = 0; p < 3; p++) { const f = feats[p].find((x) => x.d === d); c += f.count; rec += f.miss; }
          agg.push({ v: d, s: Math.max(.001, strategy === 'rand' ? rnd() : c + rec / 20) });
        }
        const a = E.sampleOne(agg, rnd); let b = E.sampleOne(agg, rnd); let n = 0;
        while (b === a && n++ < 20) b = E.sampleOne(agg, rnd);
        if (a !== b) add({ kind: mode, nums: [a, a, b] });
      } else if (mode === 'package6') {
        const agg = [];
        for (let d = 0; d < 10; d++) {
          let c = 0; for (let p = 0; p < 3; p++) c += feats[p].find((x) => x.d === d).count;
          agg.push({ v: d, s: Math.max(.001, strategy === 'rand' ? rnd() : c) });
        }
        add({ kind: mode, nums: sampleSorted(agg, 3, rnd) });
      } else if (mode === 'bigsmall') {
        const sums = E.windowDraws(draws, idx, win).map((d) => d.nums.reduce((a, b) => a + b, 0));
        const big = sums.filter((s) => s >= 19).length, small = sums.filter((s) => s <= 8).length;
        const option = strategy === 'rand' ? (rnd() < .5 ? 'big' : 'small') : E.sampleOne([{ v: 'big', s: big || .001 }, { v: 'small', s: small || .001 }], rnd);
        add({ kind: mode, nums: [], option, label: option === 'big' ? '大' : '小' });
      } else if (mode === 'triple') {
        const agg = [];
        for (let d = 0; d < 10; d++) {
          const c = E.windowDraws(draws, idx, win).filter((x) => x.nums[0] === d && x.nums[1] === d && x.nums[2] === d).length;
          agg.push({ v: d, s: Math.max(.001, strategy === 'rand' ? rnd() : c) });
        }
        add({ kind: mode, nums: [E.sampleOne(agg, rnd)] });
      } else if (mode === 'tractor') {
        add({ kind: mode, nums: ML.TRACTOR_NUMS[Math.floor(rnd() * ML.TRACTOR_NUMS.length)].split('').map(Number) });
      } else if (mode === 'oddeven') {
        const sums = E.windowDraws(draws, idx, win);
        const odd = sums.filter((x) => x.nums.every((d) => d % 2 === 1)).length;
        const even = sums.filter((x) => x.nums.every((d) => d % 2 === 0)).length;
        const option = strategy === 'rand' ? (rnd() < .5 ? 'odd' : 'even') : E.sampleOne([{ v: 'odd', s: odd || .001 }, { v: 'even', s: even || .001 }], rnd);
        add({ kind: mode, nums: [], option, label: option === 'odd' ? '奇' : '偶' });
      } else break;
    }
    return { strategy, mode, win, tickets, kind: 'digit', feats };
  };

  // ---------- 生成 ----------
  // opts: {draws, idx, win, strategy, count, mode, salt, g(key config)}
  // digit mode: direct/group3/group6 (group 仅对 pl3/f3d 有效)
  // set mode: 官方单式/复式/胆拖；opts.mainSize/subSize/mainDan/extra/danCount/digitsPerPos
  E.generate = function (opts) {
    const { g, draws, idx = draws.length, win = 100, strategy = 'mix', count = 3, salt = 0 } = opts;
    const rnd = E.rng(E.hashStr(g.key + ':' + idx + ':' + strategy + ':' + (opts.mode || '') + ':' + salt));
    const tickets = [];
    if (g.kind === 'digit') {
      const mode = opts.mode || 'direct';
      const feats = E.digitFeatures(g, draws, idx, win);
      const scored = feats.map((row) => E.scoreRow(row, strategy, rnd, 'd'));
      if (DIGIT_EXTENDED.has(mode) && (g.key === 'pl3' || g.key === 'pl5' || g.key === 'f3d')) {
        return E.generateDigitExtended({ ...opts, mode, strategy, win, count, idx }, feats, scored, rnd);
      }
      if (g.key === 'qxc' && mode !== 'direct') {
        return E.generateQxcComplex({ ...opts, mode, strategy, win, count, feats }, scored, rnd);
      }
      if (g.key === 'f3d' && !['direct', 'group3', 'group6'].includes(mode)) {
        return E.generateF3DSpecial({ ...opts, mode, strategy, win, count, idx }, feats, scored, rnd);
      }
      const seen = new Set();
      let guard = 0;
      while (tickets.length < count && guard++ < count * 40) {
        let arr;
        if (mode === 'direct') {
          arr = scored.map((row) => E.sampleOne(row, rnd));
        } else {
          // 组选3/组选6（仅 3 位 0-9）：聚合各出现频率
          const agg = [];
          for (let d = 0; d < 10; d++) {
            let cnt = 0, rec = 0, tr = 0;
            for (let p = 0; p < g.digits; p++) {
              const f = feats[p].find((x) => x.d === d);
              if (f) { cnt += f.count; rec += f.miss; tr += f.fTrend; }
            }
            agg.push({ v: d, s: cnt + rec / 10 + tr });
          }
          const w = WSET[strategy] || WSET.mix;
          if (mode === 'group3') {
            const x = E.sampleOne(agg, rnd); let y = E.sampleOne(agg, rnd); let gi = 0;
            while (y === x && gi++ < 20) y = E.sampleOne(agg, rnd);
            arr = [x, x, y];
          } else {
            arr = E.sampleDistinct(agg.map((x) => ({ v: x.v, s: x.s })), 3, rnd).sort((a, b) => a - b);
          }
        }
        const key = arr.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        tickets.push({ kind: mode, nums: arr, combos: 1, cost: 2 });
      }
      return { strategy, mode, win, tickets, kind: 'digit', feats };
    }
    // 区间彩
    const groups = g.groups;
    const feats = E.setFeatures(g, draws, idx, win);
    const scored = feats.map((row) => E.scoreRow(row, strategy, rnd, 'n'));
    const isKl8 = g.key === 'kl8';
    const mode = opts.mode || 'single';
    const seen = new Set();
    let guard = 0;
    while (tickets.length < count && guard++ < Math.max(40, count * 40)) {
      let sizes, dans;
      if (isKl8) {
        const w = Math.max(1, Math.min(10, Number(opts.w) || 10));
        const extra = Math.max(0, Math.min(3, Number(opts.extra) || 2));
        if (mode === 'compound') {
          sizes = [Math.min(80, Math.max(w + 1, w + extra))];
          dans = [0];
        } else if (mode === 'dantuo' && w > 1) {
          const danCount = Math.max(1, Math.min(w - 1, Number(opts.danCount) || 1));
          const tuoCount = Math.max(w - danCount + 1, Number(opts.tuoCount) || Math.max(w + 1, w + extra) - danCount);
          sizes = [danCount + tuoCount];
          dans = [danCount];
        } else {
          sizes = [w];
          dans = [0];
        }
      } else if (g.key === 'dlt') {
        const mainSize = Math.max(g.groups[0].pick, Number(opts.mainSize) || 7);
        const subSize = Math.max(g.groups[1].pick, Number(opts.subSize) || 3);
        const mainDan = Math.max(1, Math.min(g.groups[0].pick - 1, Number(opts.mainDan) || 1));
        const mainTuo = Math.max(g.groups[0].pick - mainDan + 1, Number(opts.mainTuo) || (g.groups[0].pick - mainDan + 1));
        const subTuo = Math.max(2, Number(opts.subTuo) || 2);
        if (mode === 'front_compound') { sizes = [mainSize, 2]; dans = [0, 0]; }
        else if (mode === 'back_compound') { sizes = [5, subSize]; dans = [0, 0]; }
        else if (mode === 'full_compound') { sizes = [mainSize, subSize]; dans = [0, 0]; }
        else if (mode === 'front_dantuo') { sizes = [mainDan + mainTuo, 2]; dans = [mainDan, 0]; }
        else if (mode === 'back_dantuo') { sizes = [5, 1 + subTuo]; dans = [0, 1]; }
        else if (mode === 'full_dantuo') { sizes = [mainDan + mainTuo, 1 + subTuo]; dans = [mainDan, 1]; }
        else { sizes = [5, 2]; dans = [0, 0]; }
      } else {
        const mainSize = Math.max(g.groups[0].pick, Number(opts.mainSize) || 7);
        const subSize = Math.max(g.groups[1].pick, Number(opts.subSize) || 3);
        const mainDan = Math.max(1, Math.min(g.groups[0].pick - 1, Number(opts.mainDan) || 1));
        const mainTuo = Math.max(g.groups[0].pick - mainDan + 1, Number(opts.mainTuo) || (g.groups[0].pick - mainDan + 1));
        if (mode === 'red_compound') { sizes = [mainSize, 1]; dans = [0, 0]; }
        else if (mode === 'blue_compound') { sizes = [6, subSize]; dans = [0, 0]; }
        else if (mode === 'full_compound') { sizes = [mainSize, subSize]; dans = [0, 0]; }
        else if (mode === 'red_dantuo') { sizes = [mainDan + mainTuo, 1]; dans = [mainDan, 0]; }
        else if (mode === 'full_dantuo') { sizes = [mainDan + mainTuo, Math.max(2, subSize)]; dans = [mainDan, 0]; }
        else { sizes = [6, 1]; dans = [0, 0]; }
      }
      const ticket = makeSetTicket(scored, groups, sizes, dans, mode, { rnd, picks: isKl8 ? [Math.max(1, Math.min(10, Number(opts.w) || 10))] : undefined, w: isKl8 ? (Math.max(1, Math.min(10, Number(opts.w) || 10))) : undefined });
      if (!ticket.combos || ticket.combos > 10000) continue;
      const key = ticket.selections.map((x) => x.kind === 'dantuo' ? 'D' + x.dan.join(',') + '|' + x.tuo.join(',') : x.nums.join(',')).join('/');
      if (seen.has(key)) continue;
      seen.add(key);
      tickets.push(ticket);
    }
    return { strategy, mode, win, tickets, kind: 'set', feats };
  };

  // ---------- 回测（只用当期之前数据） ----------
  // digit: 逐位命中；set: 主组命中（kl8=选 w 命中数；dlt/ssq=前区/红球命中 + 是否中任意奖）
  E.backtest = function (opts) {
    const { g, draws, strategy = 'mix', len = 200, win = 100, w = 10 } = opts;
    const mode = opts.mode || (g.kind === 'digit' ? 'direct' : 'single');
    const total = draws.length;
    const start = Math.max(win + 1, total - len);
    const rndTick = E.rng(0xABCDEF ^ g.key.length);
    const rows = [];
    const genOne = (i, salt) => E.generate({ g, draws, idx: i, win, strategy, count: 1, salt, mode, w }).tickets[0];
    for (let i = start; i < total; i++) {
      const t = genOne(i, rndTick());
      if (!t) continue;
      const draw = E.numsOf(draws[i]);
      if (g.kind === 'digit') {
        let same = 0;
        for (let p = 0; p < g.digits; p++) if (t.nums[p] === draw[p]) same++;
        rows.push({ same, full: same === g.digits });
      } else if (g.key === 'kl8') {
        const set = new Set(draw);
        let h = 0; for (const n of t.nums) if (set.has(n)) h++;
        rows.push({ same: h, full: h >= w });
      } else {
        const groups = g.groups;
        let off = 0; const hitArr = [];
        for (const grp of groups) {
          const mine = new Set(t.nums.slice(off, off + grp.pick));
          let h = 0;
          for (let k = 0; k < grp.pick; k++) if (mine.has(draw[off + k])) h++;
          hitArr.push(h); off += grp.pick;
        }
        const ver = ML.checkSet(g.key, t.nums, draw);
        rows.push({ same: hitArr[0], full: ver.win, hitArr });
      }
    }
    return rows;
  };
  E.summarize = function (g, rows) {
    const n = rows.length || 1;
    const mean = rows.reduce((a, r) => a + r.same, 0) / n;
    const full = rows.filter((r) => r.full).length;
    const dist = {};
    for (const r of rows) dist[r.same] = (dist[r.same] || 0) + 1;
    const maxLen = g.kind === 'digit' ? g.digits : (g.key === 'kl8' ? 20 : g.groups[0].pick);
    return { n, mean, fullRate: full / n, full, dist, maxLen, rows };
  };
  // 理论参照（主组单号命中数期望）
  E.theoryMean = function (g, w) {
    if (g.kind === 'digit') return g.digits * 0.1;
    if (g.key === 'kl8') return (w || 10) * 20 / 80;
    const grp = g.groups[0];
    return grp.pick * grp.pick / grp.max;
  };
})(typeof window !== 'undefined' ? window : globalThis);
