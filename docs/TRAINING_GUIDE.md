# Factory Safety AI (PS06): Data → Train → Fine-tune → Prove Accuracy

**Companion to `ml/safety_pipeline.py`**  
*Important: Every dataset below has been checked against its public repository page. Always inspect each dataset's own `data.yaml` / `README.md` to confirm class index ordering and licensing before running training scripts.*

---

## 0. Executive Workflow Summary

```
   [Public Datasets] (raw/) ──┐
                              ├─► [prepare] ─► Merged 11-Class Dataset ─► [synth] ─► Degraded Val Set
 [Factory Test Set] (held-out)─┘                                                           │
                                                                                           ▼
 [Evaluation & Calibration] ◄── [export & bench] ◄── [Train: Kaggle / Colab GPU] ◄────────┘
            │                     (ONNX / OpenVINO)      (yolo11s.pt 2-stage transfer)
            ▼
 [report.json & thresholds.json] ──► Iterate on data errors (hard negatives, confusions)
```

1. **Acquire 4–5 Public Datasets** into `raw/` (Section 1).
2. **Curate Held-Out Test Set** from real/staged factory footage (Section 2). This provides defensible proof to the jury.
3. **Data Preparation & Synthesis:** Run `prepare` to merge into an 11-class unified schema, then run `synth` to build degraded validation sets (dust, fog, dark, low angles).
4. **Fine-Tuning on GPU:** Train on Kaggle (recommended) or Colab GPU using COCO-pretrained weights (`yolo11s.pt`), never training from scratch.
5. **Evaluation & Calibration:** Run `eval` to compute calibrated decision thresholds and produce `report.json`. Export to ONNX/OpenVINO and benchmark CPU FPS.
6. **Error-Driven Iteration:** Target the confusion matrix mistakes by adding hard negative samples rather than blind hyperparameter tuning.

### Unified 11-Class Schema
`person`, `helmet`, `head` (= bare head / no helmet), `vest`, `gloves`, `boots`, `no_gloves`, `no_boots`, `fire`, `smoke`, `cigarette`

---

## 1. Data Sources: Acquisition & Annotation Strategy

| Need | Source Dataset | Details & Caveats |
| :--- | :--- | :--- |
| **PPE Violations** (Helmet, vest, gloves, boots + negative labels) | **Ultralytics Construction-PPE**<br>(1,416 images, 11 classes)<br>`wget https://github.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip` | High-quality source for explicit violation labels (`no_helmet`, `no_gloves`, `no_boots`). Small volume; AGPL-3.0. Note: No explicit `no_vest` label; missing vest is inferred via person-bounding-box overlap logic. |
| **Industrial PPE & Workwear Diversity** | **SH17 Dataset**<br>(8,099 images, 75,994 instances, 17 classes)<br>GitHub `ahmadmughees/SH17dataset` | Realistic manufacturing environment. **Warning:** Its `head` class often annotates any head (with or without helmet). Do not naively map it to `bare head`. |
| **Helmet vs. Bare Head Distinction** | **Kaggle `andrewmvd/hard-hat-detection`**<br>(VOC format: `helmet`, `head`, `person`) | Simple construction footage. Essential for training cap-vs-helmet negative discrimination. |
| **Hazard Detection** (Fire & Smoke) | **D-Fire Dataset**<br>(21k+ images, 14,692 fire & 11,865 smoke boxes; CC BY 4.0) | Class index order: `0: smoke`, `1: fire`. Contains ~9,800 empty images that serve as negative backgrounds. Note: Primarily outdoor/wildfire, creating a domain gap to indoor factories. |
| **Smoking Detection** | **Roboflow Universe** (e.g. `cigarette-detection-iggcm`, MIT) | Cigarettes are tiny. Expect low standalone precision; enforce postprocessing rule: *Cigarette valid only when overlapping person face and inside restricted smoking polygon*. |
| **Hard Negative Set** (Training) | **Custom Collection** (Pexels, YouTube, mobile camera footage) | 300–1,000 unlabelled images of yellow/orange/red t-shirts, beanies, caps, steam from kettles, welding glare, and industrial dust. This suppresses false alarms. |

### Acquisition Commands
- **Kaggle CLI:**
  ```bash
  kaggle datasets download -d <owner>/<dataset-slug> --unzip -p /content/raw/<name>
  ```
- **Ultralytics Direct Assets:**
  ```bash
  wget -q https://github.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip -P /content/raw
  unzip -q /content/raw/construction-ppe.zip -d /content/raw/construction-ppe
  ```
- **Roboflow Universe:**
  Download using YOLOv8 format via curl or python SDK.

> [!WARNING]
> **Licensing Strategy (AGPL-3.0 vs. Commercial):**  
> Ultralytics YOLO models and datasets are licensed under AGPL-3.0. While acceptable for hackathon demonstrations, commercial enterprise deployment requires either an Ultralytics commercial license or migration to an Apache-2.0 / MIT detector (e.g., RT-DETR or permissive YOLO variants). Proactively address this in jury Q&A.

---

## 2. Factory Test Set & Corner Cases (Held-Out)

> [!IMPORTANT]
> **Never train on this set.** This dataset exists solely to prove real-world generalization and quantify the synthetic-to-reality domain gap.

### Collection Guidelines
1. **Frame Extraction:** Extract 200–300 frames from CCTV-angle factory/workshop video:
   ```bash
   ffmpeg -i factory_clip.mp4 -vf fps=1 frames/factory_%04d.jpg
   ```
2. **Sources:** University mechanical workshop, open factory footage (Pexels, Creative Commons YouTube), or staged enactments (actors in yellow t-shirts, baseball caps, steam kettle, glowing monitor).
3. **Annotation:** Label using CVAT, Label Studio, or Roboflow according to the 11 unified classes.
4. **4 Dedicated Negative Folders (`corner_cases/`):**
   - `yellow_shirt/` (≥ 100 images): People in bright yellow/orange shirts (must not trigger fire).
   - `caps_and_beanies/` (≥ 100 images): People wearing baseball caps (must not trigger helmet).
   - `steam_and_vapor/` (≥ 100 images): Boiling water, steam pipes (must not trigger smoke).
   - `welding_glare/` (≥ 100 images): Electrical sparks and reflections (must not trigger fire).
5. **Privacy:** Apply Gaussian blur to all faces before saving or publishing images.

---

## 3. Training Infrastructure: Colab vs. Kaggle

| Feature | Kaggle Notebooks (Recommended) | Google Colab (Free Tier) | Local Laptop |
| :--- | :--- | :--- | :--- |
| **GPU Hardware** | Nvidia T4 / P100 (16 GB VRAM) | Nvidia T4 (Subject to availability) | Requires ≥ 6 GB VRAM |
| **Quotas** | ~30 GPU-hours / week | Variable idle & timeout limits | Unlimited |
| **Storage Speed** | Instant mount at `/kaggle/input` | Download each session to `/content` | Direct NVMe disk |
| **Background Runs** | *Save & Run All (Commit)* runs headless | Disconnects if browser tab closes | Local execution |
| **Artifact Sync** | Saved automatically in version output | Mount to Google Drive | Local directory |

### Recipe A: Google Colab Workflow
```python
# 1. Mount Drive & Setup Folders
from google.colab import drive
drive.mount('/content/drive')

import os
P = "/content/drive/MyDrive/ppe_project"
os.makedirs(f"{P}/weights/pretrained", exist_ok=True)
os.makedirs(f"{P}/weights/finetuned", exist_ok=True)
os.makedirs(f"{P}/runs", exist_ok=True)
os.makedirs(f"{P}/report", exist_ok=True)

# 2. Install dependencies & copy project files
!pip -q install ultralytics albumentations openvino onnx onnxruntime kaggle
!cp $P/safety_pipeline.py $P/sources.yaml /content/
!mkdir -p ~/.kaggle && cp $P/kaggle.json ~/.kaggle/ && chmod 600 ~/.kaggle/kaggle.json

# 3. Download datasets to fast local SSD (/content)
!kaggle datasets download -d andrewmvd/hard-hat-detection -p /content/raw/hardhat --unzip
!wget -q https://github.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip -P /content/raw
!unzip -q /content/raw/construction-ppe.zip -d /content/raw

# 4. Prepare merged dataset & synthetic degraded validation set
!python safety_pipeline.py prepare --sources sources.yaml --out /content/ds
!python safety_pipeline.py synth --out /content/ds
!tar -cf $P/ds.tar -C /content ds

# 5. Fine-tune 2-Stage Transfer Learning
from ultralytics import YOLO
YOLO("yolo11s.pt")
!cp yolo11s.pt $P/weights/pretrained/

!python safety_pipeline.py train \
    --data /content/ds/data.yaml \
    --weights $P/weights/pretrained/yolo11s.pt \
    --project $P/runs \
    --workers 2

# 6. Resume if interrupted
# YOLO(f"{P}/runs/s2_full/weights/last.pt").train(resume=True)
```

### Recipe B: Kaggle Notebooks
1. **Accelerator:** Select GPU T4 x1. Ensure **Internet: ON**.
2. **Dataset Inputs:** Attach Kaggle datasets and upload your custom `corner_cases.zip` as a private dataset.
3. **Execution:** Execute `safety_pipeline.py prepare --out /kaggle/working/ds` and run training targeting `/kaggle/working/runs`.
4. **Headless Execution:** Click **Save Version → Save & Run All (Commit)** to execute headless without browser dependency.

---

## 4. Transfer Learning & Weights Organization

Always initialize from COCO pretrained backbones (`yolo11s.pt`) because early layers already encode edges, gradients, and human silhouettes.

### Directory Structure
```
ppe_project/                           # Stored in Drive / Kaggle, NOT in Git
├── weights/
│   ├── pretrained/
│   │   └── yolo11s.pt                # Base COCO weights
│   └── finetuned/
│       └── ppe_v1_s2_mAP0.71.pt      # Best fine-tuned checkpoint
├── runs/
│   ├── s1_head/                      # Stage 1: Frozen backbone runs
│   └── s2_full/                      # Stage 2: Full network fine-tuning
├── report/
│   ├── thresholds.json               # Calibrated thresholds (Committed to Git)
│   └── report.json                   # Empirical evaluation results (Committed to Git)
└── ds.tar                            # Compressed dataset archive
```

### Two-Stage Fine-Tuning Schedule
- **Stage 1 (Head-Only Warming):** Freeze first 10 backbone layers. Train detection head for 15–20 epochs ($lr=0.01$). Reinitializes the classification head for 11 classes without destabilizing pretrained features.
- **Stage 2 (Full Network Fine-Tuning):** Unfreeze entire architecture. Train with low initial learning rate ($lr=0.001$) and cosine learning rate decay. **Disable Mosaic augmentation for the final 10 epochs** to allow fine localization on boots and cigarettes.
- **Factory Augmentation Policy:**
  - Inject motion blur, gaussian noise, camera shake, compression artifacts, and simulated factory illumination (shadows, spotlights).
  - **Maintain conservative hue/color jitter:** Fluorescent safety vests and flames rely strictly on color chromaticity; aggressive hue jitter confuses yellow vests with red shirts.

---

## 5. Evaluation, Calibration, & Acceptance Gates

Execute evaluation via:
```bash
python safety_pipeline.py eval \
    --weights weights/finetuned/best.pt \
    --data ds/data.yaml \
    --corner-cases corner_cases/ \
    --out report/
```

### Key Metrics & Calibration Criteria

| Metric | Target | Operational Rationale |
| :--- | :---: | :--- |
| **Fire / Smoke Image Recall (Clean)** | **$\ge 98\%$** | Zero-miss tolerance for life-safety hazards. |
| **Fire / Smoke Image Recall (Degraded)** | **$\ge 90\%$** | Robustness against steam, dust, and dim factory lighting. |
| **PPE Precision @ Calibrated Threshold** | **$\ge 0.90$** | Prevents alert fatigue for shift supervisors. |
| **Corner-Case False-Positive Rate (FPR)** | **$\le 2\%$** | Must remain silent on yellow shirts, caps, and boiling kettles. |
| **Held-Out Factory Test Set mAP50** | **$\ge 0.65$** | Reflects realistic on-premise performance. |
| **Inference Latency on CPU (OpenVINO)** | **$\le 70\text{ ms}$** | Sustains $\ge 10\text{ FPS}$ per stream on cheap edge hardware. |

### Statistical Rigor & The "Rule of Three"
When evaluating safety-critical events with zero observed failures, the upper $95\%$ confidence limit on the failure rate is approximately:
$$p \approx \frac{3}{n}$$
- If you test on $50$ fire frames and miss zero, you can statistically only claim a miss rate below $\approx 6\%$.
- To defensibly prove a $< 1\%$ fire miss rate, the held-out evaluation set must contain at least $\approx 300$ diverse fire frames with zero misses.
- `safety_pipeline.py` prints sample sizes ($n_{\text{pos}}$, $n_{\text{neg}}$) alongside every reported rate.

---

## 6. Sprint Implementation Schedule

```
Day 1: Data Ingestion & Architecture
├── Ingest 4 public datasets into raw/
├── Write sources.yaml mapping
└── Collect 200 factory frames + 4 corner-case folders

Day 2: Pipeline Integration & Baseline
├── Execute prepare & synth
├── Run 2-epoch smoke test
└── Launch 75-epoch Stage 1 & 2 training run on Kaggle/Colab

Day 3: Calibration & Quantization
├── Run eval to produce thresholds.json & report.json
├── Inspect confusion matrix & add targeted hard negatives
└── Run export to ONNX & OpenVINO FP16/INT8

Day 4: Live Edge & Demo Rehearsal
├── Integrate OpenVINO model with edge worker (infer.py)
├── Connect MJPEG streams to dashboard live wall
└── Conduct demo rehearsal: live stream, corner-case test, wire disconnect
```

---

## 7. Pre-Presentation Verification Checklist

- [ ] Class index ordering verified in every raw source's `data.yaml` (e.g. D-Fire: `0=smoke`, `1=fire`).
- [ ] No test or corner-case image leaked into training folds.
- [ ] Confidence thresholds loaded dynamically from `thresholds.json`, not hardcoded.
- [ ] Presentation slides cite numbers from `report.json` with sample size ($n$) clearly stated.
- [ ] Ready responses for AGPL-3.0 licensing and camera privacy (face blurring, zero cloud storage).
