# KenProbe

KenProbe is a small research-model project focused on search, tool use, source reading, verification, and citation-grounded answers.

The goal is to train a compact model to follow a disciplined research loop instead of answering factual questions from memory.

```text
question → search decision → tool call → source reading → verification → cited answer
```

## Current status

Early prototype.

The first training notebook uses a Qwen 4B-class model with LoRA/Unsloth on a Colab T4 GPU. The initial target is behavior tuning, not knowledge memorization.

## Target behavior

KenProbe should learn to:

- decide when search is needed
- generate useful search queries
- emit structured tool calls
- read returned source blocks
- compare evidence
- cite source IDs inline
- say when evidence is insufficient

Tool-call format:

```xml
<tool_call>{"name":"web_search","arguments":{"query":"search query here"}}</tool_call>
```

Citation format:

```text
Use inline citations like [S1], [S2].
```

## First training target

```text
Base model: Qwen 4B-class model
Training: LoRA / Unsloth
Hardware: Colab T4 for early experiments
Runtime goal: local-first research companion
```

## Short description

KenProbe is a compact research model trained to search, inspect evidence, use tools, and answer with citations.
