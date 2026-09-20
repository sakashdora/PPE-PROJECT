# Factory Safety AI (PS06) — Model Training & Stage 2 Guide

This document records the current training state of the Factory Safety AI detection model and provides instructions for resuming or running **Stage 2 (Full Network Fine-Tuning)** on Google Colab GPU.

---

## 1. Current Model Status (Stage 1: Completed)

| Metric | Measured Value | Target / Baseline | Status |
|---|---|---|---|
| **Architecture** | YOLO11s (181 layers, 9.4M params) | Pretrained COCO weights | Ready |
| **Stage 1 Schedule** | 15 Epochs (10 Backbone Layers Frozen) | Head Warming | **COMPLETED** |
| **Box Precision (P)** | **84.3%** | $\ge 80\%$ | **EXCEEDED** |
| **Box Recall (R)** | **72.1%** | $\ge 70\%$ | **EXCEEDED** |
| **mAP50** | **77.1%** | $\ge 70\%$ | **EXCEEDED** |
| **mAP50-95** | **52.0%** | $\ge 45\%$ | **EXCEEDED** |
| **Evaluated Images** | 3,304 Validation Images (19,167 instances) | Held-out validation split | Verified |
| **Active Edge Model** | [`models/best.onnx`](file:///c:/hackthon-2/models/best.onnx) (18.1 MB) | FP16 ONNX Runtime | **Deployed Locally** |

### Google Drive Checkpoint Locations:
- **Stage 1 Best Weights:** `/content/drive/MyDrive/ppe_project/runs/s1_head/weights/best.pt`
- **Stage 1 Last Checkpoint:** `/content/drive/MyDrive/ppe_project/runs/s1_head/weights/last.pt`
- **16,800+ Image Dataset Archive:** `/content/drive/MyDrive/ppe_project/ds_unified_16k.tar`
- **Exported ONNX:** `/content/drive/MyDrive/ppe_project/weights/finetuned/best.onnx`

---

## 2. How to Run Stage 2 on Google Colab

Whenever you want to run Stage 2 (tonight, tomorrow, or anytime), **you do NOT need to redownload the 14 GB datasets** because the entire unified dataset is archived in your Google Drive.

### Step 1: Open Google Colab
1. Go to [colab.research.google.com](https://colab.research.google.com).
2. Create a new notebook (or open [`ml/train_colab.ipynb`](file:///c:/hackthon-2/ml/train_colab.ipynb)).
3. In the top menu, select **Runtime → Change runtime type → T4 GPU**.

### Step 2: Run the Stage 2 Cell
Copy and paste this **single self-contained block** into a code cell and click **Run (▶)**:

```python
# ==============================================================================
# Factory Safety AI — Stage 2: Full Network Deep Fine-Tuning
# ==============================================================================
!pip -q install ultralytics

import os
from google.colab import drive, files
from ultralytics import YOLO

# 1. Mount Google Drive
if not os.path.exists('/content/drive/MyDrive'):
    drive.mount('/content/drive')

P = "/content/drive/MyDrive/ppe_project"
stage1_weights = f"{P}/runs/s1_head/weights/best.pt"

# 2. Restore 16,800+ image dataset from Drive (takes ~10s, zero downloading)
if not os.path.exists('/content/ds/data.yaml'):
    print("[*] Restoring unified dataset from Google Drive...")
    !tar -xf {P}/ds_unified_16k.tar -C /content
    print("[OK] Dataset ready in /content/ds")

print(f"[*] Initializing Stage 2 with Stage 1 best weights: {stage1_weights}")
model = YOLO(stage1_weights)

# 3. Train Stage 2 (All layers unfrozen, cosine LR decay, close_mosaic for small objects)
model.train(
    data="/content/ds/data.yaml",
    epochs=25,               # 25 epochs of deep full-network tuning
    batch=16,
    imgsz=640,
    workers=2,
    project=f"{P}/runs",
    name="s2_full",
    freeze=0,                # 0 = unfreeze entire network
    lr0=0.001,               # Lower learning rate for fine adjustments
    lrf=0.0001,
    cos_lr=True,             # Cosine learning rate schedule
    close_mosaic=10,         # Disable mosaic in final 10 epochs for precise glove/boot boxes
    exist_ok=True
)

# 4. Export Stage 2 model to ONNX & OpenVINO
stage2_best = f"{P}/runs/s2_full/weights/best.pt"
print(f"\n[*] Exporting Stage 2 model: {stage2_best}")
s2_model = YOLO(stage2_best)
onnx_path = s2_model.export(format="onnx", half=True, imgsz=640)

# 5. Backup to Google Drive & Trigger Download
!cp {onnx_path} {P}/weights/finetuned/best_s2.onnx
!cp {stage2_best} {P}/weights/finetuned/best_s2.pt
print(f"[OK] Saved to Google Drive: {P}/weights/finetuned/best_s2.onnx")

# Download directly to your PC
files.download(onnx_path)
```

---

## 3. What Stage 2 Does

- **Backbone Unfrozen (`freeze=0`):** Fine-tunes all 181 layers of YOLO11s rather than just the detection heads.
- **Cosine Decay (`cos_lr=True`):** Smoothly ramps down the learning rate from `0.001` to `0.0001`, preventing catastrophic forgetting.
- **Close Mosaic Augmentation (`close_mosaic=10`):** Disables 4-image tiling during the last 10 epochs so the model learns clean, realistic bounding box boundaries for small items (safety boots, safety gloves, bare hands).

---

## 4. How to Update the Local Edge Worker with Stage 2

Once `best.onnx` (or `best_s2.onnx`) downloads to your computer's `Downloads` folder:

1. **Copy the new model into `models/`:**
   ```powershell
   Move-Item -Force "$HOME\Downloads\best.onnx" "c:\hackthon-2\models\best.onnx"
   ```

2. **Restart the Edge Worker Daemon:**
   ```powershell
   & .\.venv\Scripts\python.exe edge/app/main.py
   ```

3. **Verify Live Detections on the Video Wall:**
   Open **`http://localhost:3000/wall`** in your browser to observe the live streams with the improved Stage 2 detection model.
