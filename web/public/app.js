const state = {
  messages: [],
  lastSources: [],
  lastTrace: [],
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

function renderCompare(payload) {
  return `
    <article class="message compare">
      <section class="compare-card">
        <div class="meta">Baseline · ${escapeHtml(payload.baseline?.model || '')}</div>
        <div class="markdown">${renderMarkdown(payload.baseline?.answer || '')}</div>
      </section>
      <section class="compare-card">
        <div class="meta">KenProbe · ${escapeHtml(payload.kenprobe?.model || '')}</div>
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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
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

  addMessage('user', message, `${el.mode.value} · ${compare ? 'compare' : el.modelChoice.value}`);
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
      return;
    }

    const payload = await postJson('/api/chat', {
      message,
      mode: el.mode.value,
      modelChoice: el.modelChoice.value,
    });
    addMessage('assistant', payload.answer || '', `${payload.model || ''}`);
    renderTrace(payload.trace || []);
    renderSources(payload.sources || []);
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
      Endpoint: ${escapeHtml(config.openaiCompatibleUrl)}
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
});

el.prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runChat(false);
  }
});

renderMessages();
loadConfig();
