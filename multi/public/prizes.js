// =============================================================
// 多游戏智能参考中心 · 游戏配置 + 规则 / 奖金 / 概率 / 验票
// 规则核对日期：2026-09-12（体彩/福彩官网现行公告）
// 仅供统计参考，不构成投注建议；浮动奖与派奖以当期公告为准。
// =============================================================
(function (root) {
  const ML = (root.ML = root.ML || {});

  // ---------- 组合数 ----------
  ML.comb = function (n, k) {
    if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return Math.round(r);
  };

  // ---------- 游戏注册表 ----------
  // kind: digit=逐位数字彩 / set=区间选号彩
  // digit.positions: 每位名称；digit.maxLast: 最后一位上限(仅七星彩=14)
  // set.groups: [{name,max,pick,cls}]  cls: red/blue/gold
  ML.GAMES = {
    pl3: {
      key: 'pl3', cat: 'tc', name: '排列3', short: '排列三', icon: '🔢',
      kind: 'digit', positions: ['百位', '十位', '个位'], digits: 3, modes: ['direct', 'group3', 'group6'],
      schedule: '每天开奖一期（约 20:30，休市除外）', source: '中国体育彩票',
      intro: '支持直选单式/复式、直选组合复式、组选3/6单式与复式、三类胆拖，以及跨度和值选号。',
    },
    pl5: {
      key: 'pl5', cat: 'tc', name: '排列5', short: '排列五', icon: '🎯',
      kind: 'digit', positions: ['万位', '千位', '百位', '十位', '个位'], digits: 5, modes: ['direct'],
      schedule: '每天开奖一期（约 20:30，休市除外）', source: '中国体育彩票',
      intro: '从 00000-99999 选号，支持单式和每位多选号码的复式投注。',
    },
    f3d: {
      key: 'f3d', cat: 'fc', name: '福彩3D', short: '3D', icon: '🎲',
      kind: 'digit', positions: ['百位', '十位', '个位'], digits: 3, modes: ['direct', 'group3', 'group6'],
      schedule: '每天开奖一期（约 21:15，休市除外）', source: '中国福利彩票',
      intro: '官方包含单选/组选及其复式、胆拖，并支持 1D/2D、通选、和数、包选、猜大小、猜1D、猜2D、猜三同、拖拉机和猜奇偶。',
    },
    qxc: {
      key: 'qxc', cat: 'tc', name: '7星彩', short: '七星彩', icon: '⭐',
      kind: 'digit', positions: ['第1位', '第2位', '第3位', '第4位', '第5位', '第6位', '末位'], digits: 7,
      maxLast: 14, modes: ['direct'],
      schedule: '每周二、五、日开奖（约 20:25，休市除外）', source: '中国体育彩票',
      intro: '前6位各选 0-9、末位选 0-14；支持前六位复式、末位复式和全复式。',
    },
    dlt: {
      key: 'dlt', cat: 'tc', name: '超级大乐透', short: '大乐透', icon: '💥',
      kind: 'set', groups: [{ name: '前区', max: 35, pick: 5, cls: 'red' }, { name: '后区', max: 12, pick: 2, cls: 'blue' }],
      schedule: '每周一、三、六开奖（约 21:10，休市除外）', source: '中国体育彩票',
      intro: '前区 01-35 选 5 + 后区 01-12 选 2；支持前区/后区/双区复式、前区胆拖、追加与多倍投注。',
    },
    ssq: {
      key: 'ssq', cat: 'fc', name: '双色球', short: '双色球', icon: '🔴',
      kind: 'set', groups: [{ name: '红球', max: 33, pick: 6, cls: 'red' }, { name: '蓝球', max: 16, pick: 1, cls: 'blue' }],
      schedule: '每周二、四、日开奖（约 21:15，休市除外）', source: '中国福利彩票',
      intro: '红球 01-33 选 6 + 蓝球 01-16 选 1；支持红球/蓝球/全复式与红球胆拖。',
    },
    kl8: {
      key: 'kl8', cat: 'fc', name: '快乐8', short: '快乐8', icon: '🎱',
      kind: 'set', groups: [{ name: '开奖号码', max: 80, pick: 20, cls: 'gold' }], playW: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      schedule: '每天开奖一期（约 21:30，休市除外）', source: '中国福利彩票',
      intro: '从 01-80 中开出 20 个号码；选一至选十共 10 种玩法，支持复式/胆拖。',
    },
  };
  ML.CATS = { tc: { name: '体彩游戏', sub: '体育彩票 · 中国体育彩票' }, fc: { name: '福彩游戏', sub: '福利彩票 · 中国福利彩票' } };
  ML.order = ['dlt', 'qxc', 'pl3', 'pl5', 'ssq', 'kl8', 'f3d'];
  ML.byCat = { tc: ['dlt', 'qxc', 'pl3', 'pl5'], fc: ['ssq', 'kl8', 'f3d'] };

  // 官方投注方式（智能出号与生成器共用；名称、可选形式均按官网规则）
  ML.PLAY_OPTIONS = {
    dlt: [
      { key: 'single', label: '单式' },
      { key: 'front_compound', label: '前区复式' },
      { key: 'back_compound', label: '后区复式' },
      { key: 'full_compound', label: '双区复式' },
      { key: 'front_dantuo', label: '前区胆拖' },
    ],
    qxc: [
      { key: 'direct', label: '单式' },
      { key: 'front_compound', label: '前六位复式' },
      { key: 'last_compound', label: '末位复式' },
      { key: 'full_compound', label: '全复式' },
    ],
    pl3: [
      { key: 'direct', label: '直选单式' },
      { key: 'direct_compound', label: '直选复式' },
      { key: 'direct_combo_compound', label: '直选组合复式' },
      { key: 'group3', label: '组选3单式' },
      { key: 'group3_compound', label: '组选3复式' },
      { key: 'group6', label: '组选6单式' },
      { key: 'group6_compound', label: '组选6复式' },
      { key: 'group3_dantuo', label: '组选3胆拖' },
      { key: 'group6_dantuo', label: '组选6胆拖' },
      { key: 'direct_combo_dantuo', label: '直选组合胆拖' },
      { key: 'direct_span', label: '直选跨度' },
      { key: 'group3_span', label: '组选3跨度' },
      { key: 'group6_span', label: '组选6跨度' },
      { key: 'direct_sum', label: '直选和值' },
      { key: 'group_sum', label: '组选和值' },
    ],
    pl5: [
      { key: 'direct', label: '单式' },
      { key: 'direct_compound', label: '复式' },
    ],
    ssq: [
      { key: 'single', label: '单式' },
      { key: 'red_compound', label: '红球复式' },
      { key: 'blue_compound', label: '蓝球复式' },
      { key: 'full_compound', label: '全复式' },
      { key: 'red_dantuo', label: '红球胆拖' },
    ],
    kl8: [
      { key: 'single', label: '单式' },
      { key: 'compound', label: '复式' },
      { key: 'dantuo', label: '胆拖' },
    ],
    f3d: [
      { key: 'direct', label: '单选' },
      { key: 'direct_compound', label: '单选复式' },
      { key: 'direct_combo_compound', label: '单选组合复式' },
      { key: 'group3', label: '组选3' },
      { key: 'group3_compound', label: '组选3复式' },
      { key: 'group6', label: '组选6' },
      { key: 'group6_compound', label: '组选6复式' },
      { key: 'group3_dantuo', label: '组选3胆拖' },
      { key: 'group6_dantuo', label: '组选6胆拖' },
      { key: 'direct_combo_dantuo', label: '单选组合胆拖' },
      { key: '1d', label: '1D' },
      { key: 'guess1d', label: '猜1D' },
      { key: '2d', label: '2D' },
      { key: 'guess2d_same', label: '猜2D·两同号' },
      { key: 'guess2d_diff', label: '猜2D·两不同号' },
      { key: 'tx', label: '通选' },
      { key: 'sum', label: '和数' },
      { key: 'package3', label: '包选三' },
      { key: 'package6', label: '包选六' },
      { key: 'bigsmall', label: '猜大小' },
      { key: 'triple', label: '猜三同' },
      { key: 'tractor', label: '拖拉机' },
      { key: 'oddeven', label: '猜奇偶' },
    ],
  };
  ML.playOptions = (key) => ML.PLAY_OPTIONS[key] || [{ key: 'direct', label: '单式' }];
  ML.playLabel = (key, mode) => (ML.playOptions(key).find((x) => x.key === mode) || {}).label || mode;

  // ---------- 数字彩规则 / 奖金 ----------
  ML.P3_PRIZES = [ // 排列3 基础与官方补充投注方式
    { mode: 'direct', name: '直选单式', desc: '3 位号码与开奖号码逐位完全相同', prize: 1040, prob: 1 / 1000 },
    { mode: 'direct_compound', name: '直选复式', desc: '至少 1 位选 2 个及以上数字', prize: 1040, prob: 1 / 1000 },
    { mode: 'direct_combo_compound', name: '直选组合复式', desc: '选 3 个及以上不重复数字，覆盖全部排列', prize: 1040, prob: 1 / 1000 },
    { mode: 'group3', name: '组选3单式', desc: '两位相同，顺序不限', prize: 346, prob: 3 / 1000 },
    { mode: 'group3_compound', name: '组选3复式', desc: '选 2-10 个不重复数字，覆盖组三组合', prize: 346, prob: 3 / 1000 },
    { mode: 'group6', name: '组选6单式', desc: '三位各不相同，顺序不限', prize: 173, prob: 6 / 1000 },
    { mode: 'group6_compound', name: '组选6复式', desc: '选 4-10 个不重复数字，覆盖组六组合', prize: 173, prob: 6 / 1000 },
    { mode: 'group3_dantuo', name: '组选3胆拖', desc: '1 个胆码 + 2 个及以上拖码', prize: 346, prob: 3 / 1000 },
    { mode: 'group6_dantuo', name: '组选6胆拖', desc: '1-2 个胆码 + 拖码，总数不少于 4', prize: 173, prob: 6 / 1000 },
    { mode: 'direct_combo_dantuo', name: '直选组合胆拖', desc: '不超过 2 胆 + 拖码，覆盖全部排列', prize: 1040, prob: 1 / 1000 },
    { mode: 'direct_span', name: '直选跨度', desc: '按 1 个及以上跨度覆盖全部直选排列', prize: 1040, prob: 1 / 1000 },
    { mode: 'group3_span', name: '组选3跨度', desc: '按跨度覆盖全部组三组合', prize: 346, prob: 3 / 1000 },
    { mode: 'group6_span', name: '组选6跨度', desc: '按跨度覆盖全部组六组合', prize: 173, prob: 6 / 1000 },
    { mode: 'direct_sum', name: '直选和值', desc: '按 0-27 和值覆盖全部直选排列', prize: 1040, prob: 1 / 1000 },
    { mode: 'group_sum', name: '组选和值', desc: '按 1-26 和值覆盖全部组选组合', prize: 173, prob: 1 / 1000 },
  ];
  ML.P5_PRIZES = [{ mode: 'direct', name: '一等奖(直选)', desc: '5 位号码与开奖号码逐位完全相同', prize: 100000, prob: 1 / 100000 }];

  ML.F3D_PRIZES = [
    { mode: 'direct', name: '单选', desc: '三位按位完全相同', prize: 1040, prob: 1 / 1000 },
    { mode: 'group3', name: '组选3', desc: '两位相同，顺序不限', prize: 346, prob: 3 / 1000 },
    { mode: 'group6', name: '组选6', desc: '三位各不相同，顺序不限', prize: 173, prob: 6 / 1000 },
    { mode: 'direct_compound', name: '单选复式', desc: '至少 1 位选 2 个及以上数字', prize: 1040, prob: 1 / 1000 },
    { mode: 'direct_combo_compound', name: '单选组合复式', desc: '选 3 个及以上不重复数字，覆盖全部排列', prize: 1040, prob: 1 / 1000 },
    { mode: 'group3_compound', name: '组选3复式', desc: '选 2-10 个不重复数字，覆盖组三组合', prize: 346, prob: 3 / 1000 },
    { mode: 'group6_compound', name: '组选6复式', desc: '选 4-10 个不重复数字，覆盖组六组合', prize: 173, prob: 6 / 1000 },
    { mode: 'group3_dantuo', name: '组选3胆拖', desc: '1 个胆码 + 2 个及以上拖码', prize: 346, prob: 3 / 1000 },
    { mode: 'group6_dantuo', name: '组选6胆拖', desc: '1-2 个胆码 + 拖码，总数不少于 4', prize: 173, prob: 6 / 1000 },
    { mode: 'direct_combo_dantuo', name: '单选组合胆拖', desc: '不超过 2 胆 + 拖码，覆盖全部排列', prize: 1040, prob: 1 / 1000 },
    { mode: '1d', name: '1D', desc: '指定位置号码相同', prize: 10, prob: 1 / 10 },
    { mode: 'guess1d', name: '猜1D', desc: '按任意位置命中 1/2/3 次', prize: '2 / 12 / 230', prob: 271 / 1000 },
    { mode: '2d', name: '2D', desc: '指定两位按位相同', prize: 104, prob: 1 / 100 },
    { mode: 'guess2d_same', name: '猜2D·两同号', desc: '开奖号码包含所选重复号', prize: 37, prob: 28 / 1000 },
    { mode: 'guess2d_diff', name: '猜2D·两不同号', desc: '开奖号码包含所选两个不同号', prize: 19, prob: 72 / 1000 },
    { mode: 'tx', name: '通选', desc: '通选1 全中 470 元；通选2 任意两位按位中 21 元', prize: '470 / 21', prob: 28 / 1000 },
    { mode: 'sum', name: '和数', desc: '三位数之和相同，奖金 14-1040 元', prize: '14-1040', prob: 1 },
    { mode: 'package3', name: '包选三', desc: '全中 693 元 / 组中 173 元', prize: '693 / 173', prob: 3 / 1000 },
    { mode: 'package6', name: '包选六', desc: '全中 606 元 / 组中 86 元', prize: '606 / 86', prob: 6 / 1000 },
    { mode: 'bigsmall', name: '猜大小', desc: '和值大小性质相同', prize: 6, prob: 1 },
    { mode: 'triple', name: '猜三同', desc: '开奖三位相同且号码一致', prize: 104, prob: 1 / 100 },
    { mode: 'tractor', name: '拖拉机', desc: '升/降连续排列且顺序一致', prize: 65, prob: 16 / 1000 },
    { mode: 'oddeven', name: '猜奇偶', desc: '三位奇偶性质相同', prize: 8, prob: 1 },
  ];

  // 七星彩 6 奖级（一/二浮动；三~六固定）
  ML.QXC_PRIZES = [
    { tier: 1, name: '一等奖', cond: '全部 7 位与开奖号码对应位置相同', prize: '浮动', cap: '最高500万', prob: null },
    { tier: 2, name: '二等奖', cond: '前 6 位与开奖号码对应位置相同', prize: '浮动', cap: '最高500万', prob: null },
    { tier: 3, name: '三等奖', cond: '前 6 位中任意 5 位相同 且 末位相同', prize: 3000, prob: null },
    { tier: 4, name: '四等奖', cond: '7 位中任意 5 位与开奖号码对应位置相同', prize: 500, prob: null },
    { tier: 5, name: '五等奖', cond: '7 位中任意 4 位与开奖号码对应位置相同', prize: 30, prob: null },
    { tier: 6, name: '六等奖', cond: '任意 3 位相同；或前 6 位任意 1 位+末位；或仅末位相同', prize: 5, prob: null },
  ];

  // 超级大乐透现行 9 奖级（中国体育彩票官方游戏规则）
  ML.DLT_PRIZES = [
    { tier: 1, name: '一等奖', cond: '5 前区 + 2 后区', prize: '浮动', cap: '最高500万', pool: null },
    { tier: 2, name: '二等奖', cond: '5 前区 + 1 后区', prize: '浮动', cap: '最高500万', pool: null },
    { tier: 3, name: '三等奖', cond: '5 前区 + 0 后区', prize: 10000, pool: null, cap: null },
    { tier: 4, name: '四等奖', cond: '4 前区 + 2 后区', prize: 3000, pool: null, cap: null },
    { tier: 5, name: '五等奖', cond: '4 前区 + 1 后区', prize: 300, pool: null, cap: null },
    { tier: 6, name: '六等奖', cond: '3 前区 + 2 后区', prize: 200, pool: null, cap: null },
    { tier: 7, name: '七等奖', cond: '4 前区 + 0 后区', prize: 100, pool: null, cap: null },
    { tier: 8, name: '八等奖', cond: '3 前区 + 1 后区 / 2 前区 + 2 后区', prize: 15, pool: null, cap: null },
    { tier: 9, name: '九等奖', cond: '3 前区 + 0 后区 / 2 前区 + 1 后区 / 1 前区 + 2 后区 / 0 前区 + 2 后区', prize: 5, pool: null, cap: null },
  ];
  ML.DLT_MATCH = { // [前区命中数, 后区命中数] → 奖级
    5: { 2: 1, 1: 2, 0: 3 }, 4: { 2: 4, 1: 5, 0: 7 }, 3: { 2: 6, 1: 8, 0: 9 },
    2: { 2: 8, 1: 9 }, 1: { 2: 9 }, 0: { 2: 9 },
  };

  // 双色球 6 奖级（2026 现行：福运奖已暂停）
  ML.SSQ_PRIZES = [
    { tier: 1, name: '一等奖', cond: '6 红 + 1 蓝', prize: '浮动', cap: '最高500万(注) 或 500万+特别结构', pool: null },
    { tier: 2, name: '二等奖', cond: '6 红 + 0 蓝', prize: '浮动', cap: '最高500万', pool: null },
    { tier: 3, name: '三等奖', cond: '5 红 + 1 蓝', prize: 3000, pool: null, cap: null },
    { tier: 4, name: '四等奖', cond: '5 红 + 0 蓝 / 4 红 + 1 蓝', prize: 200, pool: null, cap: null },
    { tier: 5, name: '五等奖', cond: '4 红 + 0 蓝 / 3 红 + 1 蓝', prize: 10, pool: null, cap: null },
    { tier: 6, name: '六等奖', cond: '2 红 + 1 蓝 / 1 红 + 1 蓝 / 0 红 + 1 蓝', prize: 5, pool: null, cap: null },
  ];
  ML.SSQ_MATCH = { // [红命中, 蓝命中] → 奖级
    6: { 1: 1, 0: 2 }, 5: { 1: 3, 0: 4 }, 4: { 1: 4, 0: 5 }, 3: { 1: 5 }, 2: { 1: 6 }, 1: { 1: 6 }, 0: { 1: 6 },
  };

  // 快乐8 现行奖金表（选一~选十；浮动奖以当期公告为准）
  ML.KL8_PRIZES = {
    1: [{ hit: 1, prize: 4.5 }],
    2: [{ hit: 2, prize: 19 }],
    3: [{ hit: 3, prize: 52 }, { hit: 2, prize: 3 }],
    4: [{ hit: 4, prize: 93 }, { hit: 3, prize: 5 }, { hit: 2, prize: 3 }],
    5: [{ hit: 5, prize: 1000 }, { hit: 4, prize: 20 }, { hit: 3, prize: 3 }],
    6: [{ hit: 6, prize: 2880 }, { hit: 5, prize: 30 }, { hit: 4, prize: 10 }, { hit: 3, prize: 3 }],
    7: [{ hit: 7, prize: 8500 }, { hit: 6, prize: 300 }, { hit: 5, prize: 30 }, { hit: 4, prize: 4 }, { hit: 0, prize: 2 }],
    8: [{ hit: 8, prize: 50000 }, { hit: 7, prize: 800 }, { hit: 6, prize: 80 }, { hit: 5, prize: 10 }, { hit: 4, prize: 3 }, { hit: 0, prize: 2 }],
    9: [{ hit: 9, prize: null, float: true }, { hit: 8, prize: 2000 }, { hit: 7, prize: 225 }, { hit: 6, prize: 22 }, { hit: 5, prize: 5 }, { hit: 4, prize: 3 }, { hit: 0, prize: 2 }],
    10: [{ hit: 10, prize: null, float: true }, { hit: 9, prize: 8000 }, { hit: 8, prize: 720 }, { hit: 7, prize: 80 }, { hit: 6, prize: 5 }, { hit: 5, prize: 3 }, { hit: 0, prize: 2 }],
  };
  ML.KL8_PLAY = (w) => '选' + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][w];

  // ---------- 工具 ----------
  ML.pad2 = (n) => String(n).padStart(2, '0');
  ML.fmtBall = (n) => String(n).padStart(2, '0');
  ML.fmtMoney = (n) => (n == null ? '—' : Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 }));
  ML.numType = function (nums) { // 豹子/组三/组六
    const s = new Set(nums);
    if (s.size === 1) return 'all';
    if (s.size === 2) return 'group3';
    return 'group6';
  };
  ML.parseDigits = function (text, n) {
    const raw = String(text || '').replace(/[^\d]/g, '');
    if (raw.length !== n) return null;
    return raw.split('').map((x) => parseInt(x, 10));
  };
  ML.parseBallNums = function (text, max) {
    const arr = String(text || '').split(/[\s,，;；]+/).map((s) => parseInt(s, 10)).filter((x) => Number.isInteger(x));
    if (!arr.length || arr.some((x) => x < 1 || x > max)) return null;
    return arr;
  };
  ML.groupsOf = function (ticket, g) { // 按 groups 拆分 nums
    const out = []; let i = 0;
    for (const grp of g.groups) { out.push(ticket.slice(i, i + grp.pick)); i += grp.pick; }
    return out;
  };
  ML.hits = function (mine, drawNums) { // 组内命中数（无序）
    const s = new Set(drawNums);
    return mine.filter((x) => s.has(x)).length;
  };
  ML.maxLastOf = (g) => (g.kind === 'digit' ? (g.maxLast != null ? g.maxLast : 9) : 0);

  // ---------- 验票：数字彩 ----------
  // pl3/f3d: mode direct/group3/group6
  ML.check3D = function (mode, myNums, drawNums) {
    const mine = myNums.slice().sort((a, b) => a - b);
    const draw = drawNums.slice().sort((a, b) => a - b);
    const type = ML.numType(drawNums);
    if (mode === 'direct') {
      const win = myNums.length === 3 && myNums.every((v, i) => v === drawNums[i]);
      return { win, tier: win ? 1 : 0, prize: win ? 1040 : 0, desc: win ? '直选命中：顺序完全一致' : '未中：与开奖号码不一致' };
    }
    if (mode === 'group3') {
      const win = type === 'group3' && mine[0] === draw[0] && mine[1] === draw[1] && mine[2] === draw[2];
      return { win, tier: win ? 1 : 0, prize: win ? 346 : 0, desc: win ? '组选3命中' : (type === 'group3' ? '未中：号码组合不同' : '未中：当期开奖非组三形态') };
    }
    const win = type === 'group6' && mine[0] === draw[0] && mine[1] === draw[1] && mine[2] === draw[2];
    return { win, tier: win ? 1 : 0, prize: win ? 173 : 0, desc: win ? '组选6命中' : (type === 'group6' ? '未中：号码组合不同' : '未中：当期开奖非组六形态') };
  };

  // 福彩3D 官方扩展投注方式
  ML.F3D_SUM_PRIZES = { 0: 1040, 1: 345, 2: 172, 3: 104, 4: 69, 5: 49, 6: 37, 7: 29, 8: 23, 9: 19, 10: 16, 11: 15, 12: 15, 13: 14, 14: 14, 15: 15, 16: 15, 17: 16, 18: 19, 19: 23, 20: 29, 21: 37, 22: 49, 23: 69, 24: 104, 25: 172, 26: 345, 27: 1040 };
  ML.TRACTOR_NUMS = (() => {
    const out = [];
    for (let start = 0; start <= 7; start++) out.push(String(start) + String(start + 1) + String(start + 2));
    for (let start = 9; start >= 2; start--) out.push(String(start) + String(start - 1) + String(start - 2));
    return out;
  })();
  ML.isTractor = (nums) => ML.TRACTOR_NUMS.includes(nums.join(''));
  ML.checkF3D = function (ticket, drawNums) {
    const mode = ticket.mode || 'direct';
    if (mode === 'direct' || mode === 'group3' || mode === 'group6') return ML.check3D(mode, ticket.nums, drawNums);
    const mine = (ticket.nums || []).slice();
    const sum = drawNums.reduce((a, b) => a + b, 0);
    const win = (yes, prize, hitText, missText) => ({ win: !!yes, tier: yes ? 1 : 0, prize: yes ? prize : 0, desc: yes ? hitText : missText });
    if (mode === '1d') {
      const p = Number(ticket.pos || 0), hit = drawNums[p] === mine[0];
      return win(hit, 10, `1D 命中：${ticket.posName || String(p + 1)}位为 ${mine[0]}`, `1D 未中：${ticket.posName || String(p + 1)}位不是 ${mine[0]}`);
    }
    if (mode === 'guess1d') {
      const cnt = drawNums.filter((d) => d === mine[0]).length;
      const prize = [0, 2, 12, 230][cnt] || 0;
      return win(cnt > 0, prize, `猜1D命中：数字 ${mine[0]} 出现 ${cnt} 次`, `猜1D未中：数字 ${mine[0]} 未出现`);
    }
    if (mode === '2d') {
      const pos = ticket.positions || [0, 1], hit = pos.every((p, i) => drawNums[p] === mine[i]);
      return win(hit, 104, `2D 命中：指定两位按位相同（${mine.join(' ')}）`, `2D 未中：指定两位不完全相同`);
    }
    if (mode === 'guess2d_same') {
      const cnt = drawNums.filter((d) => d === mine[0]).length, hit = cnt >= 2;
      return win(hit, 37, `猜2D两同号命中：开奖中包含两个 ${mine[0]}`, `猜2D两同号未中：开奖中不足两个 ${mine[0]}`);
    }
    if (mode === 'guess2d_diff') {
      const hit = mine.every((d) => drawNums.includes(d));
      return win(hit, 19, `猜2D两不同号命中：开奖包含 ${mine.join('、')}`, `猜2D两不同号未中：开奖未同时包含 ${mine.join('、')}`);
    }
    if (mode === 'tx') {
      const same = drawNums.filter((d, i) => d === mine[i]).length;
      const prize = same === 3 ? 470 : same === 2 ? 21 : 0;
      return win(prize > 0, prize, `通选${same === 3 ? '1' : '2'}命中：按位相同 ${same} 位`, `通选未中：按位相同 ${same} 位`);
    }
    if (mode === 'sum') {
      const hit = sum === mine[0], prize = ML.F3D_SUM_PRIZES[sum] || 0;
      return win(hit, prize, `和数命中：和值 ${sum}，奖金 ${prize} 元`, `和数未中：开奖和值 ${sum}`);
    }
    if (mode === 'package3' || mode === 'package6') {
      const wantType = mode === 'package3' ? 'group3' : 'group6';
      const exact = mine.length === 3 && mine.every((d, i) => d === drawNums[i]);
      const grouped = ML.numType(mine) === wantType && ML.numType(drawNums) === wantType && mine.slice().sort().join() === drawNums.slice().sort().join();
      const prize = exact ? (mode === 'package3' ? 693 : 606) : grouped ? (mode === 'package3' ? 173 : 86) : 0;
      return win(prize > 0, prize, `${mode === 'package3' ? '包选三' : '包选六'}${exact ? '全中' : '组中'}：奖金 ${prize} 元`, `${mode === 'package3' ? '包选三' : '包选六'}未中`);
    }
    if (mode === 'bigsmall') {
      const actual = sum >= 19 ? 'big' : sum <= 8 ? 'small' : 'none';
      const hit = actual === ticket.option;
      return win(hit, 6, `猜大小命中：和值 ${sum} 属于${ticket.option === 'big' ? '大' : '小'}`, `猜大小未中：和值 ${sum} 为${actual === 'none' ? '中间值' : actual === 'big' ? '大' : '小'}`);
    }
    if (mode === 'triple') {
      const hit = drawNums[0] === drawNums[1] && drawNums[1] === drawNums[2] && drawNums[0] === mine[0];
      return win(hit, 104, `猜三同命中：${mine[0]}${mine[0]}${mine[0]}`, '猜三同未中');
    }
    if (mode === 'tractor') {
      const hit = ML.isTractor(drawNums) && mine.join('') === drawNums.join('');
      return win(hit, 65, `拖拉机命中：${mine.join('')}`, '拖拉机未中');
    }
    if (mode === 'oddeven') {
      const actual = drawNums.every((d) => d % 2 === 1) ? 'odd' : drawNums.every((d) => d % 2 === 0) ? 'even' : 'mixed';
      const hit = actual === ticket.option;
      return win(hit, 8, `猜奇偶命中：开奖为${ticket.option === 'odd' ? '奇' : '偶'}`, `猜奇偶未中：开奖为${actual === 'mixed' ? '奇偶混合' : actual === 'odd' ? '奇' : '偶'}`);
    }
    return { win: false, tier: 0, prize: 0, desc: '未知投注方式' };
  };

  // pl5 / 七星彩（按位）
  ML.checkSeq = function (myNums, drawNums) {
    let same = 0;
    for (let i = 0; i < myNums.length && i < drawNums.length; i++) if (myNums[i] === drawNums[i]) same++;
    return { same, win: same === myNums.length };
  };

  // 七星彩：返回最高奖级
  ML.checkQxc = function (myNums, drawNums) {
    let b = 0, s = 0;
    for (let i = 0; i < 6; i++) if (myNums[i] === drawNums[i]) b++;
    if (myNums[6] === drawNums[6]) s = 1;
    let tier = 0;
    if (b === 6 && s) tier = 1;
    else if (b === 6) tier = 2;
    else if (b === 5 && s) tier = 3;
    else if (b === 5 || (b === 4 && s)) tier = 4;
    else if (b === 4 || (b === 3 && s)) tier = 5;
    else if (b === 3 || (b === 2 && s) || (b === 1 && s) || (b === 0 && s)) tier = 6;
    const row = ML.QXC_PRIZES[tier - 1];
    return {
      win: tier > 0, tier,
      prize: row ? row.prize : 0, float: row ? row.prize === '浮动' : false,
      detail: { b, s },
      desc: tier === 0 ? `未中（前6位按位相同 ${b}/6 · 末位 ${s ? '中' : '不中'}）`
        : `命中${['一', '二', '三', '四', '五', '六'][tier - 1]}等奖：${row.cond}（前6位 ${b}/6，末位 ${s ? '中' : '不中'}）`,
    };
  };

  // ---------- 验票：区间选号彩 ----------
  // dlt/ssq: ticket 按 groups 顺序传（前区5 + 后区2 等）
  ML.checkSet = function (key, myNums, drawNums) {
    const g = ML.GAMES[key];
    const mine = ML.groupsOf(myNums, g);
    const dr = ML.groupsOf(drawNums, g);
    const hitArr = mine.map((m, i) => ML.hits(m, dr[i]));
    const hitKey = key === 'dlt' ? ML.DLT_MATCH : ML.SSQ_MATCH;
    const tier = (hitKey[hitArr[0]] && hitKey[hitArr[0]][hitArr[1]]) || 0;
    const table = key === 'dlt' ? ML.DLT_PRIZES : ML.SSQ_PRIZES;
    const row = tier ? table[tier - 1] : null;
    return {
      win: tier > 0, tier, hitArr,
      prize: row && Array.isArray(row.prize) ? row.prize[1] : row ? row.prize : 0,
      float: row ? row.prize === '浮动' : false,
      desc: tier === 0 ? `未中（${g.groups[0].name}命中 ${hitArr[0]}/${g.groups[0].pick} · ${g.groups[1].name}命中 ${hitArr[1]}/${g.groups[1].pick}）`
        : `命中${['一', '二', '三', '四', '五', '六', '七', '八', '九'][tier - 1]}等奖：${row.cond}`,
    };
  };

  // 快乐8（单式玩法 w）
  ML.checkKl8 = function (w, myNums, drawNums) {
    const h = ML.hits(myNums, drawNums);
    const rows = ML.KL8_PRIZES[w] || [];
    const row = rows.find((x) => x.hit === h) || { hit: h, prize: 0 };
    return {
      win: row.prize > 0 || !!row.float, tier: row.prize > 0 || row.float ? 1 : 0, hit: h, w,
      prize: row.prize, float: !!row.float,
      desc: row.prize > 0 || row.float
        ? `选${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][w]}玩法 命中 ${h}/${w}：${ML.KL8_PLAY(w)}中${h}${row.prize == null ? '（浮动奖）' : `，单注 ${row.prize} 元`}`
        : `选${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][w]}玩法 未中（命中 ${h}/${w}）`,
    };
  };

  // ---------- 通用验票入口 ----------
  // ticket: {nums:[...], mode?, w?}
  ML.verify = function (key, ticket, drawNums) {
    const g = ML.GAMES[key];
    if (g.kind === 'digit') {
      if (key === 'f3d') return ML.checkF3D(ticket, drawNums);
      if (key === 'pl3') return ML.check3D(ticket.mode || 'direct', ticket.nums, drawNums);
      if (key === 'qxc') return ML.checkQxc(ticket.nums, drawNums);
      const r = ML.checkSeq(ticket.nums, drawNums); // pl5
      return { win: r.win, tier: r.win ? 1 : 0, prize: r.win ? 100000 : 0, same: r.same, desc: r.win ? '排列5 一等奖命中！' : `未中：按位相同 ${r.same}/5 位` };
    }
    if (key === 'kl8') return ML.checkKl8(ticket.w || 10, ticket.nums, drawNums);
    return ML.checkSet(key, ticket.nums, drawNums);
  };

  // ---------- 概率 ----------
  // 大乐透：P(前命中 i，后命中 j)
  ML.dltProbIJ = function (i, j) {
    const f = ML.comb(5, i) * ML.comb(30, 5 - i) / ML.comb(35, 5);
    const b = ML.comb(2, j) * ML.comb(10, 2 - j) / ML.comb(12, 2);
    return f * b;
  };
  ML.ssqProbIJ = function (i, j) {
    const r = ML.comb(6, i) * ML.comb(27, 6 - i) / ML.comb(33, 6);
    const b = j === 1 ? 1 / 16 : 15 / 16;
    return r * b;
  };
  // 七星彩：按位命中概率（每位独立）
  ML.qxcProb = function () {
    const rows = [];
    const add = (tier, p) => { rows.push({ tier, p }); };
    const pBase = (i) => ML.comb(6, i) * Math.pow(0.1, i) * Math.pow(0.9, 6 - i);
    add(1, Math.pow(0.1, 6) * (1 / 15));
    add(2, Math.pow(0.1, 6) * (14 / 15));
    add(3, ML.comb(6, 5) * Math.pow(0.1, 5) * 0.9 * (1 / 15));
    add(4, pBase(5) * (14 / 15) + pBase(4) * (1 / 15));
    add(5, pBase(4) * (14 / 15) + pBase(3) * (1 / 15));
    add(6, pBase(3) * (14 / 15) + pBase(2) * (1 / 15) + pBase(1) * (1 / 15) + pBase(0) * (1 / 15));
    return rows;
  };
  // 快乐8：玩法 w 恰好命中 h
  ML.kl8Prob = function (w, h) {
    const num = ML.comb(20, h) * ML.comb(60, w - h);
    const den = ML.comb(80, w);
    return den > 0 ? num / den : 0;
  };
  ML.odds = (p) => (p > 0 ? (1 / p).toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '—');
})(typeof window !== 'undefined' ? window : globalThis);
