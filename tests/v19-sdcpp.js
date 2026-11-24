// v19: local stable-diffusion.cpp provider — direct browser connection, no proxy
// mock knobs: modelStatus (loaded state) · statusReply (override the status) · loadReply (fail the load) · loadStatus (state after a failed load) · catalog / catalogReply (recipe list) · refreshResult / refreshReply (rescan response) · reply (generation response) · loadDelay (slow load) · hits (recorded requests)
const { chromium } = require('playwright'); const path = require('path'), FX = path.join(__dirname, 'fixtures') + '/'; const fs = require('fs');
(async () => {
  const U = process.env.U || 'http://localhost:8787'; const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const R = [], errs = [];
  const PNG = fs.readFileSync(FX + 'mk1.png').toString('base64');
  let hits = [], reply = 'ok';
  const SD_CFG = { prov: 'sdcpp', base: 'http://127.0.0.1:1234/v1', key: '', model: 'sd-cpp-local', field: 'image[]', proto: 'edits', proxy: false };
  const RECIPES = [{ id: 'flux1-dev', name: 'FLUX.1 dev' }, { id: 'sdxl-base', name: 'SDXL Base' }];
  const READY = { state: 'ready', recipe: 'flux1-dev', models: { diffusion_model: 'diffusion_models/flux1-dev.gguf' }, error: null, revision: 1 };
  const CLI = { state: 'ready', origin: 'command_line', recipe: null, runtime_recipe: { id: '@command-line', name: 'Command line' }, models: { model: 'checkpoints/cli.gguf' }, error: null, revision: 1 };
  let catalog = { recipes: RECIPES, errors: [] }, modelStatus = READY, catalogReply = null, loadReply = null, loadDelay = 0, statusReply = null, loadStatus = null, refreshResult = {}, refreshReply = null;
  const handler = async route => {
    const req = route.request(), u = req.url(), H = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    hits.push({ url: u, method: req.method(), headers: req.headers(), body: req.postData() || '' });
    if (u.includes('/api/proxy')) return route.fulfill({ status: 403, headers: H, body: '{"error":{"message":"proxy should not be used"}}' });
    if (/\/sdcpp\/v1\/recipes$/.test(u)) return route.fulfill({ status: catalogReply ? catalogReply.status : 200, headers: H, body: catalogReply && catalogReply.body !== undefined ? catalogReply.body : JSON.stringify(catalog) });
    if (/\/sdcpp\/v1\/models\/status$/.test(u)) return route.fulfill({ status: 200, headers: H, body: JSON.stringify(statusReply || modelStatus) });
    if (/\/sdcpp\/v1\/models\/refresh$/.test(u)) return route.fulfill({ status: refreshReply ? refreshReply.status || 200 : 200, headers: H, body: refreshReply && refreshReply.body !== undefined ? refreshReply.body : JSON.stringify(refreshResult) });
    if (/\/sdcpp\/v1\/models\/load$/.test(u)) {
      if (loadDelay) await new Promise(r => setTimeout(r, loadDelay));
      if (loadReply) { if (loadStatus) modelStatus = loadStatus; return route.fulfill({ status: loadReply.status || 422, headers: H, body: loadReply.body !== undefined ? loadReply.body : JSON.stringify({ error: 'Failed to initialize the selected model', code: 'model_load_failed' }) }); }
      let lb = {}; try { lb = JSON.parse(req.postData() || '{}') } catch (e) {}
      modelStatus = { state: 'ready', recipe: lb.recipe, models: { diffusion_model: 'diffusion_models/' + lb.recipe + '.gguf' }, error: null, revision: (modelStatus.revision || 1) + 1 };
      return route.fulfill({ status: 200, headers: H, body: JSON.stringify(modelStatus) });
    }
    if (reply == 'down') return route.abort('failed');
    if (reply && reply.status) return route.fulfill({ status: reply.status, headers: Object.assign({}, H, reply.headers || {}), body: reply.body !== undefined ? reply.body : JSON.stringify({ error: { message: 'local sd.cpp error' } }) });
    return route.fulfill({ status: 200, headers: H, body: JSON.stringify(reply && reply.data !== undefined ? { created: 1, data: reply.data } : { created: 1, data: [{ b64_json: PNG }] }) }) };
  const initCfg = async (p, cfg) => p.addInitScript(cfg => { if (!sessionStorage.x) { sessionStorage.x = 1; if (cfg) localStorage.setItem('wbCfg', JSON.stringify(cfg)); localStorage.setItem('introX', '1') } }, cfg);
  async function setup(cfg, hash, https) {
    const c = await b.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.route(/127\.0\.0\.1:\d+|\/api\/proxy/, handler);
    if (https) await p.route(/^https:\/\/pw\.test\//, async route => {
      const u = new URL(route.request().url()), rel = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
      try { await route.fulfill({ path: path.join(__dirname, '..', 'dist', rel) }) } catch (e) { await route.fulfill({ status: 404, body: '' }) }
    });
    await initCfg(p, cfg);
    await p.goto(https ? 'https://pw.test/#studio' : U + (hash || '/#studio')); await p.waitForFunction(() => window.WB && window.APP, null, { timeout: 15000 });
    return { c, p } }
  const sel = async (p, tab) => { await p.evaluate(t => APP.setTab(t), tab); await p.waitForSelector('.card [data-a="sel"]', { timeout: 15000 }); await p.waitForTimeout(300); await p.click('.card [data-a="sel"]'); await p.waitForTimeout(300) };
  // 等真实状态（配方选项已渲染），不要等可能被占位文案满足的文本
  const waitCatalog = p => p.waitForFunction(() => document.querySelectorAll('#cfRecipe option').length > 0, null, { timeout: 8000 }).catch(() => {});

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

  // —— 配方发现：打开设置读取配方目录与当前已加载模型（浏览器 HTTP 边界）
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY;
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg');
    await waitCatalog(p);
    const reads = hits.filter(h => h.method == 'GET' && /\/sdcpp\/v1\//.test(h.url));
    R.push(['settings reads recipes and status', reads.some(h => /\/sdcpp\/v1\/recipes$/.test(h.url)) && reads.some(h => /\/sdcpp\/v1\/models\/status$/.test(h.url)), hits.map(h => h.method + ' ' + h.url).join(' | ')]);
    const opts = await p.$$eval('#cfRecipe option', es => es.map(e => ({ value: e.value, text: e.textContent, disabled: e.disabled }))).catch(() => []);
    R.push(['recipes are named selectable options', opts.length === RECIPES.length && opts.every((o, i) => o.text === RECIPES[i].name && o.value === RECIPES[i].id && !o.disabled && !/gguf|\.safetensors/.test(o.text)), JSON.stringify(opts)]);
    const loadedText = await p.$eval('#cfLoaded', e => e.textContent).catch(() => ''), picked = await p.$eval('#cfRecipe', e => e.value).catch(() => '');
    R.push(['loaded recipe displayed', /FLUX\.1 dev/.test(loadedText) && picked === 'flux1-dev', loadedText + ' / ' + picked]);
    const n0 = hits.filter(h => /\/sdcpp\/v1\//.test(h.url)).length; await p.waitForTimeout(900);
    R.push(['no automatic polling', hits.filter(h => /\/sdcpp\/v1\//.test(h.url)).length === n0, 'reads ' + n0]);
    await c.close() }

  // —— 命令行预加载：没有命名配方时也要表明服务器实际在用什么
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = CLI;
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg');
    await waitCatalog(p);
    const text = await p.$eval('#cfLoaded', e => e.textContent).catch(() => ''), picked = await p.$eval('#cfRecipe', e => e.value).catch(() => '');
    R.push(['command-line model shown distinctly', /命令行/.test(text) && picked === '@command-line', text + ' / ' + picked]);
    const cliOpts = await p.$$eval('#cfRecipe option', es => es.filter(e => e.value === '@command-line').map(e => ({ text: e.textContent, disabled: e.disabled }))).catch(() => []);
    R.push(['command-line entry is not a loadable recipe', cliOpts.length === 1 && cliOpts[0].disabled, JSON.stringify(cliOpts)]);
    await c.close() }

  // —— 目录读取失败：报告为读取模型信息失败，而不是生图失败
  { catalogReply = { status: 500, body: JSON.stringify({ error: { message: 'catalog db corrupt' } }) }; modelStatus = READY;
    const { c, p } = await setup(SD_CFG);
    await p.click('#wbCfg');
    await p.waitForFunction(() => { const e = document.querySelector('#cfMsg'); return e && /读取本地模型/.test(e.textContent) }, null, { timeout: 5000 }).catch(() => {});
    const text = await p.$eval('#cfMsg', e => e.textContent).catch(() => '');
    R.push(['catalog read failure is not a generation failure', /读取本地模型/.test(text) && !/生图失败/.test(text), text]);
    catalogReply = null; await c.close() }

  // —— 显式刷新：先让服务端重扫配方与模型文件，再读目录与状态（#8）
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY; refreshResult = {}; refreshReply = null;
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg');
    await waitCatalog(p);
    const before = hits.filter(h => /\/sdcpp\/v1\//.test(h.url)).length;
    catalog = { recipes: RECIPES.concat([{ id: 'sd35', name: 'SD 3.5 Large' }]), errors: [] };
    await p.click('#cfRecipeRefresh', { timeout: 2000 }).catch(() => {});
    await p.waitForFunction(() => [...document.querySelectorAll('#cfRecipe option')].some(o => o.value === 'sd35'), null, { timeout: 5000 }).catch(() => {});
    const fresh = hits.slice(before).filter(h => /\/sdcpp\/v1\//.test(h.url));
    const paths = fresh.map(h => h.method + ' ' + new URL(h.url).pathname);
    R.push(['refresh rescans before reading catalog and status', paths.length >= 3 && /^POST \/sdcpp\/v1\/models\/refresh$/.test(paths[0]) && paths.slice(1).includes('GET /sdcpp/v1/recipes') && paths.slice(1).includes('GET /sdcpp/v1/models/status'), paths.join(' | ')]);
    R.push(['refresh updates the recipe list', (await p.$$eval('#cfRecipe option', es => es.length).catch(() => 0)) === 3, '']);
    R.push(['refresh keeps the server-reported loaded model', /FLUX\.1 dev/.test(await p.$eval('#cfLoaded', e => e.textContent).catch(() => '')), await p.$eval('#cfLoaded', e => e.textContent).catch(() => '')]);
    await p.selectOption('#cfRecipe', 'sd35');
    await p.click('#cfRecipeLoad', { timeout: 2000 }).catch(() => {});
    await p.waitForFunction(() => /当前已加载：SD 3\.5 Large/.test(document.querySelector('#cfLoaded').textContent), null, { timeout: 5000 }).catch(() => {});
    const loads = hits.filter(h => /\/sdcpp\/v1\/models\/load$/.test(h.url)); let lb = null; try { lb = JSON.parse(loads[0].body) } catch (e) {}
    R.push(['rescanned recipe can be selected and loaded', loads.length === 1 && !!lb && lb.recipe === 'sd35' && /当前已加载：SD 3\.5 Large/.test(await p.$eval('#cfLoaded', e => e.textContent).catch(() => '')), hits.map(h => h.method + ' ' + h.url).join(' | ')]);
    await c.close() }

  // —— 重扫发现无效配方：提示具体条目，不静默丢弃（#8）
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY; refreshReply = null;
    refreshResult = { errors: [{ file: 'recipes/broken.yaml', message: 'invalid slots' }, { file: 'models/missing.gguf', message: 'file not found' }, { file: 'recipes/old.yaml', message: 'unknown slot' }, { file: 'models/typo.gguf', message: 'bad path' }] };
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg'); await waitCatalog(p);
    await p.click('#cfRecipeRefresh', { timeout: 2000 }).catch(() => {});
    await p.waitForFunction(() => /无效配方/.test(document.querySelector('#cfMsg').textContent), null, { timeout: 5000 }).catch(() => {});
    const text = await p.$eval('#cfMsg', e => e.textContent).catch(() => '');
    const cls = await p.$eval('#cfMsg', e => e.className).catch(() => '');
    R.push(['rescan reports invalid recipe entries', /无效配方/.test(text) && /broken\.yaml/.test(text) && /invalid slots/.test(text) && /missing\.gguf/.test(text), text]);
    R.push(['no invalid entry is dropped', /old\.yaml/.test(text) && /typo\.gguf/.test(text) && /bad path/.test(text), text]);
    R.push(['invalid entries are shown as a problem', /\bbad\b/.test(cls), cls]);
    refreshResult = {}; await c.close() }

  // —— 重扫失败：按重扫作用域报错，不误报为加载或生图失败（#8）
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY; refreshResult = {};
    refreshReply = { status: 500, body: JSON.stringify({ error: 'rescan crashed' }) };
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg'); await waitCatalog(p);
    await p.click('#cfRecipeRefresh', { timeout: 2000 }).catch(() => {});
    await p.waitForFunction(() => /失败/.test(document.querySelector('#cfMsg').textContent), null, { timeout: 5000 }).catch(() => {});
    const text = await p.$eval('#cfMsg', e => e.textContent).catch(() => '');
    R.push(['rescan failure names the rescan', /重扫/.test(text) && /rescan crashed/.test(text) && !/加载失败|生图失败/.test(text), text]);
    refreshReply = null; await c.close() }

  // —— 显式确认加载配方：改下拉只改待选状态，确认才发一次加载请求
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY; loadDelay = 800;
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg');
    await waitCatalog(p);
    await p.selectOption('#cfRecipe', 'sdxl-base');
    await p.waitForTimeout(300);
    R.push(['selection change sends no load request', !hits.some(h => /\/sdcpp\/v1\/models\/load/.test(h.url)), hits.map(h => h.method + ' ' + h.url).join(' | ')]);
    const pend = await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '');
    R.push(['pending selection is visible', /待加载/.test(pend) && /SDXL Base/.test(pend), pend]);
    const before = await p.$eval('#cfLoaded', e => e.textContent).catch(() => '');
    R.push(['loaded model unchanged before confirm', /FLUX\.1 dev/.test(before), before]);
    await p.click('#cfRecipeLoad', { timeout: 2000 }).catch(() => {});
    await p.waitForFunction(() => { const e = document.querySelector('#cfRecipePending'); return e && /正在加载/.test(e.textContent) }, null, { timeout: 3000 }).catch(() => {});
    const during = await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '');
    R.push(['pending state visible while loading', /正在加载/.test(during), during]);
    await p.waitForFunction(() => { const e = document.querySelector('#cfLoaded'); return e && /SDXL Base/.test(e.textContent) }, null, { timeout: 8000 }).catch(() => {});
    const loads = hits.filter(h => /\/sdcpp\/v1\/models\/load$/.test(h.url));
    R.push(['confirm sends exactly one load request', loads.length === 1, hits.map(h => h.method + ' ' + h.url).join(' | ')]);
    let body = null; try { body = JSON.parse(loads[0].body) } catch (e) {}
    R.push(['load uses the recipe default components', !!body && body.recipe === 'sdxl-base' && !('models' in body), JSON.stringify(body)]);
    R.push(['load goes straight to the local server', loads.length === 1 && loads[0].method == 'POST' && !/api\/proxy/.test(loads[0].url) && !loads[0].headers.authorization, loads[0] ? loads[0].url : '']);
    const active = await p.$eval('#cfLoaded', e => e.textContent).catch(() => '');
    R.push(['loaded recipe becomes the loaded model', /当前已加载：SDXL Base/.test(active), active]);
    const label = await p.$eval('#wbProv', e => e.textContent).catch(() => '');
    R.push(['studio shows the loaded local model', /SDXL Base/.test(label), label]);
    R.push(['no pending state left after load', !(await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '')).trim(), await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '')]);
    loadDelay = 0; await c.close() }

  // —— 加载失败：显示失败原因与错误码，且不谎称新配方已生效
  await failLoadCase('failed load keeps the previous model', {
    reply: { status: 422, body: JSON.stringify({ error: 'Failed to initialize the selected model', code: 'model_load_failed' }) },
    why: 'model_load_failed', whyRe: /model_load_failed[\s\S]*Failed to initialize/,
    expectValue: 'flux1-dev', expectLoaded: /当前已加载：FLUX\.1 dev/, notLoaded: /SDXL Base/ });

  // —— 加载失败后的状态校正：显示原因 + 选择器回到服务器实际在用的配方（#7）
  async function failLoadCase(name, o) {
    catalog = { recipes: RECIPES, errors: [] }; modelStatus = o.before || READY; statusReply = null;
    loadReply = o.reply; loadStatus = o.after || null;
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg');
    await waitCatalog(p);
    await p.selectOption('#cfRecipe', 'sdxl-base');
    await p.click('#cfRecipeLoad', { timeout: 2000 }).catch(() => {});
    await p.waitForFunction(t => { const e = document.querySelector('#cfMsg'); return e && t && e.textContent.includes(t) }, o.why, { timeout: 5000 }).catch(() => {});
    const why = await p.$eval('#cfMsg', e => e.textContent).catch(() => '');
    R.push([name + ' · reason is visible', o.whyRe.test(why), why]);
    // 等服务器状态被重新读取并校正到期望值，而不是读到校正前的中间态
    await p.waitForFunction(v => { const s = document.querySelector('#cfRecipe'); return s && s.value === v }, o.expectValue, { timeout: 5000 }).catch(() => {});
    const picked = await p.$eval('#cfRecipe', e => e.value).catch(() => '');
    const active = await p.$eval('#cfLoaded', e => e.textContent).catch(() => '');
    R.push([name + ' · selector is back to the model in effect', picked === o.expectValue && o.expectLoaded.test(active), picked + ' / ' + active]);
    if (o.notLoaded) R.push([name + ' · the failed recipe is not shown as loaded', !o.notLoaded.test(active), active]);
    await p.waitForFunction(() => { const e = document.querySelector('#cfRecipePending'); return e && !e.textContent.trim() }, null, { timeout: 5000 }).catch(() => {});
    const pend = await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '');
    R.push([name + ' · no stale pending selection', !pend.trim(), pend]);
    const reads = hits.filter(h => /\/sdcpp\/v1\/models\/status$/.test(h.url)).length;
    R.push([name + ' · server status is read again after the failure', reads >= 2, 'status reads ' + reads]);
    R.push([name + ' · only the status is re-read, not the catalog', hits.filter(h => /\/sdcpp\/v1\/recipes$/.test(h.url)).length === 1, hits.map(h => h.url).join(' | ')]);
    R.push([name + ' · exactly one load request', hits.filter(h => /\/sdcpp\/v1\/models\/load$/.test(h.url)).length === 1, hits.map(h => h.method + ' ' + h.url).join(' | ')]);
    loadReply = null; loadStatus = null; await c.close() }
  await failLoadCase('invalid config load failure', {
    reply: { status: 400, body: JSON.stringify({ error: 'recipe sdxl-base has no usable model file', code: 'invalid_model_config' }) },
    why: 'invalid_model_config', whyRe: /配方配置无效/,
    expectValue: 'flux1-dev', expectLoaded: /当前已加载：FLUX\.1 dev/ });
  await failLoadCase('busy server load failure', {
    reply: { status: 409, body: JSON.stringify({ error: 'a generation job is still running', code: 'model_busy' }) },
    why: 'model_busy', whyRe: /本地模型正忙/,
    expectValue: 'flux1-dev', expectLoaded: /当前已加载：FLUX\.1 dev/ });
  await failLoadCase('load failure that leaves no model', {
    reply: { status: 422, body: JSON.stringify({ error: 'Failed to initialize the selected model', code: 'model_load_failed' }) },
    after: { state: 'error', recipe: null, models: {}, error: 'Failed to initialize the selected model', revision: 2 },
    why: 'model_load_failed', whyRe: /本地模型加载失败/,
    expectValue: '', expectLoaded: /加载失败/ });
  await failLoadCase('load failure with a command-line model', {
    before: CLI, after: CLI,
    reply: { status: 422, body: JSON.stringify({ error: 'Failed to initialize the selected model', code: 'model_load_failed' }) },
    why: 'model_load_failed', whyRe: /本地模型加载失败/,
    expectValue: '@command-line', expectLoaded: /命令行/ });

  // —— 待加载的选择与生效中的配方分开显示，并且可以取消
  { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY; loadReply = null; loadStatus = null;
    const { c, p } = await setup(SD_CFG); hits = [];
    await p.click('#wbCfg');
    await waitCatalog(p);
    await p.selectOption('#cfRecipe', 'sdxl-base');
    await p.waitForTimeout(300);
    const picked = await p.$eval('#cfRecipe', e => e.value).catch(() => '');
    const pend = await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '');
    R.push(['selector keeps showing the model in effect', picked === 'flux1-dev', picked]);
    R.push(['pending pick is shown next to it', /待加载/.test(pend) && /SDXL Base/.test(pend), pend]);
    await p.click('[data-sd-cancel]', { timeout: 2000 }).catch(() => {});
    const pend2 = await p.$eval('#cfRecipePending', e => e.textContent).catch(() => '');
    const off = await p.$eval('#cfRecipeLoad', e => e.disabled).catch(() => true);
    R.push(['pending pick can be cancelled', !pend2.trim() && off === true, pend2]);
    R.push(['cancelling sends no load request', !hits.some(h => /\/sdcpp\/v1\/models\/load/.test(h.url)), hits.map(h => h.url).join(' | ')]);
    await c.close() }

  // —— 生图遇到「模型加载中」：提示清楚，且不留下过期选择（#7）
  await failCase('generation reports a model-loading response clearly', { status: 503, body: JSON.stringify({ error: 'model is loading', code: 'model_loading' }) }, /尚未就绪[\s\S]*model_loading/, {
    before: async p => { catalog = { recipes: RECIPES, errors: [] }; modelStatus = READY; statusReply = null; loadReply = null; loadStatus = null; await p.click('#wbCfg'); await waitCatalog(p); await p.click('#cfgX'); statusReply = { state: 'error', recipe: null, models: {}, error: 'model load failed', revision: 3 }; },
    check: async (p, text) => {
      await p.waitForFunction(() => { const s = document.querySelector('#cfRecipe'); return s && s.value === '' }, null, { timeout: 5000 }).catch(() => {});
      const picked = await p.$eval('#cfRecipe', e => e.value).catch(() => '');
      const active = await p.$eval('#cfLoaded', e => e.textContent).catch(() => '');
      R.push(['no stale selection after a model-state failure', picked === '' && !/FLUX\.1 dev/.test(active), picked + ' / ' + active]);
      statusReply = null; reply = 'ok';
    } });

  // —— 有参考图：multipart 直连本地 edits，image[] 多图，无代理头，结果入档
  { const cfg = SD_CFG;
    const { c, p } = await setup(cfg, '/#costume'); hits = []; reply = 'ok';
    await sel(p, 'costume'); await sel(p, 'pose');
    await p.click('#tgGo');
    await p.waitForFunction(() => document.querySelectorAll('#tgRes [data-tg]').length >= 1, null, { timeout: 20000 }).catch(() => {});
    R.push(['result shown', await p.$$eval('#tgRes [data-tg]', es => es.length) >= 1, await p.$eval('#tgStat', e => e.textContent)]);
    const hn = await p.evaluate(async () => (await WB.db.hist()).length);
    R.push(['saved to history', hn >= 1, 'records ' + hn]);
    const gen = hits.filter(h => /images\/edits/.test(h.url));
    R.push(['edits endpoint direct', gen.length >= 1, hits.map(h => h.url).join(' | ')]);
    R.push(['no proxy used', hits.every(h => !/api\/proxy/.test(h.url)) && gen.every(h => !h.headers['x-target-url']), '']);
    R.push(['no auth headers', gen.every(h => !h.headers.authorization && !h.headers['x-goog-api-key']), '']);
    const sentRef = await p.evaluate(() => WB._W.lastSent || '');
    R.push(['all references in standard field', gen.length === 1 && (gen[0].body.match(/name="image\[\]"/g) || []).length === 2 && !/name="image"/.test(gen[0].body), gen[0] ? gen[0].body.slice(0, 200) : '']);
    R.push(['prompt unchanged in multipart', !!sentRef && gen[0].body.replace(/\r\n/g, '\n').includes(sentRef), sentRef.slice(0, 120)]);
    R.push(['no status preflight', !hits.some(h => /\/sdcpp\/v1\//.test(h.url)), hits.map(h => h.url).join(' | ')]);
    await c.close() }

  // —— 无参考图：仅提示词走本地 generations JSON，结果展示并入档，不调用 edits
  { const cfg = SD_CFG;
    const { c, p } = await setup(cfg, '/#studio');
    await p.evaluate(() => { localStorage.setItem('wbMode', JSON.stringify('gen')); localStorage.setItem('wbSel', JSON.stringify({ g: [], p: [], e: [] })) });
    await p.reload(); await p.waitForFunction(() => window.WB && window.APP, null, { timeout: 15000 });
    hits = []; reply = 'ok';
    const promptText = 'an adult model in a red coat, studio light';
    R.push(['no references selected', await p.evaluate(() => ![].concat(WB._W.persons, WB._W.garments, WB._W.poses, WB._W.exprs).length), '']);
    await p.click('.adv summary'); await p.fill('#wbPrompt', promptText); await p.selectOption('#wbAR', '9:16'); await p.selectOption('#wbN', '2');
    await p.click('#wbGo', { timeout: 4000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelectorAll('#wbRes [data-ri]').length >= 2, null, { timeout: 20000 }).catch(() => {});
    R.push(['results shown in studio', await p.$$eval('#wbRes [data-ri]', es => es.length) >= 2 && await p.$eval('#wbAfter', e => !!e.getAttribute('src')), '']);
    const hn2 = await p.evaluate(async () => (await WB.db.hist()).length);
    R.push(['saved to history', hn2 >= 2, 'records ' + hn2]);
    const gen2 = hits.filter(h => /images\/generations/.test(h.url)), edits2 = hits.filter(h => /images\/edits/.test(h.url));
    R.push(['generations endpoint direct', gen2.length === 2 && gen2.every(h => h.method == 'POST' && !h.headers['x-target-url']), hits.map(h => h.url).join(' | ')]);
    R.push(['edits endpoint not called', edits2.length === 0 && hits.every(h => !/api\/proxy/.test(h.url)), hits.map(h => h.url).join(' | ')]);
    let body = null, bodies = []; try { bodies = gen2.map(h => JSON.parse(h.body)); body = bodies[0] } catch (e) {}
    const sent = await p.evaluate(() => WB._W.lastSent || '');
    R.push(['JSON request shape', !!body && gen2.every(h => /application\/json/.test((h.headers['content-type'] || ''))) && bodies.every(b => b.n === 1 && b.prompt === sent) && body.model === 'sd-cpp-local' && body.size === '1024x1536' && !('image' in body) && body.prompt.includes(promptText), JSON.stringify(body)]);
    R.push(['each requested image produced', gen2.length === 2 && bodies.length === 2 && hn2 >= 2, 'requests ' + gen2.length + ' / records ' + hn2]);
    await c.close() }

  // —— 导入配置不能改写 sdcpp 的固定本地模型 ID
  { const cfg = Object.assign({}, SD_CFG, { model: 'imported-evil-model' });
    const { c, p } = await setup(cfg, '/#studio');
    await p.evaluate(() => { localStorage.setItem('wbMode', JSON.stringify('gen')); localStorage.setItem('wbSel', JSON.stringify({ g: [], p: [], e: [] })) });
    await p.reload(); await p.waitForFunction(() => window.WB && window.APP, null, { timeout: 15000 });
    hits = []; reply = 'ok';
    await p.click('.adv summary'); await p.fill('#wbPrompt', 'model id check'); await p.click('#wbGo');
    await p.waitForFunction(() => document.querySelectorAll('#wbRes [data-ri]').length >= 1, null, { timeout: 20000 }).catch(() => {});
    const b = hits.find(h => /images\/generations/.test(h.url)); let body = null; try { body = JSON.parse(b.body) } catch (e) {}
    R.push(['imported model cannot override local id', !!body && body.model === 'sd-cpp-local', JSON.stringify(body)]);
    await c.close() }

  // —— 本地生图失败：HTTP 边界模拟每种响应，断言用户可见的提示
  async function failCase(name, simulate, expected, opts = {}) {
    const { c, p } = await setup(opts.cfg || SD_CFG, '/#studio', opts.https);
    await p.evaluate(() => { localStorage.setItem('wbMode', JSON.stringify('gen')); localStorage.setItem('wbSel', JSON.stringify({ g: [], p: [], e: [] })) });
    await p.reload(); await p.waitForFunction(() => window.WB && window.APP, null, { timeout: 15000 });
    hits = []; reply = simulate;
    if (opts.before) await opts.before(p);
    await p.click('.adv summary'); await p.fill('#wbPrompt', 'an adult model in a red coat, studio light');
    await p.click('#wbGo', { timeout: 4000 }).catch(() => {});
    await p.waitForFunction(() => { const e = document.querySelector('#wbErr'); return e && !e.hidden && e.textContent.trim() }, null, { timeout: 20000 }).catch(() => {});
    const text = await p.$eval('#wbErr', e => e.textContent);
    R.push([name, expected.test(text), text.slice(0, 300)]);
    if (opts.noResult) R.push([name + ' · no result shown', await p.$$eval('#wbRes [data-ri]', es => es.length) === 0, '']);
    if (opts.check) await opts.check(p, text);
    await c.close() }
  async function refFailCase(name, simulate, expected, checkHits) {
    const { c, p } = await setup(SD_CFG, '/#costume');
    await sel(p, 'costume'); await sel(p, 'pose');
    hits = []; reply = simulate;
    await p.click('#tgGo');
    await p.waitForFunction(() => { const e = document.querySelector('#tgStat'); return e && /生成失败/.test(e.textContent) }, null, { timeout: 20000 }).catch(() => {});
    const text = await p.$eval('#tgStat', e => e.textContent).catch(() => '');
    R.push([name, expected.test(text), text.slice(0, 300)]);
    if (checkHits) R.push([name + ' · request boundary', checkHits(hits), hits.map(h => h.method + ' ' + h.url).join(' | ')]);
    await c.close() }
  await refFailCase('edits failure never falls back', { status: 400, body: JSON.stringify({ error: { message: 'unsupported image field' } }) }, /生成失败/,
    hs => hs.filter(h => /images\/edits/.test(h.url)).length === 1 && !hs.some(h => /images\/generations/.test(h.url)) && !hs.some(h => /name="image"/.test(h.body)));
  await refFailCase('url-only response is not accepted', { data: [{ url: 'http://127.0.0.1:1234/only.png' }] }, /没有图片数据/,
    hs => !hs.some(h => /api\/proxy|only\.png|images\/generations/.test(h.url)));
  await failCase('down server explains local address', 'down', /无法连接到本地 sd\.cpp 服务器[\s\S]*127\.0\.0\.1:1234/);
  await failCase('custom port shown in failure', 'down', /127\.0\.0\.1:5678/, { cfg: Object.assign({}, SD_CFG, { base: 'http://127.0.0.1:5678/v1' }) });
  await failCase('HTTPS mixed content explained', 'down', /HTTPS[\s\S]*混合内容|混合内容[\s\S]*HTTPS/, { https: true });
  await failCase('503 model not ready', { status: 503, body: JSON.stringify({ error: { message: 'model is loading' } }) }, /模型[\s\S]*尚未就绪/);
  await failCase('429 local queue full', { status: 429 }, /队列[\s\S]*稍后/);
  await failCase('5xx surfaces server message', { status: 500, body: JSON.stringify({ error: { message: 'cuda out of memory' } }) }, /本地[\s\S]*cuda out of memory/);
  await failCase('plain-text 5xx surfaces server message', { status: 500, body: 'disk full', headers: { 'content-type': 'text/plain' } }, /本地[\s\S]*disk full/);
  await failCase('empty image data is a failure', { data: [] }, /生图失败[\s\S]*没有图片数据/, { noResult: true });
  await failCase('image entry without data is a failure', { data: [{}] }, /生图失败[\s\S]*没有图片数据/, { noResult: true });

  R.push(['no pageerror', !errs.length, errs.slice(0, 3).join(' | ')]);
  let f = 0; for (const [n, ok, d] of R) { console.log((ok ? 'PASS' : 'FAIL') + ' ' + n + (ok ? '' : ' :: ' + d)); if (!ok) f++ }
  console.log(`v19: ${R.length - f}/${R.length} passed`); await b.close(); process.exit(f ? 1 : 0);
})();
