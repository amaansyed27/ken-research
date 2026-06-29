import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 5177);

const config = {
  openaiCompatibleUrl: process.env.OPENAI_COMPATIBLE_URL || 'http://127.0.0.1:11434/v1/chat/completions',
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || 'ollama',
  baselineModel: process.env.BASELINE_MODEL || 'qwen3.5:4b',
  kenprobeModel: process.env.KENPROBE_MODEL || 'kenprobe:latest',
  searchProvider: process.env.SEARCH_PROVIDER || 'mock',
  braveApiKey: process.env.BRAVE_API_KEY || '',
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

function normalizeSearchResults(items = []) {
  return items.slice(0, 8).map((item, index) => ({
    id: `S${index + 1}`,
    title: item.title || item.name || 'Untitled source',
    url: item.url || item.link || '#',
    snippet: item.snippet || item.description || item.content || '',
  }));
}

async function searchMock(query) {
  return normalizeSearchResults([
    {
      title: `Search planning note for: ${query}`,
      url: 'mock://search-planning',
      snippet: 'Mock mode is active. Add BRAVE_API_KEY or TAVILY_API_KEY to enable live web search. This source is useful only for UI and model-routing tests.',
    },
    {
      title: 'Evidence discipline policy',
      url: 'mock://evidence-policy',
      snippet: 'Research answers should cite retrieved sources, state uncertainty, and avoid unsupported claims.',
    },
    {
      title: 'Deep research workflow',
      url: 'mock://deep-research-workflow',
      snippet: 'A deep research workflow should search multiple queries, compare sources, extract claims, and synthesize a final answer with citations.',
    },
  ]);
}

async function searchBrave(query) {
  if (!config.braveApiKey) return searchMock(query);
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '8');
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'x-subscription-token': config.braveApiKey,
    },
  });
  if (!response.ok) throw new Error(`Brave search failed: ${response.status}`);
  const data = await response.json();
  return normalizeSearchResults(data.web?.results || []);
}

async function searchTavily(query) {
  if (!config.tavilyApiKey) return searchMock(query);
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query,
      search_depth: 'basic',
      max_results: 8,
      include_answer: false,
    }),
  });
  if (!response.ok) throw new Error(`Tavily search failed: ${response.status}`);
  const data = await response.json();
  return normalizeSearchResults(data.results || []);
}

async function runSearch(query) {
  if (config.searchProvider === 'brave') return searchBrave(query);
  if (config.searchProvider === 'tavily') return searchTavily(query);
  return searchMock(query);
}

function buildSourceBlock(sources) {
  return sources.map((source) => `[${source.id}] ${source.title}\nURL: ${source.url}\n${source.snippet}`).join('\n\n');
}

function extractToolCalls(text) {
  const calls = [];
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text))) {
    try {
      calls.push(JSON.parse(match[1]));
    } catch {
      calls.push({ name: 'parse_error', raw: match[1] });
    }
  }
  return calls;
}

async function callModel({ model, messages, temperature = 0.2 }) {
  const response = await fetch(config.openaiCompatibleUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model call failed ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.message?.content || '';
}

function systemPrompt(mode) {
  const base = `You are KenProbe Web, a citation-first research assistant.\n\nRules:\n- Use markdown.\n- For factual or current claims, prefer evidence from provided sources.\n- Cite source IDs inline like [S1], [S2].\n- If evidence is weak, say so.\n- Be concise but complete.`;
  if (mode === 'tool') {
    return `${base}\n\nWhen search is needed, first emit a tool call exactly like:\n<tool_call>{"name":"web_search","arguments":{"query":"search query"}}</tool_call>`;
  }
  return base;
}

function modeToModel(modelChoice) {
  if (modelChoice === 'kenprobe') return config.kenprobeModel;
  if (modelChoice === 'baseline') return config.baselineModel;
  return modelChoice || config.baselineModel;
}

async function handleChat(body) {
  const question = String(body.message || '').trim();
  if (!question) throw new Error('Missing message');

  const mode = body.mode || 'chat';
  const model = modeToModel(body.modelChoice);
  const trace = [];
  let sources = [];
  let answer = '';

  if (mode === 'chat') {
    answer = await callModel({
      model,
      messages: [
        { role: 'system', content: systemPrompt('chat') },
        { role: 'user', content: question },
      ],
      temperature: 0.3,
    });
    return { answer, sources, trace, model };
  }

  if (mode === 'search') {
    trace.push({ step: 'search', detail: question });
    sources = await runSearch(question);
    answer = await callModel({
      model,
      messages: [
        { role: 'system', content: systemPrompt('chat') },
        { role: 'user', content: `${question}\n\nSources:\n${buildSourceBlock(sources)}` },
      ],
      temperature: 0.2,
    });
    return { answer, sources, trace, model };
  }

  if (mode === 'deep') {
    const plannerPrompt = `Create 3 focused search queries for this research question. Return only JSON array of strings.\n\nQuestion: ${question}`;
    trace.push({ step: 'plan', detail: 'Generating research queries' });
    let queryList = [];
    try {
      const plannerText = await callModel({
        model,
        messages: [
          { role: 'system', content: 'You are a search-query planner. Return only valid JSON.' },
          { role: 'user', content: plannerPrompt },
        ],
        temperature: 0.2,
      });
      queryList = JSON.parse(plannerText.match(/\[[\s\S]*\]/)?.[0] || '[]');
    } catch {
      queryList = [question, `${question} benchmark evidence`, `${question} comparison sources`];
    }

    for (const q of queryList.slice(0, 3)) {
      trace.push({ step: 'search', detail: q });
      const result = await runSearch(q);
      sources.push(...result);
    }

    const deduped = [];
    const seen = new Set();
    for (const source of sources) {
      const key = source.url || source.title;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push({ ...source, id: `S${deduped.length + 1}` });
      }
    }
    sources = deduped.slice(0, 10);

    trace.push({ step: 'synthesize', detail: `${sources.length} sources` });
    answer = await callModel({
      model,
      messages: [
        { role: 'system', content: systemPrompt('chat') },
        { role: 'user', content: `Question: ${question}\n\nResearch sources:\n${buildSourceBlock(sources)}\n\nWrite a grounded answer with citations. Include uncertainty if evidence is weak.` },
      ],
      temperature: 0.2,
    });
    return { answer, sources, trace, model, queries: queryList };
  }

  if (mode === 'tool') {
    trace.push({ step: 'tool-call-test', detail: 'Asking model to emit tool call' });
    const first = await callModel({
      model,
      messages: [
        { role: 'system', content: systemPrompt('tool') },
        { role: 'user', content: question },
      ],
      temperature: 0.2,
    });
    const calls = extractToolCalls(first);
    if (!calls.length) return { answer: first, sources, trace, model, toolCalls: [] };

    const searchCall = calls.find((call) => call.name === 'web_search');
    const query = searchCall?.arguments?.query || question;
    trace.push({ step: 'web_search', detail: query });
    sources = await runSearch(query);
    answer = await callModel({
      model,
      messages: [
        { role: 'system', content: systemPrompt('chat') },
        { role: 'user', content: question },
        { role: 'assistant', content: first },
        { role: 'tool', content: buildSourceBlock(sources) },
      ],
      temperature: 0.2,
    });
    return { answer, sources, trace, model, toolCalls: calls, initial: first };
  }

  throw new Error(`Unknown mode: ${mode}`);
}

async function handleCompare(body) {
  const baseline = await handleChat({ ...body, modelChoice: 'baseline' });
  const kenprobe = await handleChat({ ...body, modelChoice: 'kenprobe' });
  return { baseline, kenprobe };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.normalize(filePath).replace(/^\.{2,}/, '');
  const fullPath = path.join(publicDir, filePath);
  if (!fullPath.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const data = await fs.readFile(fullPath);
    const type = mime[path.extname(fullPath)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/config') {
      return sendJson(res, 200, {
        baselineModel: config.baselineModel,
        kenprobeModel: config.kenprobeModel,
        searchProvider: config.searchProvider,
        openaiCompatibleUrl: config.openaiCompatibleUrl,
      });
    }

    if (req.method === 'POST' && req.url === '/api/chat') {
      const body = await readBody(req);
      const payload = await handleChat(body);
      return sendJson(res, 200, payload);
    }

    if (req.method === 'POST' && req.url === '/api/compare') {
      const body = await readBody(req);
      const payload = await handleCompare(body);
      return sendJson(res, 200, payload);
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Unknown error' });
  }
});

server.listen(port, () => {
  console.log(`KenProbe web running on http://localhost:${port}`);
  console.log(`Search provider: ${config.searchProvider}`);
  console.log(`Baseline model: ${config.baselineModel}`);
  console.log(`KenProbe model: ${config.kenprobeModel}`);
});
