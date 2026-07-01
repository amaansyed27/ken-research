const state = {
  messages: [],
  lastSources: [],
  lastTrace: [],
  lastLogs: null,
};

const el = {
  form: document.querySelector('#chatForm'),
  prompt: document.querySelector('#prompt'),
  messages: document.querySelector('#messages'),
  mode: document.querySelector('#mode'),
  modelChoice: document.querySelector('#modelChoice'),
  sendBtn: document.querySelector('#sendBtn'),
  compareBtn: document.querySelector('#compareBtn'),
  clearBtn: document.querySelector('#clearBtn'),
  trace: document.querySelector('#trace'),
  sources: document.querySelector('#sources'),
  logs: document.querySelector('#logs'),
  configPanel: document.querySelector('#configPanel'),
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMs(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  const ms = Number(value);
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderMarkdown(md = '') {
  let html = escapeHtml(md);

  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const lines = html.split('\n');
  let inList = false;
  html = lines.map((line) => {
    if (/^-\s+/.test(line)) {
      const item = line.replace(/^-\s+/, '');
      const prefix = inList ? '' : '<ul>';
      inList = true;
      return `${prefix}<li>${item}</li>`;
    }
    if (inList) {
      inList = false;
      return `</ul>${line ? `<p>${line}</p>` : ''}`;
    }
    if (!line.trim()) return '';
    if (/^<h\d|^<pre|^<ul|^<\/ul/.test(line)) return line;
    return `<p>${line}</p>`;
  }).join('\n');
  if (inList) html += '</ul>';
  return html;
}

function addMessage(role, content, meta = '') {
  state.messages.push({ role, content, meta });
  renderMessages();
}

function renderMessages() {
  if (!state.messages.length) {
    el.messages.innerHTML = `<div class="message"><div class="meta">Ready</div><div class="markdown"><p>Ask a question, choose a mode, and test baseline versus KenProbe.</p></div></div>`;
    return;
  }
  el.messages.innerHTML = state.messages.map((message) => {
    if (message.role === 'compare') return renderCompare(message.content);
    return `
      <article class="message ${message.role === 'user' ? 'user' : ''} ${message.role === 'error' ? 'error' : ''}">
        ${message.meta ? `<div class="meta">${escapeHtml(message.meta)}</div>` : ''}
        <div class="markdown">${renderMarkdown(message.content)}</div>
      </article>
    `;
  }).join('');
  el.messages.scrollTop = el.messages.scrollHeight;
}

function metaLine(payload) {
  const meta = payload?.meta || {};
  const parts = [];
  if (payload?.model) parts.push(payload.model);
  if (meta.totalMs !== undefined) parts.push(formatMs(meta.totalMs));
  if (meta.requestId) parts.push(meta.requestId);
  return parts.join(' · ');
}

function renderCompare(payload) {
  return `
    <article class="message compare">
      <section class="compare-card">
        <div class="meta">Baseline · ${escapeHtml(metaLine(payload.baseline))}</div>
        <div class="markdown">${renderMarkdown(payload.baseline?.answer || '')}</div>
      </section>
      <section class="compare-card">
        <div class="meta">KenProbe · ${escapeHtml(metaLine(payload.kenprobe))}</div>
        <div class="markdown">${renderMarkdown(payload.kenprobe?.answer || '')}</div>
      </section>
    </article>
  `;
}

function renderTrace(trace = []) {
  if (!trace.length) {
    el.trace.className = 'trace empty';
    el.trace.textContent = 'No tool calls yet.';
    return;
  }
  el.trace.className = 'trace';
  el.trace.innerHTML = trace.map((item, index) => `
    <div class="trace-item">
      <strong>${index + 1}. ${escapeHtml(item.step || 'step')}</strong>
      <span>${escapeHtml(item.detail || '')}</span>
      <div class="trace-meta">
        ${item.durationMs !== undefined ? `<b>${formatMs(item.durationMs)}</b>` : ''}
        ${item.status ? `<b>${escapeHtml(item.status)}</b>` : ''}
        ${item.resultCount !== undefined ? `<b>${escapeHtml(item.resultCount)} results</b>` : ''}
        ${item.provider ? `<b>${escapeHtml(item.provider)}</b>` : ''}
      </div>
    </div>
  `).join('');
}

function renderSources(sources = []) {
  if (!sources.length) {
    el.sources.className = 'sources empty';
    el.sources.textContent = 'No sources yet.';
    return;
  }
  el.sources.className = 'sources';
  el.sources.innerHTML = sources.map((source) => `
    <div class="source-card">
      <strong>[${escapeHtml(source.id)}] ${escapeHtml(source.title)}</strong>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a>
      <p>${escapeHtml(source.snippet)}</p>
    </div>
  `).join('');
}

function renderSingleRunLog(label, payload = {}, clientMs = null) {
  const meta = payload.meta || {};
  const trace = payload.trace || [];
  return `
    <div class="log-card">
      <strong>${escapeHtml(label)}</strong>
      <div class="log-grid">
        <span>Request</span><b>${escapeHtml(meta.requestId || 'client-only')}</b>
        <span>Model</span><b>${escapeHtml(payload.model || meta.model || '—')}</b>
        <span>Mode</span><b>${escapeHtml(meta.mode || el.mode.value || '—')}</b>
        <span>Server time</span><b>${formatMs(meta.totalMs)}</b>
        <span>Client time</span><b>${formatMs(clientMs ?? payload.clientMs)}</b>
        <span>Sources</span><b>${escapeHtml(meta.sourceCount ?? payload.sources?.length ?? 0)}</b>
      </div>
      ${trace.length ? `<div class="log-timeline">${trace.map((item) => `
        <div><code>${escapeHtml(item.step || 'step')}</code> ${escapeHtml(item.durationMs !== undefined ? formatMs(item.durationMs) : '')} ${escapeHtml(item.detail || '')}</div>
      `).join('')}</div>` : ''}
    </div>
  `;
}

function renderLogs(payload = null) {
  if (!payload) {
    el.logs.className = 'logs empty';
    el.logs.textContent = 'No run yet.';
    return;
  }

  el.logs.className = 'logs';

  if (payload.baseline || payload.kenprobe) {
    el.logs.innerHTML = `
      ${payload.meta ? `<div class="log-card"><strong>Compare</strong><div class="log-grid"><span>Total</span><b>${formatMs(payload.meta.totalMs)}</b><span>Request</span><b>${escapeHtml(payload.meta.requestId || '—')}</b></div></div>` : ''}
      ${renderSingleRunLog('Baseline', payload.baseline)}
      ${renderSingleRunLog('KenProbe', payload.kenprobe)}
    `;
    return;
  }

  el.logs.innerHTML = renderSingleRunLog('Run', payload, payload.clientMs);
}

async function postJson(url, body) {
  const started = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  data.clientMs = Math.round(performance.now() - started);
  console.log(`[KenProbe UI] ${url} finished in ${data.clientMs}ms`, data);
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function setBusy(value) {
  el.sendBtn.disabled = value;
  el.compareBtn.disabled = value;
  el.sendBtn.textContent = value ? 'Running...' : 'Run';
}

async function runChat(compare = false) {
  const message = el.prompt.value.trim();
  if (!message) return;

  addMessage('user', message, `${el.mode.value} · ${compare ? 'compare' : el.modelChoice.value} · ${nowLabel()}`);
  el.prompt.value = '';
  setBusy(true);

  try {
    if (compare) {
      const payload = await postJson('/api/compare', {
        message,
        mode: el.mode.value,
      });
      state.messages.push({ role: 'compare', content: payload });
      renderMessages();
      renderTrace([...(payload.baseline?.trace || []), ...(payload.kenprobe?.trace || [])]);
      renderSources([...(payload.baseline?.sources || []), ...(payload.kenprobe?.sources || [])]);
      renderLogs(payload);
      return;
    }

    const payload = await postJson('/api/chat', {
      message,
      mode: el.mode.value,
      modelChoice: el.modelChoice.value,
    });
    addMessage('assistant', payload.answer || '', metaLine(payload) || `${payload.model || ''} · client ${formatMs(payload.clientMs)}`);
    renderTrace(payload.trace || []);
    renderSources(payload.sources || []);
    renderLogs(payload);
  } catch (error) {
    addMessage('error', error.message || 'Unknown error', 'Error');
  } finally {
    setBusy(false);
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    el.configPanel.innerHTML = `
      <strong>Server</strong><br>
      Provider: ${escapeHtml(config.searchProvider)}<br>
      Baseline: ${escapeHtml(config.baselineModel)}<br>
      KenProbe: ${escapeHtml(config.kenprobeModel)}<br>
      Endpoint: ${escapeHtml(config.openaiCompatibleUrl)}<br>
      Env file: ${config.envLoaded ? 'loaded' : 'not loaded'}
    `;
  } catch {
    el.configPanel.textContent = 'Config unavailable.';
  }
}

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  runChat(false);
});

el.compareBtn.addEventListener('click', () => runChat(true));
el.clearBtn.addEventListener('click', () => {
  state.messages = [];
  renderMessages();
  renderTrace([]);
  renderSources([]);
  renderLogs(null);
});

el.prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runChat(false);
  }
});

renderMessages();
renderLogs(null);
loadConfig();