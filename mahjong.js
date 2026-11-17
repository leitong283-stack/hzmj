// 红中麻将 计算引擎：0-8 万, 9-17 条, 18-26 筒, 27 红中(癞子)
(function (root) {
  const HZ = 27;
  const SUITS = ['万', '条', '筒'];
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const name = t => t === HZ ? '红中' : CN[t % 9] + SUITS[Math.floor(t / 9)];

  // 解析 "123m456s789p hh" 记法；h/z 表示红中
  function parse(str) {
    const out = []; let buf = [];
    for (const ch of str.replace(/\s/g, '')) {
      if (/[1-9]/.test(ch)) buf.push(+ch);
      else if ('msp'.includes(ch)) { const b = 'msp'.indexOf(ch) * 9; buf.forEach(n => out.push(b + n - 1)); buf = []; }
      else if (ch === 'h' || ch === 'z') { if (buf.length) { buf.forEach(() => out.push(HZ)); buf = []; } else out.push(HZ); }
    }
    return out;
  }
  const toCounts = tiles => { const c = new Array(28).fill(0); tiles.forEach(t => c[t]++); return c; };

  // 单花色：在至多 k 个面子组、p 个雀头组内，最多能用掉多少张牌
  const memo = new Map();
  function suitBest(c, k, p) {
    let i = 0; while (i < 9 && !c[i]) i++;
    if (i === 9 || (k === 0 && p === 0)) return 0;
    const key = c.join('') + k + p;
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    const tryG = (idx, cost, nk, np) => {
      for (const j of idx) if (!c[j]) return;
      idx.forEach(j => c[j]--);
      best = Math.max(best, cost + suitBest(c, nk, np));
      idx.forEach(j => c[j]++);
    };
    c[i]--; best = suitBest(c, k, p); c[i]++; // 该张不用
    if (k > 0) {
      if (c[i] >= 3) tryG([i, i, i], 3, k - 1, p);
      if (i + 2 < 9 && c[i + 1] && c[i + 2]) tryG([i, i + 1, i + 2], 3, k - 1, p);
      if (c[i] >= 2) tryG([i, i], 2, k - 1, p);
      if (i + 1 < 9 && c[i + 1]) tryG([i, i + 1], 2, k - 1, p);
      if (i + 2 < 9 && c[i + 2]) tryG([i, i + 2], 2, k - 1, p);
      tryG([i], 1, k - 1, p);
    }
    if (p > 0) { if (c[i] >= 2) tryG([i, i], 2, k, p - 1); tryG([i], 1, k, p - 1); }
    memo.set(key, best);
    return best;
  }
  function maxUsed(counts, groups) {
    let dp = {}; // key k,p -> best
    for (let k = 0; k <= groups; k++) for (let p = 0; p <= 1; p++) dp[k + ',' + p] = 0;
    for (let s = 0; s < 3; s++) {
      const c = counts.slice(s * 9, s * 9 + 9);
      const nd = {};
      for (let k = 0; k <= groups; k++) for (let p = 0; p <= 1; p++) {
        let b = 0;
        for (let k1 = 0; k1 <= k; k1++) for (let p1 = 0; p1 <= p; p1++)
          b = Math.max(b, dp[(k - k1) + ',' + (p - p1)] + suitBest(c.slice(), k1, p1));
        nd[k + ',' + p] = b;
      }
      dp = nd;
    }
    return dp[groups + ',1'];
  }
  // 向听数（-1 表示胡）。适用于 3n+1（等摸牌）或 3n+2（等出牌）张
  function shantenStd(counts) {
    const n = counts.reduce((a, b) => a + b, 0), J = counts[HZ];
    const g = Math.ceil(n / 3) - 1;       // 3n+1 与 3n+2 张都要凑 n 个面子 + 1 将
    return (3 * g + 2) - maxUsed(counts, g) - J - 1;
  }
  function shantenChiitoi(counts) {
    const n = counts.reduce((a, b) => a + b, 0);
    if (n !== 13 && n !== 14) return 99;
    const J = counts[HZ]; let p = 0, s = 0;
    for (let i = 0; i < 27; i++) { p += Math.floor(counts[i] / 2); s += counts[i] % 2; }
    let pairs = p + Math.min(J, s) + Math.floor(Math.max(0, J - s) / 2);
    pairs = Math.min(pairs, 7);
    return 6 - pairs;
  }
  function shanten(counts, opts = {}) {
    if (counts[HZ] >= 4 && counts.reduce((a, b) => a + b, 0) % 3 === 2) return -1; // 四红中直接胡
    const a = shantenStd(counts);
    return opts.qidui === false ? a : Math.min(a, shantenChiitoi(counts));
  }

  // 分析一手 3n+2 张：每种打法的向听与进张
  function analyze(tiles, opts = {}) {
    const counts = toCounts(tiles);
    const seen = opts.seen ? toCounts(opts.seen) : new Array(28).fill(0);
    const remain = t => Math.max(0, 4 - counts[t] - seen[t]);
    const cur = shanten(counts, opts);
    const results = [];
    for (let d = 0; d < 28; d++) {
      if (!counts[d]) continue;
      counts[d]--;
      const s = shanten(counts, opts);
      const eff = [];
      for (let t = 0; t < 28; t++) {
        if (t === d) continue; // 打出的牌摸回来视为无效
        const r = remain(t) - (0);
        if (r <= 0) continue;
        counts[t]++;
        if (shanten(counts, opts) < s) eff.push({ tile: t, count: r });
        counts[t]--;
      }
      counts[d]++;
      results.push({ discard: d, shanten: s, eff, total: eff.reduce((a, e) => a + e.count, 0), kinds: eff.length });
    }
    results.sort((a, b) => a.shanten - b.shanten || b.total - a.total || (a.discard === HZ) - (b.discard === HZ) || edgeScore(b.discard) - edgeScore(a.discard));
    return { win: cur === -1, shanten: cur, results };
  }
  // 13 张：听牌/进张
  function waits(tiles, opts = {}) {
    const counts = toCounts(tiles), seen = opts.seen ? toCounts(opts.seen) : new Array(28).fill(0);
    const s = shanten(counts, opts), eff = [];
    for (let t = 0; t < 28; t++) {
      const r = Math.max(0, 4 - counts[t] - seen[t]); if (!r) continue;
      counts[t]++; if (shanten(counts, opts) < s) eff.push({ tile: t, count: r }); counts[t]--;
    }
    return { shanten: s, eff, total: eff.reduce((a, e) => a + e.count, 0) };
  }
  const edgeScore = t => t === HZ ? -9 : Math.abs(t % 9 - 4); // 同等条件优先打边张

  const api = { HZ, name, parse, toCounts, shanten, shantenStd, shantenChiitoi, analyze, waits };
  if (typeof module !== 'undefined') module.exports = api; else root.MJ = api;
})(this);
