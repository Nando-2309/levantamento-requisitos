const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

(async () => {
  const output = path.resolve('tmp/ui-check');
  fs.mkdirSync(output, { recursive: true });
  for (const name of fs.readdirSync(output)) {
    if (/^(entrevista|fluxograma)-grafica-.*\.(pdf|crdownload)$/.test(name)) fs.unlinkSync(path.join(output, name));
  }
  const tabs = await (await fetch('http://127.0.0.1:9236/json', { signal: AbortSignal.timeout(5000) })).json();
  const target = tabs.find(tab => tab.type === 'page' && tab.url === 'about:blank')
    || tabs.find(tab => tab.type === 'page' && tab.url.startsWith('http://127.0.0.1:5188/'));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const p = pending.get(message.id);
    if (!p) return;
    clearTimeout(p.timer); pending.delete(message.id);
    message.error ? p.reject(message.error) : p.resolve(message.result);
  };
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const number = ++id;
      const timer = setTimeout(() => { pending.delete(number); reject(new Error(`Timed out: ${method}`)); }, 20000);
      pending.set(number, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: number, method, params }));
    });
  }
  async function run(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(expression) {
    for (let i = 0; i < 40; i++) {
      if (await run(expression)) return;
      await pause(250);
    }
    throw new Error(`Condition not satisfied: ${expression}`);
  }
  async function reload() {
    const previousOrigin = await run('performance.timeOrigin');
    await call('Page.reload');
    await waitFor(`performance.timeOrigin !== ${previousOrigin}`);
  }
  async function viewport(width) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 800 });
    await pause(100);
    const dimensions = await run('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
    assert.ok(dimensions.scroll <= dimensions.width, `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
  }
  async function screenshot(name) {
    fs.writeFileSync(path.join(output, name), Buffer.from((await call('Page.captureScreenshot', { captureBeyondViewport: false })).data, 'base64'));
  }
  async function input(selector, value) {
    await run(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});const proto=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await pause(50);
  }
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] });
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
  await call('Page.navigate', { url: 'http://127.0.0.1:5188/' });
  await waitFor('Boolean(document.querySelector(".question-bank"))');
  await run('localStorage.removeItem("graficafluxo-session-v1")');
  await reload();
  await waitFor('Boolean(document.querySelector(".question-bank"))');
  for (const width of [320, 375, 390, 768, 1440]) await viewport(width);
  await screenshot('desktop.png');
  await viewport(375);
  await run('document.querySelector(".bank-actions .primary-button").click()');
  await waitFor('Boolean(document.querySelector(".question-form"))');
  for (const width of [320, 375]) await viewport(width);
  assert.equal(await run('document.querySelector(".question-form select")===null'), true);
  assert.ok(await run('parseFloat(getComputedStyle(document.querySelector(".question-form input")).fontSize)>=16'));
  await input('.question-form input', 'Acabamento');
  await input('.question-form textarea', 'A gráfica registra a revisão do acabamento?');
  await run('document.querySelector(".question-form").scrollIntoView({block:"center"})');
  await screenshot('mobile-question-form.png');
  await run('document.querySelector(".question-form").requestSubmit()');
  await waitFor('document.querySelectorAll(".custom-question-item").length===1');
  await reload();
  await waitFor('document.querySelector(".bank-heading p")?.textContent.includes("10 perguntas")');
  console.log('Cadastro e persistência: OK');
  for (let i = 0; i < 10; i++) {
    await run('document.querySelector(".yes-card").click()');
    await waitFor('Boolean(document.querySelector("#response-note"))');
    if (i === 9) {
      await input('#response-note', 'Observação da última pergunta: conferência pelo responsável.');
      await viewport(320); await viewport(375);
      await run('document.querySelector(".flow-card").scrollIntoView({block:"start"})');
      await screenshot('mobile-interview.png');
    }
    await run('document.querySelector(".step-actions .primary-button").click()');
    await pause(70);
  }
  await waitFor('Boolean(document.querySelector(".done-card"))');
  for (const width of [320, 375, 390, 768, 1440]) await viewport(width);
  assert.equal(await run('document.querySelectorAll(".summary-item").length'), 10);
  await viewport(375);
  await run('document.querySelector(".done-card").scrollIntoView({block:"start"})');
  await screenshot('mobile-completed.png');
  assert.equal(await run('document.querySelectorAll(".done-actions button").length'), 2);
  for (const [selector, prefix] of [['.done-actions .primary-button', 'entrevista-'], ['.done-actions .secondary-button', 'fluxograma-']]) {
    await run(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await waitFor('!document.querySelector("button[aria-busy=true]")');
    assert.equal(await run('Boolean(document.querySelector(".pdf-error"))'), false);
    for (let i = 0; i < 40 && !fs.readdirSync(output).some(file => file.startsWith(prefix) && file.endsWith('.pdf')); i++) await pause(250);
    const filename = fs.readdirSync(output).find(file => file.startsWith(prefix) && file.endsWith('.pdf'));
    assert.ok(filename, `Missing download: ${prefix}`);
    assert.equal(fs.readFileSync(path.join(output, filename)).subarray(0, 5).toString(), '%PDF-');
  }
  console.log('Entrevista com 10 perguntas, observação final e downloads: OK');
  await reload();
  await waitFor('Boolean(document.querySelector(".done-card"))');
  await run('document.querySelector(".bank-actions .primary-button").click()');
  await waitFor('Boolean(document.querySelector(".question-form"))');
  await input('.question-form input', 'Produção');
  await input('.question-form textarea', 'A gráfica registra as etapas de revisão?');
  await run('document.querySelector(".question-form").requestSubmit()');
  await waitFor('document.querySelector(".question-count")?.textContent.includes("11")');
  assert.equal(await run('document.querySelectorAll(".summary-item").length'), 10);
  console.log('Nova pergunta após conclusão preserva respostas: OK');
  await run('document.querySelector(".custom-question-item:last-child .icon-button:not(.danger-button)").click()');
  await waitFor('Boolean(document.querySelector(".question-form"))');
  await input('.question-form textarea', 'A gráfica registra a revisão final dos impressos?');
  await run('document.querySelector(".question-form").requestSubmit()');
  await waitFor('document.querySelector(".custom-question-item:last-child h3")?.textContent.includes("revisão final")');
  await run('window.confirm=()=>true;document.querySelector(".custom-question-item:last-child .danger-button").click()');
  await waitFor('document.querySelectorAll(".custom-question-item").length===1');
  assert.equal(await run('document.querySelector(".custom-question-item .icon-button").disabled'), true);
  assert.equal(await run('document.querySelectorAll(".summary-item").length'), 10);
  console.log('Edição, exclusão e proteção das respostas já registradas: OK');
  assert.deepEqual(errors, []);
  console.log('Sem rolagem horizontal: 320, 375, 390, 768 e 1440 px. Sem erros de execução.');
  await call('Browser.close');
  ws.close();
})().catch(error => { console.error(error); process.exit(1); });
