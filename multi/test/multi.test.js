import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_META } from '../lib/fetchDraws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, '..', 'public');
global.window = global;
await import(path.join(pub, 'prizes.js'));
await import(path.join(pub, 'engine.js'));
const ML = global.ML, E = global.MLE;

test('游戏注册表完整（体彩4 + 福彩3）', () => {
  assert.equal(ML.byCat.tc.length, 4);
  assert.equal(ML.byCat.fc.length, 3);
  assert.deepEqual(ML.byCat.tc, ['dlt', 'qxc', 'pl3', 'pl5']);
  assert.deepEqual(ML.byCat.fc, ['ssq', 'kl8', 'f3d']);
  assert.ok(GAME_META.dlt.sport === '85' && GAME_META.qxc.sport === '04' && GAME_META.ssq.cwl === 'ssq');
});

test('大乐透现行九奖级判定（只兑最高）', () => {
  const draw = [9, 11, 18, 26, 33, 9, 11];
  const c = (nums) => ML.verify('dlt', { nums }, draw).tier;
  assert.equal(c([9, 11, 18, 26, 33, 9, 11]), 1);   // 5+2
  assert.equal(c([9, 11, 18, 26, 33, 9, 1]), 2);    // 5+1
  assert.equal(c([9, 11, 18, 26, 33, 1, 2]), 3);    // 5+0
  assert.equal(c([9, 11, 18, 26, 1, 9, 11]), 4);    // 4+2
  assert.equal(c([9, 11, 18, 26, 1, 9, 2]), 5);     // 4+1
  assert.equal(c([9, 11, 18, 1, 2, 9, 11]), 6);     // 3+2
  assert.equal(c([9, 11, 18, 26, 1, 1, 2]), 7);     // 4+0
  assert.equal(c([9, 11, 18, 1, 2, 9, 2]), 8);      // 3+1
  assert.equal(c([9, 11, 1, 2, 3, 9, 11]), 8);      // 2+2
  assert.equal(c([9, 11, 18, 1, 2, 1, 2]), 9);      // 3+0
  assert.equal(c([9, 11, 1, 2, 3, 9, 1]), 9);       // 2+1
  assert.equal(c([1, 2, 3, 4, 5, 9, 11]), 9);       // 0+2
  assert.equal(c([1, 2, 3, 4, 5, 9, 1]), 0);        // 未中
  assert.equal(ML.DLT_PRIZES[2].prize, 10000);
});

test('双色球六奖级判定', () => {
  const draw = [3, 4, 10, 13, 16, 25, 9];
  const c = (nums) => ML.verify('ssq', { nums }, draw).tier;
  assert.equal(c([3, 4, 10, 13, 16, 25, 9]), 1);
  assert.equal(c([3, 4, 10, 13, 16, 25, 1]), 2);
  assert.equal(c([3, 4, 10, 13, 16, 1, 9]), 3);    // 5+1
  assert.equal(c([3, 4, 10, 13, 16, 1, 2]), 4);    // 5+0
  assert.equal(c([3, 4, 10, 13, 1, 2, 9]), 4);     // 4+1
  assert.equal(c([3, 4, 10, 13, 1, 2, 5]), 5);     // 4+0
  assert.equal(c([3, 4, 10, 1, 2, 5, 9]), 5);      // 3+1
  assert.equal(c([3, 4, 1, 2, 5, 6, 9]), 6);       // 2+1
  assert.equal(c([3, 1, 2, 5, 6, 7, 9]), 6);       // 1+1
  assert.equal(c([1, 2, 5, 6, 7, 8, 9]), 6);       // 0+1
  assert.equal(c([1, 2, 5, 6, 7, 8, 1]), 0);       // 未中
});

test('七星彩六奖级判定（按位，末位0-14）', () => {
  const draw = [1, 7, 5, 5, 8, 8, 6];
  const c = (nums) => ML.verify('qxc', { nums }, draw).tier;
  assert.equal(c([1, 7, 5, 5, 8, 8, 6]), 1);
  assert.equal(c([1, 7, 5, 5, 8, 8, 3]), 2);
  assert.equal(c([1, 7, 5, 5, 8, 9, 6]), 3);   // 前5+末
  assert.equal(c([1, 7, 5, 5, 8, 9, 1]), 4);   // 前5(5位相同)
  assert.equal(c([1, 7, 5, 5, 9, 9, 6]), 4);   // 前4+末
  assert.equal(c([1, 7, 5, 5, 9, 9, 1]), 5);   // 前4
  assert.equal(c([1, 7, 5, 9, 9, 9, 6]), 5);   // 前3+末
  assert.equal(c([1, 7, 5, 9, 9, 9, 1]), 6);   // 任意3
  assert.equal(c([1, 7, 9, 9, 9, 9, 6]), 6);   // 前1+末
  assert.equal(c([9, 9, 9, 9, 9, 9, 6]), 6);   // 仅末位
  assert.equal(c([2, 3, 4, 0, 1, 2, 3]), 0);   // 未中
  // 末位 0-14 合法：开奖末位=14 时仅末位命中
  assert.equal(ML.verify('qxc', { nums: [9, 9, 9, 9, 9, 9, 14] }, [1, 7, 5, 5, 8, 8, 14]).tier, 6);
  // 概率合计（任意奖）在合理区间
  const sum = ML.qxcProb().reduce((a, r) => a + r.p, 0);
  assert.ok(sum > 0.05 && sum < 0.15);
});

test('排列3 / 福彩3D / 排列5 判定与奖金', () => {
  const draw = [3, 6, 1];
  assert.equal(ML.verify('pl3', { nums: [3, 6, 1], mode: 'direct' }, draw).prize, 1040);
  assert.equal(ML.verify('pl3', { nums: [1, 3, 6], mode: 'group6' }, draw).prize, 173);
  assert.equal(ML.verify('pl3', { nums: [3, 3, 6], mode: 'group3' }, draw).win, false);
  assert.equal(ML.verify('f3d', { nums: [1, 3, 6], mode: 'group6' }, draw).prize, 173);
  const p5 = [3, 6, 1, 7, 3];
  assert.equal(ML.verify('pl5', { nums: [3, 6, 1, 7, 3] }, p5).prize, 100000);
  assert.equal(ML.verify('pl5', { nums: [3, 6, 1, 7, 0] }, p5).win, false);
});

test('福彩3D官方扩展投注方式判定', () => {
  const draw = [3, 6, 1];
  assert.equal(ML.verify('f3d', { mode: '1d', nums: [3], pos: 0 }, draw).prize, 10);
  assert.equal(ML.verify('f3d', { mode: 'guess1d', nums: [6] }, draw).prize, 2);
  assert.equal(ML.verify('f3d', { mode: 'guess1d', nums: [3], }, [3, 3, 1]).prize, 12);
  assert.equal(ML.verify('f3d', { mode: 'guess1d', nums: [3], }, [3, 3, 3]).prize, 230);
  assert.equal(ML.verify('f3d', { mode: '2d', nums: [3, 6], positions: [0, 1] }, draw).prize, 104);
  assert.equal(ML.verify('f3d', { mode: 'guess2d_same', nums: [3] }, [3, 3, 1]).prize, 37);
  assert.equal(ML.verify('f3d', { mode: 'guess2d_diff', nums: [3, 1] }, draw).prize, 19);
  assert.equal(ML.verify('f3d', { mode: 'tx', nums: [3, 6, 9] }, draw).prize, 21);
  assert.equal(ML.verify('f3d', { mode: 'tx', nums: [3, 6, 1] }, draw).prize, 470);
  assert.equal(ML.verify('f3d', { mode: 'sum', nums: [10] }, draw).prize, 16);
  assert.equal(ML.verify('f3d', { mode: 'package3', nums: [3, 3, 6] }, [3, 3, 6]).prize, 693);
  assert.equal(ML.verify('f3d', { mode: 'package3', nums: [3, 3, 6] }, [3, 6, 3]).prize, 173);
  assert.equal(ML.verify('f3d', { mode: 'bigsmall', nums: [], option: 'small' }, [1, 2, 3]).prize, 6);
  assert.equal(ML.verify('f3d', { mode: 'triple', nums: [8] }, [8, 8, 8]).prize, 104);
  assert.equal(ML.verify('f3d', { mode: 'tractor', nums: [1, 2, 3] }, [1, 2, 3]).prize, 65);
  assert.equal(ML.verify('f3d', { mode: 'oddeven', nums: [], option: 'odd' }, [1, 3, 5]).prize, 8);
});

test('快乐8 单式奖金判定（现行表）', () => {
  const draw = [1, 4, 6, 11, 12, 16, 17, 20, 22, 32, 41, 47, 51, 52, 62, 63, 64, 68, 72, 75];
  assert.equal(ML.verify('kl8', { nums: [1, 4, 6, 11, 12], w: 5 }, draw).prize, 1000);   // 选5中5
  assert.equal(ML.verify('kl8', { nums: [1, 4, 6, 11, 70], w: 5 }, draw).prize, 20);      // 选5中4
  assert.equal(ML.verify('kl8', { nums: [1, 4, 6, 70, 71], w: 5 }, draw).prize, 3);       // 选5中3
  assert.equal(ML.verify('kl8', { nums: [1, 4, 6, 11, 12, 16, 17, 20], w: 8 }, draw).prize, 50000); // 选8中8
  assert.equal(ML.verify('kl8', { nums: [1, 4, 6, 11, 12, 16, 17, 70], w: 8 }, draw).prize, 800); // 选8中7
  assert.equal(ML.verify('kl8', { nums: [70, 71, 72, 73, 74, 75, 76], w: 7 }, draw).win, false);
});

test('官方投注方式均可生成合法方案', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'all.json'), 'utf8'));
  const cases = [
    ['dlt', 'single', {}], ['dlt', 'front_compound', { mainSize: 7 }], ['dlt', 'back_compound', { subSize: 3 }],
    ['dlt', 'full_compound', { mainSize: 7, subSize: 3 }], ['dlt', 'front_dantuo', { mainSize: 7, mainDan: 2 }],
    ['dlt', 'back_dantuo', { subSize: 3 }], ['dlt', 'full_dantuo', { mainSize: 7, mainDan: 1, subSize: 3 }],
    ['qxc', 'front_compound', { digitsPerPos: 2 }], ['qxc', 'last_compound', { digitsPerPos: 2 }], ['qxc', 'full_compound', { digitsPerPos: 2 }],
    ['ssq', 'red_compound', { mainSize: 7 }], ['ssq', 'blue_compound', { subSize: 2 }],
    ['ssq', 'full_compound', { mainSize: 7, subSize: 2 }], ['ssq', 'red_dantuo', { mainSize: 7, mainDan: 1 }],
    ['ssq', 'full_dantuo', { mainSize: 7, mainDan: 1, subSize: 2 }],
    ['kl8', 'single', { w: 5 }], ['kl8', 'compound', { w: 5, extra: 2 }], ['kl8', 'dantuo', { w: 5, extra: 2, danCount: 2 }],
    ...ML.PLAY_OPTIONS.pl3.map((x) => ['pl3', x.key, { digitsPerPos: 2, poolSize: 4, tuoCount: 3, danCount: 1, tuoCount: 4, spanCount: 1, sumCount: 1 }]),
    ...ML.PLAY_OPTIONS.pl5.map((x) => ['pl5', x.key, { digitsPerPos: 2 }]),
    ...ML.PLAY_OPTIONS.f3d.map((x) => ['f3d', x.key, { digitsPerPos: 2, poolSize: 4, tuoCount: 3, danCount: 1, tuoCount: 4 }]),
  ];
  for (const [key, mode, extra] of cases) {
    const g = ML.GAMES[key];
    const draws = data[key].slice(-120);
    const out = E.generate({ g, draws, win: 100, strategy: 'mix', count: 2, mode, ...extra });
    assert.ok(out.tickets.length > 0, `${key}/${mode} 未生成方案`);
    for (const t of out.tickets) {
      assert.ok(t.combos > 0 && t.cost === t.combos * 2, `${key}/${mode} 注数或金额错误`);
      if (key === 'kl8' && mode !== 'single') assert.ok(t.nums.length > (extra.w || 10), `${mode} 应生成复式/胆拖选号`);
    }
  }
});

test('排列3 / 福彩3D复式与胆拖注数符合官方组合规则', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'all.json'), 'utf8'));
  const run = (key, mode, opts) => E.generate({ g: ML.GAMES[key], draws: data[key].slice(-120), strategy: 'rand', count: 1, mode, ...opts }).tickets[0];
  assert.equal(run('pl3', 'direct_compound', { digitsPerPos: 2 }).combos, 8);
  assert.equal(run('pl3', 'direct_combo_compound', { poolSize: 4 }).combos, 24);
  assert.equal(run('pl3', 'group3_compound', { poolSize: 4 }).combos, 12);
  assert.equal(run('pl3', 'group6_compound', { poolSize: 4 }).combos, 4);
  assert.equal(run('pl3', 'group3_dantuo', { tuoCount: 3 }).combos, 6);
  assert.equal(run('pl3', 'group6_dantuo', { danCount: 1, tuoCount: 4 }).combos, 6);
  assert.equal(run('pl3', 'direct_combo_dantuo', { danCount: 1, tuoCount: 4 }).combos, 36);
  assert.equal(run('f3d', 'direct_compound', { digitsPerPos: 2 }).combos, 8);
  assert.equal(run('f3d', 'group6_compound', { poolSize: 4 }).combos, 4);
  assert.equal(run('pl5', 'direct_compound', { digitsPerPos: 2 }).combos, 32);
  assert.equal(run('dlt', 'front_dantuo', { mainDan: 4, mainTuo: 2 }).combos, 2);
  assert.equal(run('dlt', 'full_dantuo', { mainDan: 4, mainTuo: 2, subTuo: 2 }).combos, 4);
  assert.equal(run('ssq', 'red_dantuo', { mainDan: 5, mainTuo: 2 }).combos, 2);
  assert.equal(run('ssq', 'full_dantuo', { mainDan: 5, mainTuo: 2, subSize: 2 }).combos, 4);
  assert.equal(run('kl8', 'dantuo', { w: 10, danCount: 9, tuoCount: 2 }).combos, 2);
  assert.equal(run('pl3', 'group6_dantuo', { danCount: 2, tuoCount: 2 }).combos, 2);
  assert.equal(run('f3d', 'direct_combo_dantuo', { danCount: 2, tuoCount: 2 }).combos, 24);
  assert.equal(run('kl8', 'dantuo', { w: 5, danCount: 1, tuoCount: 79 }).combos, ML.comb(79, 4));
  assert.equal(run('kl8', 'dantuo', { w: 5, danCount: 4, tuoCount: 76 }).combos, 76);
  assert.equal(run('dlt', 'front_dantuo', { mainDan: 1, mainTuo: 34 }).combos, ML.comb(34, 4));
  assert.equal(run('ssq', 'red_dantuo', { mainDan: 1, mainTuo: 32 }).combos, ML.comb(32, 5));
  assert.equal(run('pl3', 'group3_dantuo', { tuoCount: 9 }).combos, 18);
  assert.equal(run('f3d', 'group6_dantuo', { danCount: 2, tuoCount: 8 }).combos, 8);
});

test('统一引擎：7 游戏可出号 + 回测均值接近理论', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'all.json'), 'utf8'));
  for (const key of ['dlt', 'qxc', 'pl3', 'pl5', 'ssq', 'kl8', 'f3d']) {
    const g = ML.GAMES[key];
    const ds = data[key].slice(-260);
    assert.ok(ds.length >= 200, key + ' 数据量不足');
    const o = { g, draws: ds, win: 100, strategy: 'rand', count: 3 };
    if (key === 'kl8') o.w = 6;
    const gen = E.generate(o);
    assert.ok(gen.tickets.length >= 1, key + ' 出号失败');
    const t0 = gen.tickets[0].nums;
    const expectN = g.kind === 'digit' ? g.digits : (g.key === 'kl8' ? o.w : g.groups.reduce((a, x) => a + x.pick, 0));
    assert.equal(t0.length, expectN, key + ' 号码数量');
    // 回测（随机策略应贴近理论均值）
    const bt = E.backtest({ g, draws: ds, len: 120, win: 60, strategy: 'rand', w: key === 'kl8' ? 6 : 0 });
    const s = E.summarize(g, bt);
    const theory = E.theoryMean(g, key === 'kl8' ? 6 : null);
    assert.ok(Math.abs(s.mean - theory) < Math.max(0.4, theory * 0.6), `${key} 均值 ${s.mean} 偏离理论 ${theory}`);
  }
});
