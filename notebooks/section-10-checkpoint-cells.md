# Section 10 checkpoint cells

Use these cells after section 10 training finishes.

Do not restart the Colab runtime before saving the adapter.

## 11. Save adapter checkpoint

```python
RUN_NAME = f"kenprobe-qwen35-4b-lora-step{MAX_STEPS}"
SAVE_DIR = f"checkpoints/{RUN_NAME}"

model.save_pretrained(SAVE_DIR)
tokenizer.save_pretrained(SAVE_DIR)

run_config = {
    "run_name": RUN_NAME,
    "base_model": BASE_MODEL,
    "max_steps": MAX_STEPS,
    "max_seq_length": MAX_SEQ_LENGTH,
    "train_hotpot_samples": TRAIN_HOTPOT_SAMPLES,
    "load_in_4bit": LOAD_IN_4BIT,
    "load_in_16bit": LOAD_IN_16BIT,
}

with open(f"{SAVE_DIR}/run_config.json", "w", encoding="utf-8") as f:
    json.dump(run_config, f, indent=2)

print("Saved adapter to:", SAVE_DIR)
!ls -lh {SAVE_DIR}
```

## 12. Zip the checkpoint

```python
import shutil

ZIP_PATH = shutil.make_archive(SAVE_DIR, "zip", SAVE_DIR)
print("Created zip:", ZIP_PATH)
!ls -lh {ZIP_PATH}
```

## 13. Download the checkpoint

```python
try:
    from google.colab import files
    files.download(ZIP_PATH)
except Exception as e:
    print("Automatic download failed in this VS Code/Colab setup.")
    print("Zip path inside Colab VM:", ZIP_PATH)
    print("Error:", repr(e))
```

Extract the downloaded zip into:

```text
C:\Users\Amaan\Downloads\ken-research\checkpoints\kenprobe-qwen35-4b-lora-step80
```

For the 1000-step run, restart the Colab runtime, change config to:

```python
MAX_STEPS = 1000
TRAIN_HOTPOT_SAMPLES = 5000
```

Then rerun from the top and save again. The adapter name will become:

```text
kenprobe-qwen35-4b-lora-step1000
```
