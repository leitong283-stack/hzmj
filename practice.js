// 拆搭子练习：出题 + 判分 + 讲解（纯本地，依赖 mahjong.js；每题答案都由引擎计算）
(function (root) {
  const M = root.MJ || (typeof require !== 'undefined' ? require('./mahjong.js') : null);
  const HZ = 27;
  const rand = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 难度：用几门花色、几张红中、目标向听、正确答案与次优的最小进张差
  const LEVELS = {
    easy:   { label: '入门', suits: [3],    hz: [0, 1], shanten: [1, 1], minGap: 6 },
    normal: { label: '进阶', suits: [2, 3], hz: [0, 1], shanten: [1, 2], minGap: 4 },
    hard:   { label: '高手', suits: [1, 2], hz: [0, 2], shanten: [1, 2], minGap: 2 },
  };

  // 专题：按“最优解拆掉的是什么结构”来筛题
  const THEMES = {
    mix:   { label: '综合', tip: '先保证不退向听，再比较打完后的有效进张总数（不是种类数），进张多的就是好打法。' },
    single:{ label: '孤张', tip: '孤张先打：一、九这类边张孤张最难搭上，其次是二、八，三到七的中张最有潜力。孤张不止一张时，打能搭上的牌最少的那张。' },
    edge:  { label: '边张', tip: '搭子多了先拆边张（一二、八九）：边张只能等一种牌，比如一二万只等三万；两面能等两种，进张多一倍。' },
    kan:   { label: '嵌张', tip: '嵌张（如三五等四）只等一种牌，比两面差。搭子过多时，嵌张通常是第二个要拆的。但嵌张旁边有牌、能变成好形时要先算进张。' },
    pair:  { label: '对子', tip: '将只要一对。对子有三对以上、面子又不够时，拆一个对子往往比拆两面好；四对以上可以考虑七对。' },
    hz:    { label: '红中', tip: '红中是万能牌，能补任何缺口，几乎永远不该打。手里有红中时，搭子都可能变成面子，要更积极地留好形、拆差形。' },
  };

  // 按专题“埋”一个结构再随机补牌，提高出题命中率
  function deal(L, theme) {
    const nSuits = L.suits[rand(L.suits.length)];
    const suits = shuffle([0, 1, 2]).slice(0, nSuits);
    let nHz = L.hz[0] + rand(L.hz[1] - L.hz[0] + 1);
    if (theme === 'hz') nHz = Math.max(1, nHz);
    const left = new Array(27).fill(0);
    for (const s of suits) for (let n = 0; n < 9; n++) left[s * 9 + n] = 4;
    const hand = [];
    const put = t => { if (left[t] > 0) { left[t]--; hand.push(t); return true; } return false; };
    const S = () => suits[rand(suits.length)] * 9;
    if (theme === 'pair') { const used = new Set(); while (used.size < 3) { const t = S() + rand(9); if (!used.has(t)) { used.add(t); put(t); put(t); } } }
    if (theme === 'edge') { const b = S(); if (rand(2)) { put(b); put(b + 1); } else { put(b + 7); put(b + 8); } }
    if (theme === 'kan')  { const t = S() + 1 + rand(5); put(t); put(t + 2); }
    const wall = [];
    for (let t = 0; t < 27; t++) for (let k = 0; k < left[t]; k++) wall.push(t);
    shuffle(wall);
    while (hand.length < 14 - nHz) hand.push(wall.pop());
    for (let i = 0; i < nHz; i++) hand.push(HZ);
    return hand.sort((a, b) => a - b);
  }

  // ---------- 牌型拆解（讲解用）----------
  // 每门花色内搜索：面子最多 > 搭子质量最好；红中单列
  function decompose(tiles) {
    const c = M.toCounts(tiles);
    const parts = [];
    for (let s = 0; s < 3; s++) {
      const a = c.slice(s * 9, s * 9 + 9);
      const best = { score: -1, parts: [] };
      (function dfs(cur, score) {
        let i = 0; while (i < 9 && !a[i]) i++;
        if (i === 9) { if (score > best.score) { best.score = score; best.parts = cur.slice(); } return; }
        const t = s * 9 + i;
        const take = (idx, type, sc) => {
          const need = {}; for (const j of idx) { if (j > 8) return; need[j] = (need[j] || 0) + 1; }
          for (const j in need) if (a[j] < need[j]) return;
          idx.forEach(j => a[j]--); cur.push({ type, tiles: idx.map(j => s * 9 + j) });
          dfs(cur, score + sc);
          cur.pop(); idx.forEach(j => a[j]++);
        };
        take([i, i, i], '刻子', 100);
        take([i, i + 1, i + 2], '顺子', 100);
        take([i, i], '对子', 30);
        if (i + 1 <= 8) take([i, i + 1], (i === 0 || i === 7) ? '边张' : '两面', (i === 0 || i === 7) ? 20 : 32);
        if (i + 2 <= 8) take([i, i + 2], '嵌张', 22);
        a[i]--; cur.push({ type: '孤张', tiles: [t] }); dfs(cur, score); cur.pop(); a[i]++;
      })([], 0);
      parts.push(...best.parts);
    }
    if (c[HZ]) parts.push({ type: '红中', tiles: new Array(c[HZ]).fill(HZ) });
    return parts;
  }
  // 同一种牌可能出现在多个结构里（如五条一张在顺子、一张孤张），打它时视为拆最弱的那个
  const WEAK = ['孤张', '边张', '嵌张', '对子', '两面', '顺子', '刻子', '红中'];
  const partOf = (parts, t) => parts.filter(p => p.tiles.includes(t)).sort((a, b) => WEAK.indexOf(a.type) - WEAK.indexOf(b.type))[0];

  function matchTheme(theme, q, parts) {
    const bp = partOf(parts, q.best.discard);
    if (!bp) return false;
    switch (theme) {
      case 'single': return bp.type === '孤张' && parts.filter(p => p.type === '孤张').length >= 2;
      case 'edge':   return bp.type === '边张';
      case 'kan':    return bp.type === '嵌张';
      case 'pair':   return bp.type === '对子' && parts.filter(p => p.type === '对子').length >= 3;
      case 'hz':     return q.hand.includes(HZ);
      default:       return true;
    }
  }

  // 由一手牌构造题目（错题重练、自定义题都用它）
  function fromHand(hand, level = 'normal', theme = 'mix') {
    hand = hand.slice().sort((a, b) => a - b);
    const r = M.analyze(hand);
    const best = r.results[0];
    const correct = r.results.filter(x => x.shanten === best.shanten && x.total === best.total);
    return { hand, level, theme, result: r, best, correctSet: correct.map(x => x.discard), parts: decompose(hand) };
  }

  // 生成一道题；在时间预算内尽量找“差距明显”的题，找不到返回 null（调用方可放宽专题）
  function generate(level = 'normal', theme = 'mix', budgetMs = 1500) {
    const L = LEVELS[level];
    const t0 = Date.now();
    let fallback = null;
    while (Date.now() - t0 < budgetMs) {
      const hand = deal(L, theme);
      const sh = M.shanten(M.toCounts(hand));
      if (sh < L.shanten[0] || sh > L.shanten[1]) continue; // 先用便宜的向听筛一遍
      const r = M.analyze(hand);
      const best = r.results[0];
      if (best.discard === HZ) continue;
      const same = r.results.filter(x => x.shanten === best.shanten);
      const correct = same.filter(x => x.total === best.total);
      const worse = same.filter(x => x.total < best.total);
      if (!worse.length || correct.length > 2) continue;
      const q = { hand, level, theme, result: r, best, correctSet: correct.map(x => x.discard) };
      const parts = decompose(hand);
      if (!matchTheme(theme, q, parts)) continue;
      q.parts = parts;
      if (best.total - worse[0].total >= L.minGap) return q;
      if (!fallback) fallback = q;
    }
    return fallback;
  }

  function grade(q, discard) {
    const opt = q.result.results.find(x => x.discard === discard);
    const best = q.best;
    let verdict;
    if (q.correctSet.includes(discard)) verdict = 'right';
    else if (opt.shanten === best.shanten && opt.total >= best.total * 0.85) verdict = 'close';
    else verdict = 'wrong';
    return { verdict, opt, best };
  }

  // 讲解（纯规则 + 引擎数据，不调用 AI）
  function explain(q, g) {
    const { opt, best } = g;
    const nm = M.name;
    const st = s => s === 0 ? '听牌' : s + '向听';
    const lines = [];
    const bestNames = q.correctSet.map(nm).join(' 或 ');
    if (g.verdict === 'right') lines.push(`✅ 正确！打${nm(opt.discard)}后${st(opt.shanten)}，进张 ${opt.kinds} 种 ${opt.total} 张，是最优解。`);
    else if (g.verdict === 'close') lines.push(`🟡 接近。打${nm(opt.discard)}进张 ${opt.total} 张；最优是打${bestNames}，进张 ${best.total} 张，多 ${best.total - opt.total} 张。`);
    else if (opt.shanten > best.shanten) lines.push(`❌ 打${nm(opt.discard)}会退到${st(opt.shanten)}，倒退了一步。最优是打${bestNames}，保持${st(best.shanten)}，进张 ${best.total} 张。`);
    else lines.push(`❌ 打${nm(opt.discard)}进张只有 ${opt.total} 张；最优是打${bestNames}，进张 ${best.total} 张，多 ${best.total - opt.total} 张。`);

    const parts = q.parts || decompose(q.hand);
    const fmt = p => p.type === '红中' ? `红中×${p.tiles.length}` : `${p.type}[${p.tiles.map(t => nm(t)[0]).join('')}${nm(p.tiles[0]).slice(-1)}]`;
    lines.push('📋 牌型拆解：' + parts.map(fmt).join(' '));

    const mentsu = parts.filter(p => p.type === '顺子' || p.type === '刻子').length;
    const blocks = parts.filter(p => ['对子', '两面', '嵌张', '边张'].includes(p.type));
    const need = 4 - mentsu;
    if (blocks.length > need + 1) lines.push(`🔪 搭子过多：已有 ${mentsu} 组面子，还差 ${need} 组面子 + 1 对将，手里却有 ${blocks.length} 个搭子/对子，要拆掉最差的一个。`);

    const bp = partOf(parts, best.discard), up = partOf(parts, opt.discard);
    if (bp) lines.push(bp.type === '孤张' ? `💡 最优解打的${nm(best.discard)}是孤张。` : `💡 最优解拆的是「${bp.type}」里的${nm(best.discard)}。`);
    if (g.verdict !== 'right' && up && up !== bp) lines.push(`⚠️ 你拆的是「${up.type}」${up.type === '顺子' || up.type === '刻子' ? '，已经成型的面子不能拆' : ''}。`);

    const lost = best.eff.filter(e => !opt.eff.some(x => x.tile === e.tile));
    if (g.verdict !== 'right' && lost.length) lines.push(`🎯 打${nm(opt.discard)}会少接：${lost.map(e => `${nm(e.tile)}×${e.count}`).join('、')}`);
    lines.push(`📈 最优打法的有效牌：${best.eff.map(e => `${nm(e.tile)}×${e.count}`).join('、')}`);
    return lines;
  }

  root.Practice = { LEVELS, THEMES, generate, fromHand, grade, explain, decompose };
  if (typeof module !== 'undefined') module.exports = root.Practice;
})(typeof window !== 'undefined' ? window : globalThis);
