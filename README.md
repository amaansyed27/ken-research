# KenProbe

**KenProbe** is the research-focused member of the **Ken family of models**.

It is designed to be a small, local-first research assistant that can search, use tools, read sources, verify claims, and produce citation-grounded answers. The goal is not to make a small model memorize the internet. The goal is to teach it a disciplined research loop.

```text
question → search decision → tool call → source reading → verification → cited answer
```

## Project status

KenProbe is currently in early training/prototyping.

The first training direction targets a Qwen 4B-class model fine-tuned with LoRA/Unsloth on Colab T4-class hardware. The initial version focuses on behavior tuning rather than raw knowledge training.

## What KenProbe is

KenProbe is trained to act like a research chatbot that:

- decides when a question needs search or external evidence
- emits structured tool calls for search/retrieval
- reads source blocks returned by the app/backend
- extracts supported claims from sources
- detects weak or conflicting evidence
- answers with inline citations
- admits when evidence is insufficient

## What KenProbe is not

KenProbe is not intended to be a frontier general model replacement.

It should not answer factual, current, benchmark, medical, legal, financial, or product-specific questions from memory when search is available. Its strength should come from tools, retrieval, verification, and source grounding.

## Core behavior contract

KenProbe should follow this loop:

```text
1. Understand the user question
2. Decide whether search is required
3. Generate useful search queries
4. Request tool use using a structured format
5. Read returned sources
6. Compare and verify claims
7. Write a concise answer with citations
8. State uncertainty when evidence is weak
```

Tool-call format:

```xml
<tool_call>{"name":"web_search","arguments":{"query":"search query here"}}</tool_call>
```

Citation format:

```text
The answer should cite source IDs inline like [S1], [S2].
```

## Model direction

Initial target:

```text
Base model: Qwen 4B-class model
Training: LoRA / Unsloth
Runtime target: local-first, with optional Colab/cloud experimentation
Final app target: companion research chatbot
```

The model should be optimized for:

- search planning
- source-grounded answering
- citation discipline
- uncertainty handling
- contradiction detection
- concise research summaries

## Training approach

KenProbe should be trained on behavior, not memorization.

Recommended dataset mix:

```text
General assistant behavior
- instruction following
- concise chatbot responses
- formatting discipline

Research QA
- multi-hop QA
- long-form source synthesis
- ambiguity handling

Verification
- supported / refuted / insufficient-evidence examples
- hallucination detection
- contradiction handling

Tool-use traces
- search query generation
- structured tool calls
- source reading
- cited final answers
```

The current training notebook starts with a small v0 run before scaling.

## Planned repository structure

```text
notebooks/
  kenprobe-v0-unsloth.ipynb

training/
  configs/
  scripts/

datasets/
  README.md
  dataset_plan.md

evals/
  research_eval_set.jsonl
  eval_runner.py

model_cards/
  kenprobe.md

app/
  companion app later
```

## Ken family context

The **Ken family of models** is a small-model family intended for specialized, local-first agents and companion tools.

Within that family:

- **KenProbe** is for research, search, verification, and citation-grounded answers.
- **KenCore** is the main AiSH model direction for CLI command understanding and generation.
- **KenWin** was the earlier Windows/PowerShell-specific model direction and is currently cancelled.

This repository is for **KenProbe only**.

## Short description

**KenProbe is a local-first research model trained to search, inspect evidence, use tools, and answer with citations.**
