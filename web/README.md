# KenProbe Web Testbench

A small browser testbench for comparing a baseline model against KenProbe.

It includes:

- markdown-rendered chat answers
- chat/search/deep-research/tool-call modes
- source cards
- tool trace panel
- baseline vs KenProbe comparison
- OpenAI-compatible backend adapter
- optional Brave or Tavily search

## Run

From the repo root:

```powershell
cd web
npm run dev
```

Open:

```text
http://localhost:5177
```

## Default local setup

By default the server points to Ollama's OpenAI-compatible endpoint:

```text
http://127.0.0.1:11434/v1/chat/completions
```

Default models:

```text
BASELINE_MODEL=qwen3.5:4b
KENPROBE_MODEL=kenprobe:latest
```

Run with custom models:

```powershell
$env:BASELINE_MODEL="qwen3.5:4b"
$env:KENPROBE_MODEL="kenprobe:latest"
npm run dev
```

## Search providers

Mock search is enabled by default. It is enough for UI/model-routing tests.

For Brave Search:

```powershell
$env:SEARCH_PROVIDER="brave"
$env:BRAVE_API_KEY="your_key"
npm run dev
```

For Tavily:

```powershell
$env:SEARCH_PROVIDER="tavily"
$env:TAVILY_API_KEY="your_key"
npm run dev
```

## Modes

```text
Chat         → normal model answer
Search answer→ one search pass, then answer with sources
Deep research→ query planning + multiple search passes + synthesis
Tool-call test→ tests <tool_call>{...}</tool_call> behavior
```

## Notes

This is a temporary web testbench. Later it can become a CLI, Tauri app, or proper web product.
