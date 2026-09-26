# ==============================================================================
# FACTORY SAFETY AI (PS06) — RESUME STAGE 4a (FROM EPOCH 14) + FULL STAGE 4b
# ==============================================================================
#
# SITUATION: Stage 4a ran 14/15 epochs then DISCONNECTED at epoch 14.
#            last.pt is saved in Drive at:
#            ppe_project/runs/s4a_hardneg/weights/last.pt
#
# THIS SCRIPT:
#   STEP 1 — Resume Stage 4a: 1 remaining epoch (epoch 14 -> 15)
#   STEP 2 — Full Stage 4b:   20 epochs precision ceiling push
#   STEP 3 — SWA merge:       Stage 3b + 4a + 4b weighted average
#   STEP 4 — TTA Validation:  True generalization benchmark
#   STEP 5 — Export:          ONNX FP16 + OpenVINO INT8 + Download
#
# PASTE AS ONE SINGLE CELL IN GOOGLE COLAB (T4 GPU REQUIRED)
# Estimated time: ~2h 20min total
# ==============================================================================

!pip -q install ultralytics openvino onnx onnxruntime onnxsim

import os, sys, json, time, copy, shutil
from datetime import datetime
import numpy as np
import torch

# ── CELL 1: Setup ─────────────────────────────────────────────────────────────
from google.colab import drive, files

if not os.path.exists('/content/drive/MyDrive'):
    drive.mount('/content/drive')

P = "/content/drive/MyDrive/ppe_project"
os.makedirs(f"{P}/weights/stage4", exist_ok=True)

print("=" * 65)
print("  FACTORY SAFETY AI — RESUME STAGE 4a + FULL STAGE 4b")
print("=" * 65)
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# GPU check
if not torch.cuda.is_available():
    print("  [FATAL] No GPU! Enable T4: Runtime -> Change runtime type -> T4 GPU")
    sys.exit(1)

vram  = torch.cuda.get_device_properties(0).total_memory / 1e9
BATCH = 32 if vram >= 14 else 16 if vram >= 10 else 8
print(f"  GPU:   {torch.cuda.get_device_name(0)}  ({vram:.1f} GB)")
print(f"  Batch: {BATCH}")

# Dataset
DATA_YAML = "/content/ds/data.yaml"
if not os.path.exists(DATA_YAML):
    print("\n  [*] Restoring dataset from Drive...")
    os.makedirs("/content/ds", exist_ok=True)
    os.system(f"tar -xf {P}/ds_unified_16k.tar -C /content")
    assert os.path.exists(DATA_YAML), "[FATAL] data.yaml not found after extraction"
    print("  [OK] Dataset ready")
else:
    print("  [OK] Dataset already present")

# ── Confirm Stage 4a last.pt exists ───────────────────────────────────────────
S4A_LAST = f"{P}/runs/s4a_hardneg/weights/last.pt"
S4A_BEST = f"{P}/runs/s4a_hardneg/weights/best.pt"

if not os.path.exists(S4A_LAST):
    print(f"\n  [!] last.pt not found at: {S4A_LAST}")
    print("  Trying best.pt as fallback...")
    if os.path.exists(S4A_BEST):
        S4A_LAST = S4A_BEST
        print(f"  [OK] Using best.pt: {S4A_LAST}")
    else:
        print("  [FATAL] Neither last.pt nor best.pt found for Stage 4a!")
        print("  Check your Drive: ppe_project/runs/s4a_hardneg/weights/")
        sys.exit(1)
else:
    print(f"\n  [OK] Stage 4a last.pt found  ({os.path.getsize(S4A_LAST)/1e6:.1f} MB)")

print("\n  All checks passed. Starting...\n")


# ==============================================================================
# STEP 1 — RESUME STAGE 4a (1 remaining epoch: epoch 14 -> 15)
# ==============================================================================
from ultralytics import YOLO

print("=" * 65)
print("  STEP 1: RESUME STAGE 4a (1 remaining epoch)")
print("  Resuming from: s4a_hardneg/weights/last.pt")
print("=" * 65)

model_4a = YOLO(S4A_LAST)

results_4a = model_4a.train(
    resume=True    # Ultralytics reads all hyperparams from last.pt checkpoint
)

# Capture best weights
s4a_best_final = f"{P}/runs/s4a_hardneg/weights/best.pt"
if os.path.exists(s4a_best_final):
    shutil.copy(s4a_best_final, f"{P}/weights/stage4/best_s4a.pt")
    print(f"\n  [OK] Stage 4a COMPLETE")
    p4a  = results_4a.results_dict.get('metrics/precision(B)', 0) * 100
    r4a  = results_4a.results_dict.get('metrics/recall(B)', 0) * 100
    m4a  = results_4a.results_dict.get('metrics/mAP50(B)', 0) * 100
    m4a2 = results_4a.results_dict.get('metrics/mAP50-95(B)', 0) * 100
    print(f"  Stage 4a Best:  P={p4a:.2f}%  R={r4a:.2f}%  mAP50={m4a:.2f}%  mAP50-95={m4a2:.2f}%")
else:
    # Fallback: use last.pt if best.pt wasn't updated in 1 epoch
    p4a, r4a, m4a, m4a2 = 0, 0, 0, 0
    shutil.copy(S4A_LAST, f"{P}/weights/stage4/best_s4a.pt")
    print(f"  [OK] Stage 4a resumed and saved (1 epoch only — using last.pt)")


# ==============================================================================
# STEP 2 — FULL STAGE 4b: PRECISION CEILING PUSH (20 epochs)
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 2: STAGE 4b — PRECISION CEILING PUSH  (20 epochs)")
print("  Goal: Precision -> 93%+  |  mAP@50 -> 85%+")
print("=" * 65)

# Load Stage 4a best
s4a_for_4b = f"{P}/weights/stage4/best_s4a.pt"
if not os.path.exists(s4a_for_4b):
    s4a_for_4b = s4a_best_final if os.path.exists(s4a_best_final) else S4A_LAST
print(f"  Starting from: {os.path.basename(s4a_for_4b)}")

model_4b = YOLO(s4a_for_4b)

results_4b = model_4b.train(
    data=DATA_YAML,
    epochs=20,
    batch=BATCH,
    imgsz=640,
    workers=4,
    device="cuda",
    project=f"{P}/runs",
    name="s4b_ceiling",
    exist_ok=True,

    # ── Micro learning rate ─────────────────────────────────────────────────
    lr0=0.00005,           # Ultra-low: only tiny precise weight adjustments
    lrf=0.000001,          # Near-zero final LR
    cos_lr=True,
    warmup_epochs=1,
    warmup_momentum=0.8,

    # ── Precision-maximizing loss config ────────────────────────────────────
    box=9.5,               # Tight bounding box precision
    cls=2.5,               # Hard classification boundaries
    dfl=2.5,               # Precise anchor distribution
    label_smoothing=0.01,  # Near-zero — don't dilute at this stage

    # ── Minimal augmentation (we're at ceiling) ─────────────────────────────
    mosaic=0.4,
    close_mosaic=10,       # Disable mosaic last 10 epochs for clean boxes
    copy_paste=0.4,        # Keep copy-paste for small PPE items
    mixup=0.05,
    flipud=0.0,
    fliplr=0.5,
    hsv_h=0.010,
    hsv_s=0.5,
    hsv_v=0.3,
    degrees=3.0,
    translate=0.08,
    scale=0.4,
    perspective=0.0002,    # Very slight perspective warp (camera angles)

    # ── Regularization ──────────────────────────────────────────────────────
    dropout=0.05,
    weight_decay=0.0005,
    optimizer="AdamW",
    momentum=0.937,

    # ── Save & monitor ──────────────────────────────────────────────────────
    plots=True,
    save_period=5,
    patience=12,           # Stop early if no improvement for 12 epochs
    amp=True,
    nbs=64,
    verbose=True,
)

# Save Stage 4b to Drive
s4b_best = f"{P}/runs/s4b_ceiling/weights/best.pt"
s4b_last = f"{P}/runs/s4b_ceiling/weights/last.pt"

if os.path.exists(s4b_best):
    shutil.copy(s4b_best, f"{P}/weights/stage4/best_s4b.pt")
    p4b  = results_4b.results_dict.get('metrics/precision(B)', 0) * 100
    r4b  = results_4b.results_dict.get('metrics/recall(B)', 0) * 100
    m4b  = results_4b.results_dict.get('metrics/mAP50(B)', 0) * 100
    m4b2 = results_4b.results_dict.get('metrics/mAP50-95(B)', 0) * 100
    print(f"\n  [OK] Stage 4b COMPLETE")
    print(f"  Stage 4b Best:  P={p4b:.2f}%  R={r4b:.2f}%  mAP50={m4b:.2f}%  mAP50-95={m4b2:.2f}%")
else:
    p4b, r4b, m4b, m4b2 = 0, 0, 0, 0
    print(f"  [WARN] best.pt not found — saving last.pt")
    if os.path.exists(s4b_last):
        shutil.copy(s4b_last, f"{P}/weights/stage4/best_s4b.pt")


# ==============================================================================
# STEP 3 — SWA: MERGE Stage 3b + 4a + 4b CHECKPOINTS
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 3: SWA WEIGHT AVERAGING (Stage 3b + 4a + 4b)")
print("  Combining best checkpoints for maximum generalization")
print("=" * 65)

swa_candidates = [
    (f"{P}/runs/s3b_precision/weights/best.pt", 0.15, "Stage 3b"),
    (f"{P}/weights/stage4/best_s4a.pt",         0.35, "Stage 4a"),
    (f"{P}/weights/stage4/best_s4b.pt",         0.50, "Stage 4b"),
]

available_swa = [(path, w, name) for path, w, name in swa_candidates if os.path.exists(path)]
print(f"\n  Checkpoints found: {len(available_swa)}")
for path, w, name in available_swa:
    print(f"    [{name}]  weight={w:.2f}  ({os.path.getsize(path)/1e6:.1f} MB)")

SWA_PT = f"{P}/weights/stage4/best_s4_swa.pt"

if len(available_swa) >= 2:
    w_total = sum(w for _, w, _ in available_swa)
    w_norm  = [w / w_total for _, w, _ in available_swa]

    print(f"\n  Loading and averaging ({[round(w,3) for w in w_norm]})...")
    state_dicts = []
    for path, _, name in available_swa:
        ckpt = torch.load(path, map_location="cpu")
        sd   = ckpt["model"].float().state_dict() if isinstance(ckpt, dict) else ckpt.float().state_dict()
        state_dicts.append(sd)
        print(f"    Loaded {name}: {len(sd)} tensors")

    swa_sd = copy.deepcopy(state_dicts[0])
    for key in swa_sd:
        swa_sd[key] = sum(w * sd[key].float() for w, sd in zip(w_norm, state_dicts))

    # Inject into latest checkpoint structure
    base_ckpt = torch.load(available_swa[-1][0], map_location="cpu")
    if isinstance(base_ckpt, dict) and "model" in base_ckpt:
        base_ckpt["model"].float().load_state_dict(swa_sd, strict=True)
    else:
        base_ckpt.float().load_state_dict(swa_sd, strict=True)

    torch.save(base_ckpt, SWA_PT)
    print(f"  [OK] SWA model saved: {SWA_PT} ({os.path.getsize(SWA_PT)/1e6:.1f} MB)")
    final_model = YOLO(SWA_PT)
else:
    print("  [INFO] Only 1 checkpoint — using without SWA")
    SWA_PT = available_swa[-1][0] if available_swa else s4b_best
    final_model = YOLO(SWA_PT)


# ==============================================================================
# STEP 4 — FINAL VALIDATION: Standard + TTA
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 4: FINAL VALIDATION (Standard + TTA)")
print("=" * 65)

CLASS_NAMES = ["person","helmet","head","vest","gloves","boots",
               "no_gloves","no_boots","fire","smoke","cigarette"]

# Standard validation
print("\n  [A] Standard validation...")
val_std = final_model.val(
    data=DATA_YAML, imgsz=640, batch=16,
    conf=0.001, iou=0.6,
    verbose=False, device="cuda"
)
p_std   = val_std.box.mp * 100
r_std   = val_std.box.mr * 100
m50_std = val_std.box.map50 * 100
m95_std = val_std.box.map * 100

# TTA validation
print("  [B] TTA validation (flip + multi-scale)...")
val_tta = final_model.val(
    data=DATA_YAML, imgsz=640, batch=16,
    conf=0.001, iou=0.6,
    augment=True,
    verbose=False, device="cuda"
)
p_tta   = val_tta.box.mp * 100
r_tta   = val_tta.box.mr * 100
m50_tta = val_tta.box.map50 * 100
m95_tta = val_tta.box.map * 100

print(f"\n  {'='*65}")
print(f"  FINAL RESULTS vs STAGE 3 BASELINE")
print(f"  {'='*65}")
print(f"  {'Metric':22s}  {'Stage3':>9s}  {'Std Val':>9s}  {'TTA Val':>9s}  {'Gain(TTA)':>10s}")
print(f"  {'-'*65}")
rows = [
    ("Precision",  88.8, p_std,   p_tta),
    ("Recall",     74.0, r_std,   r_tta),
    ("mAP@50",     80.5, m50_std, m50_tta),
    ("mAP@50-95",  55.1, m95_std, m95_tta),
]
for name, base, std, tta in rows:
    g = tta - base
    flag = "✅" if g > 0 else "⚠️"
    print(f"  {name:22s}  {base:8.2f}%  {std:8.2f}%  {tta:8.2f}%  {g:+8.2f}pp {flag}")

# Per-class mAP@50
print(f"\n  Per-Class mAP@50 (TTA):")
print(f"  {'Class':14s} {'mAP@50':>8s}  {'Bar':30s}")
if hasattr(val_tta.box, 'ap_class_index'):
    for idx, ap in zip(val_tta.box.ap_class_index, val_tta.box.ap50):
        cn  = CLASS_NAMES[idx] if idx < len(CLASS_NAMES) else f"cls{idx}"
        bar = "█" * int(ap * 30)
        flag = "🔴" if cn in ("fire","smoke") else "⚠️" if "no_" in cn or cn in ("head","cigarette") else "🟢"
        print(f"  {cn:14s}  {ap*100:6.1f}%  {bar}  {flag}")

# Target check
if p_tta >= 95.0:
    print(f"\n  🎯 TARGET 95% PRECISION ACHIEVED! ({p_tta:.2f}%)")
elif p_tta >= 93.0:
    print(f"\n  ✅ EXCELLENT: {p_tta:.2f}% precision ({95.0-p_tta:.1f}pp from 95% target)")
elif p_tta >= 91.0:
    print(f"\n  ✅ GOOD: {p_tta:.2f}% precision — Run script again for another +2pp")
else:
    print(f"\n  ⚠️  {p_tta:.2f}% — Check training logs, may need more epochs")


# ==============================================================================
# STEP 5 — EXPORT: ONNX FP16 + OpenVINO INT8 + DOWNLOAD
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 5: EXPORT — ONNX FP16 + OpenVINO INT8")
print("=" * 65)

# ONNX FP16
print("\n  [1] ONNX FP16 with embedded NMS...")
onnx_path = final_model.export(
    format="onnx",
    half=True,
    simplify=True,
    nms=True,
    imgsz=640,
    opset=18,
)
ONNX_DEST = f"{P}/weights/stage4/best_s4_final.onnx"
shutil.copy(onnx_path, ONNX_DEST)
print(f"  [OK] {ONNX_DEST}  ({os.path.getsize(ONNX_DEST)/1e6:.2f} MB)")

# OpenVINO INT8
print("\n  [2] OpenVINO INT8 (target: <10ms edge latency)...")
try:
    ov_path = final_model.export(
        format="openvino",
        half=False,
        int8=True,
        data=DATA_YAML,
        imgsz=640,
    )
    OV_DEST = f"{P}/weights/stage4/best_s4_openvino"
    if ov_path and os.path.exists(ov_path):
        shutil.copytree(ov_path, OV_DEST, dirs_exist_ok=True)
        print(f"  [OK] OpenVINO INT8 saved: {OV_DEST}")
    else:
        print(f"  [WARN] OpenVINO path missing: {ov_path}")
except Exception as e:
    print(f"  [WARN] OpenVINO failed: {e}  (ONNX FP16 still works for deployment)")

# Verify ONNX
print("\n  [3] Verifying ONNX with ONNX Runtime...")
import onnxruntime as ort
sess = ort.InferenceSession(ONNX_DEST, providers=["CPUExecutionProvider"])
dummy = np.random.rand(1, 3, 640, 640).astype(np.float32)
sess.run(None, {sess.get_inputs()[0].name: dummy})  # warm-up
t0 = time.perf_counter()
for _ in range(10):
    sess.run(None, {sess.get_inputs()[0].name: dummy})
lat = (time.perf_counter() - t0) / 10 * 1000
print(f"  Output: {sess.get_outputs()[0].shape}  |  CPU latency: {lat:.1f}ms")
print(f"  [OK] ONNX model verified")

# Download
print("\n  [4] Downloading to your PC...")
files.download(ONNX_DEST)
if os.path.exists(SWA_PT):
    files.download(SWA_PT)

# Save JSON report
report = {
    "timestamp": datetime.now().isoformat(),
    "completed_stage": "Stage 4 (Resume 4a + Full 4b)",
    "cumulative_epochs": 55 + 15 + 20,
    "stage_4a_metrics": {"precision": round(p4a,2), "recall": round(r4a,2), "map50": round(m4a,2)},
    "stage_4b_metrics": {"precision": round(p4b,2), "recall": round(r4b,2), "map50": round(m4b,2)},
    "final_standard":   {"precision": round(p_std,2), "recall": round(r_std,2), "map50": round(m50_std,2), "map50_95": round(m95_std,2)},
    "final_tta":        {"precision": round(p_tta,2), "recall": round(r_tta,2), "map50": round(m50_tta,2), "map50_95": round(m95_tta,2)},
    "gain_vs_stage3":   {"precision": round(p_tta-88.8,2), "recall": round(r_tta-74.0,2), "map50": round(m50_tta-80.5,2)},
    "swa_applied": len(available_swa) >= 2,
    "onnx_output": ONNX_DEST,
    "cpu_latency_ms": round(lat, 1),
    "target_95_achieved": p_tta >= 95.0,
}
rp = f"{P}/weights/stage4/stage4_report.json"
with open(rp, "w") as f:
    json.dump(report, f, indent=2)

print(f"\n{'='*65}")
print("  STAGE 4 COMPLETE")
print(f"{'='*65}")
print(f"""
  RESULTS SUMMARY
  ---------------
  Stage 3 baseline:  P=88.8%   R=74.0%   mAP50=80.5%
  Stage 4 final:     P={p_tta:.2f}%  R={r_tta:.2f}%  mAP50={m50_tta:.2f}%
  Improvement:       P={p_tta-88.8:+.2f}pp  R={r_tta-74.0:+.2f}pp  mAP50={m50_tta-80.5:+.2f}pp

  DEPLOY TO EDGE:
  ---------------
  1. Rename downloaded file:
       best_s4_final.onnx  ->  best_s3.onnx
  2. Copy to:
       c:\\hackthon-2\\models\\best_s3.onnx
  3. No code changes needed — edge worker auto-loads it

  IF PRECISION < 95% and you want more:
  ---------------------------------------
  - Run script AGAIN from Drive s4b checkpoint (+1-2pp each pass)
  - Switch to YOLO11m:  model = YOLO('yolo11m.pt')  then retrain
""")
print(f"  Report: {rp}")
print(f"{'='*65}")
