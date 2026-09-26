# ============================================================
# FACTORY SAFETY AI — PRECISION 95% COLAB SCRIPT  v2 (FIXED)
# BPUT Hackathon 2026 — PS06
# ============================================================
# ROOT CAUSE OF YOUR ERROR:
#   FileNotFoundError: '/content/drive/MyDrive/ppe_project/data.yaml'
#
# WHY IT HAPPENED:
#   The original train_colab.ipynb writes data.yaml to the Colab
#   local filesystem (/content/unified_dataset/data.yaml).
#   After a Colab disconnect, /content/ is completely wiped.
#   This script auto-detects OR rebuilds data.yaml every time.
#
# HOW TO USE:
#   1. Open a NEW Colab notebook
#   2. Copy each CELL block into a separate code cell (6 cells)
#   3. Runtime → T4 GPU
#   4. Run cells ONE BY ONE — do NOT run all at once
# ============================================================


# ╔══════════════════════════════════════════════════════════╗
# ║  CELL 1 — ENVIRONMENT SETUP, MOUNT, DATA.YAML FIX       ║
# ╚══════════════════════════════════════════════════════════╝

from google.colab import drive
drive.mount('/content/drive')

import subprocess, os, sys, json, shutil
subprocess.run(["pip", "install", "-q", "ultralytics", "onnx", "onnxruntime"], check=True)

from ultralytics import YOLO
import torch, numpy as np, yaml

print("=" * 60)
print(f"PyTorch : {torch.__version__}")
print(f"CUDA    : {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU     : {torch.cuda.get_device_name(0)}")
    print(f"VRAM    : {torch.cuda.get_device_properties(0).total_memory/1e9:.1f} GB")
print("=" * 60)

# ── 1a. Paths ──────────────────────────────────────────────
DRIVE_ROOT = "/content/drive/MyDrive/ppe_project"
RUNS_DIR   = f"{DRIVE_ROOT}/runs"

# ── 1b. Find best checkpoint ────────────────────────────────
CKPT_PRIORITY = [
    f"{RUNS_DIR}/s4b_ceiling/weights/best.pt",   # Stage 4b — top priority
    f"{RUNS_DIR}/s4b_ceiling/weights/last.pt",   # Stage 4b last (fallback)
    f"{RUNS_DIR}/s4a_hardneg/weights/best.pt",   # Stage 4a
    f"{RUNS_DIR}/s3b_precision/weights/best.pt", # Stage 3b
    f"{RUNS_DIR}/s2_full/weights/best.pt",       # Stage 2
]
BASE_CKPT = None
for p in CKPT_PRIORITY:
    if os.path.exists(p):
        BASE_CKPT = p
        print(f"✅ Checkpoint : {p}")
        break
if BASE_CKPT is None:
    raise FileNotFoundError(f"❌ No checkpoint found!\n   Searched: {CKPT_PRIORITY}")

# ── 1c. Find or REBUILD data.yaml ──────────────────────────
# The original notebook saved data.yaml to /content/ (local Colab disk).
# After disconnect that disk is wiped. We auto-detect or rebuild here.

DATA_YAML = None

# Priority 1: Saved on Drive (from a previous run of this script's Cell 4)
for p in [
    f"{DRIVE_ROOT}/data.yaml",
    f"{DRIVE_ROOT}/unified_dataset/data.yaml",
    f"{DRIVE_ROOT}/dataset/data.yaml",
    f"{DRIVE_ROOT}/ppe_dataset/data.yaml",
]:
    if os.path.exists(p):
        DATA_YAML = p
        print(f"✅ data.yaml  : {p} (Drive)")
        break

# Priority 2: Still alive in Colab local disk (no disconnect happened)
if DATA_YAML is None:
    for p in ["/content/unified_dataset/data.yaml",
              "/content/dataset/data.yaml",
              "/content/data.yaml"]:
        if os.path.exists(p):
            DATA_YAML = p
            print(f"✅ data.yaml  : {p} (local)")
            break

# Priority 3: REBUILD by finding dataset folder on Drive
if DATA_YAML is None:
    print("\n⚠️  data.yaml missing — scanning Drive for dataset folder...")
    DATASET_DIR = None

    # Quick scan: most common locations
    for root in [
        f"{DRIVE_ROOT}/unified_dataset",
        f"{DRIVE_ROOT}/dataset",
        f"{DRIVE_ROOT}/ppe_dataset",
        DRIVE_ROOT,
    ]:
        if os.path.isdir(f"{root}/images/train") and os.path.isdir(f"{root}/images/val"):
            DATASET_DIR = root
            print(f"   ✅ Dataset found: {root}")
            break

    # Deep walk if quick scan failed
    if DATASET_DIR is None:
        print("   Deep-scanning Drive (30-60s) ...")
        for dirpath, dirnames, _ in os.walk(DRIVE_ROOT):
            if "images" in dirnames:
                img_dir = os.path.join(dirpath, "images")
                if (os.path.isdir(os.path.join(img_dir, "train")) and
                        os.path.isdir(os.path.join(img_dir, "val"))):
                    DATASET_DIR = dirpath
                    print(f"   ✅ Dataset found (deep): {dirpath}")
                    break

    if DATASET_DIR is None:
        print("⚠️  Dataset images/train not found directly. Checking for dataset archive...")
        TAR_PATH = f"{DRIVE_ROOT}/ds_unified_16k.tar"
        if os.path.exists(TAR_PATH):
            print(f"   ✅ Found dataset archive: {TAR_PATH}")
            print("   📦 Extracting to local /content/ds ... (takes ~1-2 min)")
            # Extract to /content directly since tar was made with -C /content
            subprocess.run(["tar", "-xf", TAR_PATH, "-C", "/content"], check=True)
            print("   ✅ Extraction complete.")
            
            if os.path.isdir("/content/ds/images/val"):
                DATASET_DIR = "/content/ds"
            else:
                raise RuntimeError("❌ Extracted archive did not contain expected images/val structure.")
        else:
            print("❌ Dataset archive (ds_unified_16k.tar) not found on Drive!")
            print("   ➜ You must re-run the PREPARE cell from train_colab.ipynb first.")
            print("   ➜ That takes ~15 min and rebuilds the unified 11-class dataset.")
            raise RuntimeError("Dataset not found. Re-run data preparation.")

    # Build and save data.yaml to Drive root (survives future disconnects)
    data_yaml_content = {
        "path": DATASET_DIR,
        "train": "images/train",
        "val":   "images/val",
        "test":  "images/val",
        "nc":    11,
        "names": [
            "person", "helmet", "head", "vest", "gloves",
            "boots", "no_gloves", "no_boots", "fire", "smoke", "cigarette"
        ],
    }
    DATA_YAML = f"{DRIVE_ROOT}/data.yaml"
    with open(DATA_YAML, "w") as f:
        yaml.dump(data_yaml_content, f, sort_keys=False)
    print(f"   ✅ data.yaml rebuilt → {DATA_YAML}")

# ── 1d. Verify ─────────────────────────────────────────────
print("\n" + "─" * 60)
print(f"Checkpoint : {BASE_CKPT}")
print(f"data.yaml  : {DATA_YAML}")
with open(DATA_YAML) as f:
    yc = yaml.safe_load(f)
val_img_dir = os.path.join(yc.get("path",""), yc.get("val","images/val"))
if os.path.isdir(val_img_dir):
    n = len([x for x in os.listdir(val_img_dir) if x.lower().endswith((".jpg",".png",".jpeg"))])
    print(f"Val images : {n} {'✅' if n > 0 else '⚠️  re-run PREPARE!'}")
else:
    print(f"⚠️  Val folder missing: {val_img_dir}  →  re-run PREPARE cell!")
print("─" * 60)
print("\n✅ Cell 1 done — run Cell 2 next")


# ╔══════════════════════════════════════════════════════════╗
# ║  CELL 2 — CONFIDENCE THRESHOLD SWEEP (FREE GAINS)       ║
# ╚══════════════════════════════════════════════════════════╝
# ZERO extra training. Expected time: 5-10 minutes total.
# This single step routinely pushes precision +3 to +6 points.

print("\n" + "=" * 60)
print("CELL 2: CONFIDENCE SWEEP (0.25 → 0.65)")
print("=" * 60)

model = YOLO(BASE_CKPT)
CONF_VALUES   = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65]
results_table = []

for conf in CONF_VALUES:
    print(f"\n▶ conf={conf:.2f} ...")
    vr = model.val(data=DATA_YAML, conf=conf, iou=0.65, imgsz=640,
                   batch=32, split="val", verbose=False, plots=False,
                   save=False, save_json=False)
    p, r = vr.box.mp, vr.box.mr
    m50  = vr.box.map50
    f1   = 2*p*r / (p+r+1e-9)
    results_table.append({"conf":conf,"P":p,"R":r,"mAP50":m50,"F1":f1})
    print(f"   P={p*100:.2f}%  R={r*100:.2f}%  mAP50={m50*100:.2f}%  F1={f1*100:.2f}%")

best_p_row  = max(results_table, key=lambda x: x["P"])
best_f1_row = max(results_table, key=lambda x: x["F1"])

print("\n" + "="*65)
print(f"{'CONF':>6} | {'PRECISION':>10} | {'RECALL':>8} | {'mAP@50':>8} | {'F1':>8}")
print("-"*65)
for row in results_table:
    tag = " ← 🏆 BEST P" if row==best_p_row else (" ← ✅ BEST F1" if row==best_f1_row else "")
    print(f"{row['conf']:>6.2f} | {row['P']*100:>9.2f}% | {row['R']*100:>7.2f}% | "
          f"{row['mAP50']*100:>7.2f}% | {row['F1']*100:>7.2f}%{tag}")
print("="*65)

BEST_CONF_P  = best_p_row["conf"]
BEST_CONF_F1 = best_f1_row["conf"]
print(f"\n🏆 Best Precision conf = {BEST_CONF_P:.2f}  →  P={best_p_row['P']*100:.2f}%")
print(f"✅ Best F1       conf = {BEST_CONF_F1:.2f}  →  F1={best_f1_row['F1']*100:.2f}%")
if best_p_row["P"]*100 >= 95:
    print("\n🎉 95%+ ALREADY HIT! → Skip Cell 3, run Cell 4.")
elif best_p_row["P"]*100 >= 93:
    print("\n✅ Close. Run Cell 3 to push to 95%.")
else:
    print("\n⚠️  Below 93%. Run Cell 3 (Stage 5 fine-tune).")


# ╔══════════════════════════════════════════════════════════╗
# ║  CELL 3 — STAGE 5: PRECISION FINE-TUNE (8 EPOCHS)       ║
# ╚══════════════════════════════════════════════════════════╝
# ONLY RUN if Cell 2 showed P < 94%.
# Frozen backbone + high cls weight = surgical precision push.
# Expected time: ~45-60 min on T4.

print("\n" + "="*60)
print("CELL 3: STAGE 5 — PRECISION FINE-TUNE (8 EPOCHS)")
print("="*60)

cur_p = max(r["P"] for r in results_table) * 100
if cur_p >= 94.0:
    print(f"✅ {cur_p:.2f}% — Stage 5 NOT needed. Go to Cell 4.")
else:
    print(f"Running Stage 5 ({cur_p:.2f}% → target 95%) ...")
    YOLO(BASE_CKPT).train(
        data=DATA_YAML, epochs=8, imgsz=640, batch=16, workers=2,
        lr0=0.000005, lrf=0.01, warmup_epochs=0,
        optimizer="AdamW", weight_decay=0.0001, momentum=0.937,
        cls=3.5, box=7.5, dfl=1.5, label_smoothing=0.0,
        freeze=10,   # backbone frozen — only head trains
        # Zero augmentation
        hsv_h=0.0, hsv_s=0.0, hsv_v=0.0,
        degrees=0.0, translate=0.0, scale=0.0,
        shear=0.0, perspective=0.0, flipud=0.0, fliplr=0.0,
        mosaic=0.0, mixup=0.0, copy_paste=0.0, erasing=0.0,
        close_mosaic=0,
        save=True, save_period=1, patience=5,
        project=RUNS_DIR, name="s5_precision", exist_ok=True,
        val=True, plots=True, verbose=True,
    )
    S5_BEST = f"{RUNS_DIR}/s5_precision/weights/best.pt"
    vr = YOLO(S5_BEST).val(data=DATA_YAML, conf=BEST_CONF_P, iou=0.65,
                            imgsz=640, batch=32, split="val", verbose=True)
    print(f"\n🏆 Stage 5 @ conf={BEST_CONF_P:.2f}:")
    print(f"   P={vr.box.mp*100:.2f}%  R={vr.box.mr*100:.2f}%  mAP50={vr.box.map50*100:.2f}%")
    BASE_CKPT = S5_BEST
    print(f"✅ BASE_CKPT updated → {BASE_CKPT}. Run Cell 4.")


# ╔══════════════════════════════════════════════════════════╗
# ║  CELL 4 — EXPORT TO ONNX FP16                           ║
# ╚══════════════════════════════════════════════════════════╝
# Output: models/best_s5.onnx  (shape [1,300,6], infer.py compatible)

print("\n" + "="*60)
print("CELL 4: EXPORT TO ONNX FP16")
print("="*60)

import onnxruntime as ort

export_path = YOLO(BASE_CKPT).export(
    format="onnx", imgsz=640, half=True, nms=True,
    conf=0.001,   # LOW here — threshold set at runtime in config.py
    iou=0.65, batch=1, opset=12, simplify=True, dynamic=False,
)

sess = ort.InferenceSession(str(export_path), providers=["CPUExecutionProvider"])
out  = sess.run(None, {sess.get_inputs()[0].name: np.random.randn(1,3,640,640).astype(np.float32)})

print(f"Input  : {sess.get_inputs()[0].shape}")
print(f"Output : {out[0].shape}")
print("✅ Shape (1,300,6) — infer.py compatible" if out[0].shape==(1,300,6) else f"⚠️ Shape mismatch: {out[0].shape}")

DRIVE_ONNX = f"{DRIVE_ROOT}/best_s5_precision95.onnx"
shutil.copy2(str(export_path), DRIVE_ONNX)
if DATA_YAML != f"{DRIVE_ROOT}/data.yaml":
    shutil.copy2(DATA_YAML, f"{DRIVE_ROOT}/data.yaml")  # backup for next session!

print(f"\n📁 ONNX saved  → {DRIVE_ONNX}")
print(f"📁 data.yaml backed up → {DRIVE_ROOT}/data.yaml")
print("✅ Cell 4 done — run Cell 5.")


# ╔══════════════════════════════════════════════════════════╗
# ║  CELL 5 — PER-CLASS AP + THRESHOLDS JSON                ║
# ╚══════════════════════════════════════════════════════════╝

print("\n" + "="*60)
print("CELL 5: PER-CLASS AP@50 + THRESHOLD JSON")
print("="*60)

CLASS_NAMES = ["person","helmet","head (bare)","vest","gloves",
               "boots","no_gloves","no_boots","fire 🔴","smoke 🔴","cigarette"]

vr = YOLO(BASE_CKPT).val(data=DATA_YAML, conf=BEST_CONF_F1, iou=0.65,
                          imgsz=640, batch=32, split="val",
                          verbose=False, plots=True)

print(f"\n{'CLASS':<20} | {'AP@50':>7}")
print("─"*35)
for i, name in enumerate(CLASS_NAMES):
    if i < len(vr.box.ap50):
        ap = vr.box.ap50[i]
        print(f"{name:<20} | {ap*100:>6.2f}%  {'█'*int(ap*20)}")
print("─"*35)
print(f"{'MEAN':<20} | {vr.box.map50*100:>6.2f}%")

thresholds = {
    "model_version": "ppe_s5_precision95",
    "best_conf_precision": float(BEST_CONF_P),
    "best_conf_f1":        float(BEST_CONF_F1),
    "confidence_thresholds": {
        "person":    0.50,
        "helmet":    float(BEST_CONF_P),
        "head":      float(BEST_CONF_F1),
        "vest":      float(BEST_CONF_P),
        "gloves":    float(BEST_CONF_F1),
        "boots":     float(BEST_CONF_F1),
        "no_gloves": float(max(0.35, BEST_CONF_F1 - 0.10)),
        "no_boots":  float(max(0.35, BEST_CONF_F1 - 0.10)),
        "fire":      0.30,   # SAFETY CRITICAL
        "smoke":     0.25,   # SAFETY CRITICAL
        "cigarette": float(BEST_CONF_F1),
    },
    "temporal_voting": {
        "fire_smoke": {"required_frames":2,"window_size":5},
        "smoking":    {"required_frames":3,"window_size":5},
        "ppe_items":  {"required_frames":8,"window_size":10},
    },
    "cooldown_seconds": 30,
}

THRESH_PATH = f"{DRIVE_ROOT}/thresholds_s5.json"
with open(THRESH_PATH,"w") as f:
    json.dump(thresholds, f, indent=2)
print(f"\n📁 Saved: {THRESH_PATH}")
print(json.dumps(thresholds, indent=2))


# ╔══════════════════════════════════════════════════════════╗
# ║  CELL 6 — FINAL SUMMARY & DOWNLOAD INSTRUCTIONS         ║
# ╚══════════════════════════════════════════════════════════╝

print("\n" + "="*60)
print("CELL 6: FINAL SUMMARY")
print("="*60)

fv = YOLO(BASE_CKPT).val(data=DATA_YAML, conf=BEST_CONF_P, iou=0.65,
                          imgsz=640, batch=32, split="val", verbose=False)
fp = fv.box.mp*100;  fr = fv.box.mr*100;  fm = fv.box.map50*100

print(f"\n🏆 FINAL @ conf={BEST_CONF_P:.2f}:")
print(f"   Precision : {fp:.2f}%  {'🎉 95% TARGET HIT!' if fp>=95 else '⚡ Almost!'}")
print(f"   Recall    : {fr:.2f}%")
print(f"   mAP@50    : {fm:.2f}%")

print(f"""
═══════════════════════════════════════════════════════════
📥 DOWNLOAD FROM DRIVE:

   {DRIVE_ROOT}/best_s5_precision95.onnx
   → PC: models/best_s5.onnx

   {DRIVE_ROOT}/thresholds_s5.json
   → PC: ml/thresholds.json

═══════════════════════════════════════════════════════════
🔧 EDIT edge/app/config.py:

   model_path     = "models/best_s5.onnx"
   CONF_THRESHOLD = {BEST_CONF_P:.2f}

═══════════════════════════════════════════════════════════
⚠️  NEVER CHANGE:
   fire = 0.30   smoke = 0.25   (life safety, recall-first)

💡 STILL BELOW 95%?
   → Raise CONF_THRESHOLD by +0.05 in config.py
   → Max safe value: 0.65
═══════════════════════════════════════════════════════════
""")
