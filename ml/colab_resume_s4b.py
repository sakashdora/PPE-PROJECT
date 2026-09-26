# pyright: ignore-all-errors  # Colab-only script: !pip syntax + google.colab/torch/ultralytics run in Colab GPU, not locally
# ==============================================================================
# FACTORY SAFETY AI (PS06) -- RESUME STAGE 4b (FROM EPOCH 9/20)
# ==============================================================================
#
# SITUATION:
#   - Stage 4a: COMPLETE  (15/15 epochs)
#   - Stage 4b: DISCONNECTED at epoch 9/20
#     last.pt saved at: ppe_project/runs/s4b_ceiling/weights/last.pt
#
# THIS SCRIPT:
#   STEP 1 - Resume Stage 4b: 11 remaining epochs (9->20) via resume=True
#   STEP 2 - SWA merge:       Stage 3b + 4a + 4b weighted average
#   STEP 3 - TTA Validation:  True generalization benchmark
#   STEP 4 - Export:          ONNX FP16 + OpenVINO INT8 + Download
#
# PASTE AS ONE SINGLE CELL IN GOOGLE COLAB (T4 GPU REQUIRED)
# Estimated time: ~1h 10min  |  NOTE: Stage 4a is SKIPPED (already complete)
# ==============================================================================

!pip -q install ultralytics openvino onnx onnxruntime onnxsim

import os, sys, json, time, copy, shutil
from datetime import datetime
import numpy as np
import torch
from google.colab import drive, files
from ultralytics import YOLO

# -- Setup -------------------------------------------------------------------
if not os.path.exists('/content/drive/MyDrive'):
    drive.mount('/content/drive')

P = "/content/drive/MyDrive/ppe_project"
os.makedirs(f"{P}/weights/stage4", exist_ok=True)

print("=" * 65)
print("  FACTORY SAFETY AI -- RESUME STAGE 4b (EPOCH 9 -> 20)")
print("=" * 65)
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("  Stage 4a: COMPLETE (skipped)")
print("  Stage 4b: Resuming from epoch 9 -- 11 epochs remaining")

# GPU check
if not torch.cuda.is_available():
    print("  [FATAL] No GPU! Runtime -> Change runtime type -> T4 GPU")
    sys.exit(1)

vram  = torch.cuda.get_device_properties(0).total_memory / 1e9
BATCH = 32 if vram >= 14 else 16 if vram >= 10 else 8
print(f"  GPU: {torch.cuda.get_device_name(0)}  ({vram:.1f} GB)  |  Batch: {BATCH}")

# Dataset
DATA_YAML = "/content/ds/data.yaml"
if not os.path.exists(DATA_YAML):
    print("\n  [*] Restoring dataset from Drive...")
    os.makedirs("/content/ds", exist_ok=True)
    os.system(f"tar -xf {P}/ds_unified_16k.tar -C /content")
    assert os.path.exists(DATA_YAML), "[FATAL] data.yaml not found"
    print("  [OK] Dataset ready")
else:
    print("  [OK] Dataset already present")

# Stage 4a best.pt (needed for SWA)
S4A_BEST = f"{P}/weights/stage4/best_s4a.pt"
if not os.path.exists(S4A_BEST):
    fallback = f"{P}/runs/s4a_hardneg/weights/best.pt"
    if os.path.exists(fallback):
        shutil.copy(fallback, S4A_BEST)
        print("  [OK] Copied best_s4a.pt from run folder")
    else:
        print("  [WARN] best_s4a.pt not found -- SWA will skip Stage 4a weight")

# Stage 4b last.pt -- the critical resume checkpoint
S4B_LAST = f"{P}/runs/s4b_ceiling/weights/last.pt"
if not os.path.exists(S4B_LAST):
    print(f"\n  [FATAL] Stage 4b last.pt NOT FOUND at: {S4B_LAST}")
    wdir = f"{P}/runs/s4b_ceiling/weights/"
    if os.path.exists(wdir):
        print("  Files found:")
        for f_ in os.listdir(wdir):
            print(f"    {f_}  ({os.path.getsize(os.path.join(wdir, f_))/1e6:.1f} MB)")
    else:
        print("  Run folder does not exist -- check your Google Drive.")
    sys.exit(1)
else:
    sz = os.path.getsize(S4B_LAST) / 1e6
    print(f"\n  [OK] Stage 4b last.pt found  ({sz:.1f} MB)")
    print("  Will resume: epoch 9 -> 20  (11 remaining)")

print("\n  All checks passed. Resuming Stage 4b...\n")


# ==============================================================================
# STEP 1 -- RESUME STAGE 4b (epoch 9 -> 20, 11 remaining epochs)
# ==============================================================================
print("=" * 65)
print("  STEP 1: RESUME STAGE 4b")
print("  resume=True restores epoch counter, optimizer, scheduler, hyperparams")
print("=" * 65)

# Loading last.pt and calling resume=True is the ONLY action required.
# Ultralytics reads the saved epoch number (9) and all training args from last.pt.
# Training will continue from epoch 10 through 20 automatically.
model_4b = YOLO(S4B_LAST)
results_4b = model_4b.train(resume=True)

s4b_best_final = f"{P}/runs/s4b_ceiling/weights/best.pt"
s4b_last_final = f"{P}/runs/s4b_ceiling/weights/last.pt"

if os.path.exists(s4b_best_final):
    shutil.copy(s4b_best_final, f"{P}/weights/stage4/best_s4b.pt")
    p4b  = results_4b.results_dict.get("metrics/precision(B)", 0) * 100
    r4b  = results_4b.results_dict.get("metrics/recall(B)",    0) * 100
    m4b  = results_4b.results_dict.get("metrics/mAP50(B)",     0) * 100
    m4b2 = results_4b.results_dict.get("metrics/mAP50-95(B)",  0) * 100
    print(f"\n  [OK] Stage 4b COMPLETE (resumed from epoch 9)")
    print(f"  Stage 4b Best: P={p4b:.2f}%  R={r4b:.2f}%  mAP50={m4b:.2f}%  mAP50-95={m4b2:.2f}%")
else:
    p4b, r4b, m4b, m4b2 = 0, 0, 0, 0
    print("  [WARN] best.pt not found -- using last.pt as fallback")
    if os.path.exists(s4b_last_final):
        shutil.copy(s4b_last_final, f"{P}/weights/stage4/best_s4b.pt")


# ==============================================================================
# STEP 2 -- SWA: MERGE Stage 3b + 4a + 4b
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 2: SWA WEIGHT AVERAGING (Stage 3b + 4a + 4b)")
print("=" * 65)

swa_candidates = [
    (f"{P}/runs/s3b_precision/weights/best.pt",  0.15, "Stage 3b"),
    (f"{P}/weights/stage4/best_s4a.pt",          0.35, "Stage 4a"),
    (f"{P}/weights/stage4/best_s4b.pt",          0.50, "Stage 4b"),
]

available_swa = [(path, w, name) for path, w, name in swa_candidates if os.path.exists(path)]
print(f"\n  Checkpoints found: {len(available_swa)}")
for path, w, name in available_swa:
    print(f"    [{name}]  w={w:.2f}  ({os.path.getsize(path)/1e6:.1f} MB)")

SWA_PT = f"{P}/weights/stage4/best_s4_swa.pt"

if len(available_swa) >= 2:
    w_total = sum(w for _, w, _ in available_swa)
    w_norm  = [w / w_total for _, w, _ in available_swa]
    print(f"  Normalised weights: {[round(w, 3) for w in w_norm]}")
    state_dicts = []
    for path, _, name in available_swa:
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        sd   = ckpt["model"].float().state_dict() if isinstance(ckpt, dict) else ckpt.float().state_dict()
        state_dicts.append(sd)
        print(f"    Loaded {name}: {len(sd)} tensors")
    swa_sd = copy.deepcopy(state_dicts[0])
    for key in swa_sd:
        swa_sd[key] = sum(w * sd[key].float() for w, sd in zip(w_norm, state_dicts))
    base_ckpt = torch.load(available_swa[-1][0], map_location="cpu", weights_only=False)
    if isinstance(base_ckpt, dict) and "model" in base_ckpt:
        base_ckpt["model"].float().load_state_dict(swa_sd, strict=True)
    else:
        base_ckpt.float().load_state_dict(swa_sd, strict=True)
    torch.save(base_ckpt, SWA_PT)
    print(f"  [OK] SWA saved: {SWA_PT}  ({os.path.getsize(SWA_PT)/1e6:.1f} MB)")
    final_model = YOLO(SWA_PT)
else:
    print("  [INFO] Only 1 checkpoint available -- skipping SWA")
    SWA_PT = available_swa[-1][0] if available_swa else s4b_best_final
    final_model = YOLO(SWA_PT)


# ==============================================================================
# STEP 3 -- FINAL VALIDATION: Standard + TTA
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 3: FINAL VALIDATION (Standard + TTA)")
print("=" * 65)

CLASS_NAMES = ["person", "helmet", "head", "vest", "gloves", "boots",
               "no_gloves", "no_boots", "fire", "smoke", "cigarette"]

print("\n  [A] Standard validation...")
val_std = final_model.val(
    data=DATA_YAML, imgsz=640, batch=16,
    conf=0.001, iou=0.6, verbose=False, device="cuda"
)
p_std   = val_std.box.mp   * 100
r_std   = val_std.box.mr   * 100
m50_std = val_std.box.map50 * 100
m95_std = val_std.box.map  * 100

print("  [B] TTA validation (flip + multi-scale)...")
val_tta = final_model.val(
    data=DATA_YAML, imgsz=640, batch=16,
    conf=0.001, iou=0.6, augment=True, verbose=False, device="cuda"
)
p_tta   = val_tta.box.mp   * 100
r_tta   = val_tta.box.mr   * 100
m50_tta = val_tta.box.map50 * 100
m95_tta = val_tta.box.map  * 100

print(f"\n  FINAL RESULTS vs STAGE 3 BASELINE")
print(f"  {'-'*65}")
print(f"  {'Metric':22}  {'Stage3':>9}  {'Std Val':>9}  {'TTA Val':>9}  {'Gain(TTA)':>10}")
print(f"  {'-'*65}")
for nm, base, std, tta in [
    ("Precision",  88.8, p_std,   p_tta),
    ("Recall",     74.0, r_std,   r_tta),
    ("mAP@50",     80.5, m50_std, m50_tta),
    ("mAP@50-95",  55.1, m95_std, m95_tta),
]:
    g = tta - base
    flag = "[OK]" if g > 0 else "[WARN]"
    print(f"  {nm:22}  {base:8.2f}%  {std:8.2f}%  {tta:8.2f}%  {g:+8.2f}pp {flag}")

if hasattr(val_tta.box, "ap_class_index"):
    print(f"\n  Per-Class mAP@50 (TTA):")
    for idx, ap in zip(val_tta.box.ap_class_index, val_tta.box.ap50):
        cn  = CLASS_NAMES[idx] if idx < len(CLASS_NAMES) else f"cls{idx}"
        bar = "#" * int(ap * 30)
        tag = "[CRIT]" if cn in ("fire", "smoke") else "[WARN]" if "no_" in cn or cn in ("head", "cigarette") else "[OK]"
        print(f"  {cn:14}  {ap*100:6.1f}%  {bar}  {tag}")

if p_tta >= 95.0:
    print(f"\n  TARGET 95% PRECISION ACHIEVED! ({p_tta:.2f}%)")
elif p_tta >= 93.0:
    print(f"\n  EXCELLENT: {p_tta:.2f}% ({95.0-p_tta:.1f}pp from 95% target)")
elif p_tta >= 91.0:
    print(f"\n  GOOD: {p_tta:.2f}% -- run again for another +2pp")
else:
    print(f"\n  WARN: {p_tta:.2f}% -- check training logs, may need more epochs")


# ==============================================================================
# STEP 4 -- EXPORT: ONNX FP16 + OpenVINO INT8 + DOWNLOAD
# ==============================================================================
print("\n" + "=" * 65)
print("  STEP 4: EXPORT -- ONNX FP16 + OpenVINO INT8")
print("=" * 65)

# ONNX FP16 with embedded NMS
print("\n  [1] ONNX FP16 with embedded NMS...")
onnx_path = final_model.export(
    format="onnx", half=True, simplify=True,
    nms=True, imgsz=640, opset=18,
)
ONNX_DEST = f"{P}/weights/stage4/best_s4_final.onnx"
shutil.copy(onnx_path, ONNX_DEST)
print(f"  [OK] {ONNX_DEST}  ({os.path.getsize(ONNX_DEST)/1e6:.2f} MB)")

# OpenVINO INT8
print("\n  [2] OpenVINO INT8 (target: <10ms edge latency)...")
try:
    ov_path = final_model.export(
        format="openvino", half=False, int8=True,
        data=DATA_YAML, imgsz=640,
    )
    OV_DEST = f"{P}/weights/stage4/best_s4_openvino"
    if ov_path and os.path.exists(ov_path):
        shutil.copytree(ov_path, OV_DEST, dirs_exist_ok=True)
        print(f"  [OK] OpenVINO INT8: {OV_DEST}")
    else:
        print("  [WARN] OpenVINO path missing")
except Exception as e:
    print(f"  [WARN] OpenVINO failed: {e}  (ONNX FP16 is still deployable)")

# Verify ONNX with ONNX Runtime
import onnxruntime as ort
print("\n  [3] Verifying ONNX with ONNX Runtime...")
sess  = ort.InferenceSession(ONNX_DEST, providers=["CPUExecutionProvider"])
dummy = np.random.rand(1, 3, 640, 640).astype(np.float32)
sess.run(None, {sess.get_inputs()[0].name: dummy})  # warm-up
t0 = time.perf_counter()
for _ in range(10):
    sess.run(None, {sess.get_inputs()[0].name: dummy})
lat = (time.perf_counter() - t0) / 10 * 1000
print(f"  Output: {sess.get_outputs()[0].shape}  |  CPU latency: {lat:.1f}ms")
print("  [OK] ONNX model verified")

# Download to local PC
print("\n  [4] Downloading to your PC...")
files.download(ONNX_DEST)
if os.path.exists(SWA_PT):
    files.download(SWA_PT)

# Save JSON report to Drive
report = {
    "timestamp":        datetime.now().isoformat(),
    "stage":            "Stage4b_resumed_ep9",
    "cumulative_epochs": 55 + 15 + 20,
    "stage_4b_metrics": {"precision": round(p4b,2),    "recall": round(r4b,2),    "map50": round(m4b,2),    "map50_95": round(m4b2,2)},
    "final_standard":   {"precision": round(p_std,2),  "recall": round(r_std,2),  "map50": round(m50_std,2),"map50_95": round(m95_std,2)},
    "final_tta":        {"precision": round(p_tta,2),  "recall": round(r_tta,2),  "map50": round(m50_tta,2),"map50_95": round(m95_tta,2)},
    "gain_vs_stage3":   {"precision": round(p_tta-88.8,2), "recall": round(r_tta-74.0,2), "map50": round(m50_tta-80.5,2)},
    "swa_applied":      len(available_swa) >= 2,
    "onnx_output":      ONNX_DEST,
    "cpu_latency_ms":   round(lat, 1),
    "target_95_achieved": p_tta >= 95.0,
}
rp = f"{P}/weights/stage4/stage4_report.json"
with open(rp, "w") as fj:
    json.dump(report, fj, indent=2)

print(f"\n{'='*65}")
print("  STAGE 4 COMPLETE")
print(f"{'='*65}")
print(f"  Stage 3 baseline:  P=88.8%   R=74.0%   mAP50=80.5%")
print(f"  Stage 4 final:     P={p_tta:.2f}%  R={r_tta:.2f}%  mAP50={m50_tta:.2f}%")
print(f"  Gain:              P={p_tta-88.8:+.2f}pp  R={r_tta-74.0:+.2f}pp  mAP50={m50_tta-80.5:+.2f}pp")
print(f"\n  DEPLOY TO EDGE:")
print(f"    1. Rename: best_s4_final.onnx  ->  best_s3.onnx")
print(r"    2. Copy to: c:\hackthon-2\models\best_s3.onnx")
print(f"    3. No code changes needed -- edge worker auto-loads it")
print(f"  Report: {rp}")
print(f"{'='*65}")
