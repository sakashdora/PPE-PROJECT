#!/usr/bin/env python3
"""
colab_stage5_balanced.py
--------------------------------------------------------------------------------
Stage 5 Fine-Tuning on Balanced 22k Dataset (Factory Safety AI - PS06)
Fine-tunes the best Stage 4b checkpoint on the newly balanced dataset:
  - no_boots:  5,959 instances (6.86x boost)
  - no_gloves: 8,615 instances (4.24x boost)
  - gloves:    12,566 instances (3.69x boost)

KEY SAFEGUARDS:
1. Runs on local NVMe disk (/content/runs/s5_balanced) -> ZERO Google Drive space errors!
2. Conservative LR (1e-4) -> preserves 99.5% fire and 90%+ helmet while tuning weak classes.
3. Exports FP16 ONNX with embedded NMS [1, 300, 6] -> Drop-in replacement for edge runtime.
4. Auto-provides direct browser download via google.colab.files.
"""

import os, sys, glob, shutil, json
from pathlib import Path
from google.colab import drive

# ── 1. Ensure Drive Mounted ────────────────────────────────────────────────────
if not os.path.exists("/content/drive/MyDrive"):
    print("⏳ Mounting Google Drive...")
    drive.mount("/content/drive")
else:
    print("✅ Google Drive already mounted.")

DRIVE_ROOT = "/content/drive/MyDrive/ppe_project"

# ── 2. Locate Baseline Checkpoint ──────────────────────────────────────────────
CKPT_CANDIDATES = [
    f"{DRIVE_ROOT}/runs/s4b_ceiling/weights/best.pt",
    f"{DRIVE_ROOT}/runs/s4b_ceiling/weights/last.pt",
    f"{DRIVE_ROOT}/runs/s4a_hardneg/weights/best.pt",
    f"{DRIVE_ROOT}/runs/s3b_precision/weights/best.pt",
    f"{DRIVE_ROOT}/weights/stage4/best_s4_swa.pt",
    "/content/best.pt"
]

BASE_CKPT = None
for c in CKPT_CANDIDATES:
    if os.path.exists(c):
        BASE_CKPT = c
        break

if not BASE_CKPT:
    sys.exit("❌ Could not find a Stage 4/3 checkpoint to fine-tune from.")

print(f"✅ Found Base Checkpoint: {BASE_CKPT}")

# ── 3. Verify Dataset & data.yaml ──────────────────────────────────────────────
DATA_YAML = "/content/ds/data.yaml"
if not os.path.exists(DATA_YAML):
    DATA_YAML = f"{DRIVE_ROOT}/data.yaml"

if not os.path.exists(DATA_YAML):
    sys.exit(f"❌ data.yaml not found at /content/ds/data.yaml or {DRIVE_ROOT}/data.yaml")

print(f"✅ Dataset Config: {DATA_YAML}")

# ── 4. Train Stage 5 on Balanced 22k Dataset ──────────────────────────────────
from ultralytics import YOLO

print("\n" + "=" * 80)
print("🚀 STARTING STAGE 5 BALANCED FINE-TUNING (10 EPOCHS)")
print("=" * 80)

model = YOLO(BASE_CKPT)

# Save to local Colab NVMe to guarantee zero Google Drive storage issues!
LOCAL_RUNS = "/content/runs"
RUN_NAME = "s5_balanced"

train_results = model.train(
    data=DATA_YAML,
    epochs=10,
    batch=32,
    imgsz=640,
    lr0=0.0001,          # Conservative: fine-tune weak classes without destroying fire/helmet
    lrf=0.01,
    cls=2.5,             # High penalty for class confusion (gloves/no_gloves, boots/no_boots)
    label_smoothing=0.01,
    optimizer="AdamW",
    close_mosaic=5,      # Last 5 epochs with 0 mosaic for realistic boundary training
    mosaic=0.5,
    project=LOCAL_RUNS,
    name=RUN_NAME,
    exist_ok=True,
    verbose=True
)

BEST_PT = f"{LOCAL_RUNS}/{RUN_NAME}/weights/best.pt"
print(f"\n✅ Stage 5 Training Complete! Best weights: {BEST_PT}")

# ── 5. Validate on Clean Untouched Val Split ───────────────────────────────────
print("\n" + "=" * 80)
print("📊 VALIDATING STAGE 5 ON UNTOUCHED VALIDATION SET")
print("=" * 80)

val_results = YOLO(BEST_PT).val(
    data=DATA_YAML,
    split="val",
    imgsz=640,
    batch=32,
    conf=0.25,
    iou=0.65,
    plots=True
)

CLASS_NAMES = ["person", "helmet", "head", "vest", "gloves", "boots", "no_gloves", "no_boots", "fire", "smoke", "cigarette"]

print(f"\n{'CLASS':<15} | {'AP@50':>8}")
print("─" * 28)
if hasattr(val_results.box, "ap50"):
    for idx, name in enumerate(CLASS_NAMES):
        if idx < len(val_results.box.ap50):
            score = val_results.box.ap50[idx] * 100.0
            print(f"{name:<15} | {score:>7.2f}%")
print("─" * 28)
print(f"{'Overall mAP@50':<15} | {val_results.box.map50*100:>7.2f}%")
print(f"{'Overall Precision':<15} | {val_results.box.mp*100:>7.2f}%")
print(f"{'Overall Recall':<15} | {val_results.box.mr*100:>7.2f}%")

# ── 6. Export to Embedded NMS ONNX FP16 ─────────────────────────────────────────
print("\n" + "=" * 80)
print("⚙️  EXPORTING TO ONNX FP16 (EMBEDDED NMS [1, 300, 6])")
print("=" * 80)

export_file = YOLO(BEST_PT).export(
    format="onnx",
    imgsz=640,
    half=True,
    nms=True,
    conf=0.001,
    iou=0.65,
    batch=1,
    opset=12,
    simplify=True,
    dynamic=False
)

final_onnx = f"{LOCAL_RUNS}/{RUN_NAME}/best_s5_balanced.onnx"
shutil.move(export_file, final_onnx)
print(f"✅ Exported: {final_onnx} ({os.path.getsize(final_onnx) / 1e6:.1f} MB)")

# ── 7. Save to Drive if space available, or direct browser download ────────────
drive_dest = f"{DRIVE_ROOT}/best_s5_balanced.onnx"
try:
    shutil.copy2(final_onnx, drive_dest)
    shutil.copy2(BEST_PT, f"{DRIVE_ROOT}/best_s5_balanced.pt")
    print(f"📁 Copied model to Drive: {drive_dest}")
except Exception as e:
    print(f"⚠️ Drive copy skipped ({e}). Using direct browser download instead.")

from google.colab import files
print("\n📥 Initiating direct browser download for best_s5_balanced.onnx...")
files.download(final_onnx)
print("🎉 All done! Move the downloaded file to your PC at C:\\hackthon-2\\models\\best_s5.onnx")
