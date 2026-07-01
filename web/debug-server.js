import http from 'node:http';
import { performance } from 'node:perf_hooks';

function elapsed(started) {
  const ms = Math.round(performance.now() - started);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value);
  }
}

const originalCreateServer = http.createServer.bind(http);
http.createServer = function createLoggedServer(handler) {
  return originalCreateServer(async (req, res) => {
    const started = performance.now();
    const id = Math.random().toString(16).slice(2, 8);
    console.log(`[web:${id}] ${req.method} ${req.url} start`);
    res.on('finish', () => {
      console.log(`[web:${id}] ${req.method} ${req.url} ${res.statusCode} ${elapsed(started)}`);
    });
    return handler(req, res);
  });
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async function loggedFetch(input, init = {}) {
  const started = performance.now();
  const method = init?.method || 'GET';
  const target = typeof input === 'string' ? input : input?.url;
  const id = Math.random().toString(16).slice(2, 8);
  console.log(`[fetch:${id}] ${method} ${safeUrl(target)} start`);
  try {
    const response = await originalFetch(input, init);
    console.log(`[fetch:${id}] ${method} ${safeUrl(target)} ${response.status} ${elapsed(started)}`);
    return response;
  } catch (error) {
    console.log(`[fetch:${id}] ${method} ${safeUrl(target)} error ${elapsed(started)} ${error.message}`);
    throw error;
  }
};

await import('./server.js');