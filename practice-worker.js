// 后台出题线程：避免出题计算卡住手机界面
importScripts('mahjong.js', 'practice.js');
onmessage = e => {
  const { id, level, theme } = e.data;
  let q = Practice.generate(level, theme, 1200), relaxed = false;
  if (!q) { q = Practice.generate(level, 'mix', 1200); relaxed = true; }
  postMessage({ id, q, relaxed });
};
