// v19: local stable-diffusion.cpp provider — direct browser connection, no proxy
const { chromium } = require('playwright'); const path = require('path'), FX = path.join(__dirname, 'fixtures') + '/'; const fs = require('fs');
(async () => {
  const U = process.env.U || 'http://localhost:8787'; const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const R = [], errs = [];
  const PNG = fs.readFileSync(FX + 'mk1.png').toString('base64');
  let hits = [], mode = 'ok';
  const handler = async route => {
    const req = route.request(), u = req.url(), H = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    hits.push({ url: u, method: req.method(), headers: req.headers(), body: req.postData() || '' });
    if (u.includes('/api/proxy')) return route.fulfill({ status: 403, headers: H, body: '{"error":{"message":"proxy should not be used"}}' });
    if (mode == 'down') return route.abort('failed');
    return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ created: 1, data: [{ b64_json: PNG }] }) }) };
  async function setup(cfg, hash) {
    const c = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.route(/127\.0\.0\.1:1234|\/api\/proxy/, handler);
    await p.addInitScript(cfg => { if (!sessionStorage.x) { sessionStorage.x = 1; if (cfg) localStorage.setItem('wbCfg', JSON.stringify(cfg)); localStorage.setItem('introX', '1') } }, cfg);
    await p.goto(U + (hash || '/#studio')); await p.waitForFunction(() => window.WB && window.APP, null, { timeout: 15000 });
    return { c, p } }
  const sel = async (p, tab) => { await p.evaluate(t => APP.setTab(t), tab); await p.waitForSelector('.card [data-a="sel"]', { timeout: 15000 }); await p.waitForTimeout(300); await p.click('.card [data-a="sel"]'); await p.waitForTimeout(300) };

  // —— 配置面板：sdcpp 是可选服务商，默认本地地址，隐藏密钥，禁用代理
  { const { c, p } = await setup(null);
    await p.click('#wbCfg');
    const has = await p.$('input[name="prov"][value="sdcpp"]');
    R.push(['sdcpp provider offered', !!has, '']);
    if (has) {
      await p.check('input[name="prov"][value="sdcpp"]');
      R.push(['base prefilled local', /127\.0\.0\.1:1234/.test(await p.$eval('#cfBase', e => e.value)), await p.$eval('#cfBase', e => e.value)]);
      R.push(['key hidden', await p.$eval('#cfKey', e => { const l = e.closest('label'); return !l || l.hidden || getComputedStyle(l).display == 'none' }), '']);
      R.push(['proxy off and locked', await p.$eval('#cfProxy', e => !e.checked && e.disabled), '']);
      await p.fill('#cfBase', 'http://127.0.0.1:1234/v1');
      await p.click('#cfTest'); await p.waitForTimeout(400);
      R.push(['test connection without key', !/请先填写 API Key/.test(await p.$eval('#cfMsg', e => e.textContent)), await p.$eval('#cfMsg', e => e.textContent)]);
    }
    await c.close() }

  // —— 有参考图：multipart 直连本地 edits，image[] 多图，无代理头，结果入档
  { const cfg = { prov: 'sdcpp', base: 'http://127.0.0.1:1234/v1', key: '', model: 'sd-cpp-local', field: 'image[]', proto: 'edits', proxy: false };
    const { c, p } = await setup(cfg, '/#costume'); hits = []; mode = 'ok';
    await sel(p, 'costume'); await sel(p, 'pose');
    await p.click('#tgGo');
    await p.waitForFunction(() => document.querySelectorAll('#tgRes [data-tg]').length >= 1, null, { timeout: 20000 }).catch(() => {});
    R.push(['result shown', await p.$$eval('#tgRes [data-tg]', es => es.length) >= 1, await p.$eval('#tgStat', e => e.textContent)]);
    const hn = await p.evaluate(async () => (await WB.db.hist()).length);
    R.push(['saved to history', hn >= 1, 'records ' + hn]);
    const gen = hits.filter(h => /images\/edits/.test(h.url));
    R.push(['edits endpoint direct', gen.length >= 1, hits.map(h => h.url).join(' | ')]);
    R.push(['no proxy used', hits.every(h => !/api\/proxy/.test(h.url)) && gen.every(h => !h.headers['x-target-url']), '']);
    R.push(['multipart multi-image', gen.some(h => /name="image\[\]"/.test(h.body) && (h.body.match(/name="image\[\]"/g) || []).length >= 2), gen[0] ? gen[0].body.slice(0, 200) : '']);
    await c.close() }

  // —— 无参考图：仅提示词走本地 generations JSON，结果展示并入档，不调用 edits
  { const cfg = { prov: 'sdcpp', base: 'http://127.0.0.1:1234/v1', key: '', model: 'sd-cpp-local', field: 'image[]', proto: 'edits', proxy: false };
    const { c, p } = await setup(cfg, '/#studio');
    await p.evaluate(() => { localStorage.setItem('wbMode', JSON.stringify('gen')); localStorage.setItem('wbSel', JSON.stringify({ g: [], p: [], e: [] })) });
    await p.reload(); await p.waitForFunction(() => window.WB && window.APP, null, { timeout: 15000 });
    hits = []; mode = 'ok';
    const promptText = 'an adult model in a red coat, studio light';
    R.push(['no references selected', await p.evaluate(() => ![].concat(WB._W.persons, WB._W.garments, WB._W.poses, WB._W.exprs).length), '']);
    await p.click('.adv summary'); await p.fill('#wbPrompt', promptText); await p.selectOption('#wbAR', '9:16');
    await p.click('#wbGo', { timeout: 4000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector('#wbOutAct') && !document.querySelector('#wbOutAct').hidden, null, { timeout: 20000 }).catch(() => {});
    R.push(['result shown in studio', await p.$eval('#wbOutAct', e => !e.hidden) && await p.$eval('#wbAfter', e => !!e.getAttribute('src')), '']);
    const hn2 = await p.evaluate(async () => (await WB.db.hist()).length);
    R.push(['saved to history', hn2 >= 1, 'records ' + hn2]);
    const gen2 = hits.filter(h => /images\/generations/.test(h.url)), edits2 = hits.filter(h => /images\/edits/.test(h.url));
    R.push(['generations endpoint direct', gen2.length >= 1 && gen2.every(h => !h.headers['x-target-url']), hits.map(h => h.url).join(' | ')]);
    R.push(['edits endpoint not called', edits2.length === 0 && hits.every(h => !/api\/proxy/.test(h.url)), hits.map(h => h.url).join(' | ')]);
    let body = null; try { body = JSON.parse(gen2[0] && gen2[0].body) } catch (e) {}
    const sent = await p.evaluate(() => WB._W.lastSent || '');
    R.push(['JSON request shape', !!body && body.model === 'sd-cpp-local' && body.n === 1 && body.size === '1024x1536' && !('image' in body) && body.prompt === sent && body.prompt.includes(promptText), JSON.stringify(body)]);
    await c.close() }

  R.push(['no pageerror', !errs.length, errs.slice(0, 3).join(' | ')]);
  let f = 0; for (const [n, ok, d] of R) { console.log((ok ? 'PASS' : 'FAIL') + ' ' + n + (ok ? '' : ' :: ' + d)); if (!ok) f++ }
  console.log(`v19: ${R.length - f}/${R.length} passed`); await b.close(); process.exit(f ? 1 : 0);
})();
