// 手机端直连 Claude API（无需后端）。密钥只存在本机 localStorage。
(function (root) {
  const TILE_CODES = [];
  for (const s of 'msp') for (let n = 1; n <= 9; n++) TILE_CODES.push(n + s);
  TILE_CODES.push('hz');

  const DEFAULT = { key: '', base: 'https://api.anthropic.com', auth: 'x-api-key', model: 'claude-opus-5-5' };
  const getCfg = () => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem('hzmj_cfg') || '{}') }; } catch { return { ...DEFAULT }; } };
  const setCfg = c => localStorage.setItem('hzmj_cfg', JSON.stringify(c));

  async function call(body) {
    const cfg = getCfg();
    if (!cfg.key) throw new Error('还没有设置 API 密钥，请点右上角 ⚙ 设置');
    const headers = {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (cfg.auth === 'bearer') headers['authorization'] = 'Bearer ' + cfg.key; else headers['x-api-key'] = cfg.key;
    const url = cfg.base.replace(/\/+$/, '').replace(/\/v1(\/messages)?$/, '') + '/v1/messages';
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: cfg.model || DEFAULT.model, ...body }) });
    } catch (e) { throw new Error('网络连不上接口地址（检查地址/网络，或该地址不允许浏览器直接访问）'); }
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error(`接口返回异常（HTTP ${r.status}）`); }
    if (!r.ok) {
      const msg = j?.error?.message || text.slice(0, 200);
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error('密钥无效或无权限：' + msg), { status: r.status });
      if (r.status === 429 || r.status === 529) throw Object.assign(new Error('AI 服务繁忙，请稍后重试'), { status: r.status });
      throw Object.assign(new Error(`AI 服务错误 ${r.status}：${msg}`), { status: r.status });
    }
    if (j.stop_reason === 'refusal') throw new Error('模型拒绝了该请求');
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  }

  const RECOGNIZE_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['hand', 'confidence', 'note'],
    properties: {
      hand: { type: 'array', items: { type: 'string', enum: TILE_CODES } },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      note: { type: 'string' },
    },
  };
  const RECOGNIZE_PROMPT = `你是麻将牌面识别器。图片里是一手红中麻将的手牌（可能是实体牌照片，也可能是 App 截图）。
红中麻将只有：万(m)、条/索(s)、筒/饼(p) 各 1-9，以及红中(hz)。没有风牌和其它字牌；若看到其它字牌，忽略并在 note 中说明。
编码：一万=1m … 九万=9m；一条=1s（通常是一只鸟）… 九条=9s；一筒=1p … 九筒=9p；红中=hz。
请逐张识别手牌（只识别属于玩家手牌的那一排/两排，不要算桌面上打出的牌），按从左到右、从上到下的顺序输出。
手牌通常是 13 或 14 张。数清楚每张，分辨相近的牌（如 二条/三条、六筒/八筒）。被画面裁掉看不清的牌不要猜，在 note 说明。
只输出 JSON：{"hand":[...],"confidence":"high|medium|low","note":"..."}`;

  async function recognize(dataUrl) {
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
    const content = [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: RECOGNIZE_PROMPT },
    ];
    let text;
    try {
      text = await call({ max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: RECOGNIZE_SCHEMA } }, messages: [{ role: 'user', content }] });
    } catch (e) {
      if (e.status !== 400) throw e; // 部分中转不支持结构化输出，退回普通请求
      text = await call({ max_tokens: 16000, messages: [{ role: 'user', content }] });
    }
    const js = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(js);
    const cnt = {};
    data.hand = (data.hand || []).filter(c => TILE_CODES.includes(c) && (cnt[c] = (cnt[c] || 0) + 1) <= 4);
    return data;
  }

  const ADVISE_SYSTEM = `你是一位红中麻将高手和教练。规则：只有万条筒和 4 张红中；红中是癞子（万能牌），可代替任何牌；可以碰杠不能吃；只能自摸（按常见玩法）；可胡七对；4 张红中直接胡。
你会拿到程序精确计算出的每种打法的“向听数”和“有效进张”。向听数越小越接近听牌（0=听牌，-1=已胡）。
请基于这些数据给出最合理的打牌思路：
1. 先一句话给结论：打哪张。
2. 说明这手牌的结构（哪些是成型的面子/搭子/对子，红中准备当什么用）。
3. 对比前 2-3 个候选打法，解释为什么推荐的更好（进张数量、牌型好坏如两面>嵌张/边张、红中利用率、是否可转七对等），不要只复述数字。
4. 若已听牌，说明听哪些牌；若红中较多，提示保留红中的价值，一般不要打红中。
用口语化中文，像主播讲牌一样，简洁有条理，200 字以内，不要用 markdown 符号。不要编造数据里没有的进张数。`;

  async function advise(handNames, dataText) {
    try {
      return await call({ max_tokens: 16000, output_config: { effort: 'medium' }, system: ADVISE_SYSTEM,
        messages: [{ role: 'user', content: `我的手牌（${handNames.length}张）：${handNames.join(' ')}\n\n${dataText}\n\n这手牌应该怎么打？` }] });
    } catch (e) {
      if (e.status !== 400) throw e; // 中转不认 output_config 时去掉重试
      return await call({ max_tokens: 4000, system: ADVISE_SYSTEM,
        messages: [{ role: 'user', content: `我的手牌（${handNames.length}张）：${handNames.join(' ')}\n\n${dataText}\n\n这手牌应该怎么打？` }] });
    }
  }

  async function test() { return call({ max_tokens: 50, messages: [{ role: 'user', content: '回复“连接成功”四个字' }] }); }

  root.AI = { getCfg, setCfg, recognize, advise, test };
})(this);
