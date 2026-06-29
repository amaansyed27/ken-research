# KenProbe notebook run order

Use this when running `research_companion_qwen4b_unsloth_colab.ipynb` from VS Code with a Colab T4 kernel.

## After installing dependencies

If the install cell upgrades NumPy, restart the kernel/runtime once.

After restart, do not rerun the install cell unless a package is missing.

## Required order

Run cells in this order:

```text
1. GPU check
2. Install dependencies
3. Restart runtime/kernel if NumPy warning appears
4. Import/check cell
5. HF login cell, if you want uploads
6. Config cell
7. Model load cell
8. Behavior helpers cell
9. Seed examples cell
10. HotpotQA dataset cell
11. Train/eval split cell
12. Training cell
13. Save adapter/report/bundle cell
14. HF upload cell
15. Inference test cell
16. Source-grounded test cell
```

## Common error: `NameError: json is not defined`

This means the import/check cell was skipped after restart.

Fix immediately by running:

```python
import os, json, random, shutil
from datetime import datetime, timezone

import torch
from datasets import Dataset, load_dataset
from huggingface_hub import login, HfApi
```

Then rerun the behavior helpers cell and the seed examples cell.

## Do not skip these cells

These cells define variables/functions used later:

```text
Import/check cell       → json, torch, Dataset, load_dataset, HfApi
Config cell             → BASE_MODEL, MAX_STEPS, TRAIN_HOTPOT_SAMPLES
Behavior helpers cell   → SYSTEM_PROMPT, make_tool_call, make_source_block
Seed examples cell      → rows
HotpotQA cell           → extends rows
Train/eval split cell   → train_dataset, eval_dataset
```

## If confused

Run this small rescue cell, then rerun the helper/seed/dataset cells:

```python
import os, json, random, shutil
from datetime import datetime, timezone

import torch
from datasets import Dataset, load_dataset
from huggingface_hub import login, HfApi

print('Imports restored')
```
