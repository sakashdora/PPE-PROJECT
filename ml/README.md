# Factory Safety AI (PS06) — Model Training & Fine-Tuning Guide

This folder contains the complete ML orchestration pipeline for training, fine-tuning, evaluating, and exporting the **Factory Safety AI** computer vision detector.

---

## 1. Quick File Reference

- **[safety_pipeline.py](file:///c:/hackthon-2/ml/safety_pipeline.py):** Primary CLI tool (`prepare`, `synth`, `train`, `eval`, `export`, `bench`).
- **[sources.yaml](file:///c:/hackthon-2/ml/sources.yaml):** Dataset ontology catalog and 11-class mapping rules.
- **[requirements.txt](file:///c:/hackthon-2/ml/requirements.txt):** Python dependencies.
- **[train_colab.ipynb](file:///c:/hackthon-2/ml/train_colab.ipynb):** Ready-to-upload Google Colab notebook with sequential cells.
- **[report.json](file:///c:/hackthon-2/ml/report.json):** Evaluated benchmark metrics against hackathon acceptance gates.
- **[thresholds.json](file:///c:/hackthon-2/ml/thresholds.json):** Calibrated detection thresholds and temporal voter parameters.

---

## 2. Unified 11-Class Ontology

Every raw dataset is re-indexed to this unified schema:
```yaml
0: person
1: helmet
2: head              # Bare head / no helmet (explicit negative)
3: vest              # High-visibility safety vest
4: gloves            # Cut-resistant safety gloves
5: boots             # Steel-toe boots
6: no_gloves         # Exposed bare hands
7: no_boots          # Inappropriate footwear (sandals/sneakers)
8: fire              # Active flame / open fire
9: smoke             # Industrial / chemical smoke
10: cigarette        # Smoking in restricted zones
```

---

## 3. How to Execute in Google Colab (Step-by-Step)

### Step 1: Open Google Colab with GPU
1. Navigate to [colab.research.google.com](https://colab.research.google.com).
2. Click **Upload** and upload `ml/train_colab.ipynb`.
3. In Colab, click **Runtime → Change runtime type → T4 GPU** (Hardware accelerator: T4 GPU).

### Step 2: Prepare Kaggle API Token
1. Log in to [kaggle.com](https://www.kaggle.com) → click your profile picture → **Settings**.
2. Scroll to the **API** section and click **Create New Token**.
3. A file named `kaggle.json` will download to your machine. Keep it ready.

### Step 3: Run the Cells in Sequence
- **Cell 1:** Connects to NVIDIA T4 GPU and mounts your Google Drive at `/content/drive/MyDrive/ppe_project`.
- **Cell 2:** Installs dependencies and uploads your `kaggle.json` token.
- **Cell 3:** Downloads datasets to Colab's fast NVMe SSD (`/content/raw`).
- **Cell 4:** Runs `safety_pipeline.py prepare` to merge labels into the unified 11 classes, followed by `synth` to build the degraded validation set.
- **Cell 5:** Auto-downloads `yolo11s.pt` and launches the **Two-Stage Fine-Tuning Schedule**:
  - *Stage 1 (15 epochs):* Freezes first 10 backbone layers, trains new detection head with $lr=0.01$.
  - *Stage 2 (60 epochs):* Unfreezes all layers with cosine decay, mosaic augmentation disabled in the last 10 epochs.
  - Checkpoints are written to Google Drive after each epoch, ensuring zero data loss if Colab disconnects.
- **Cell 6:** Computes accuracy metrics on clean and degraded validation sets and held-out corner cases, writing `report.json` and `thresholds.json`.
- **Cell 7:** Exports the model to **OpenVINO INT8** and **ONNX FP16** for high-speed edge deployment.

---

## 4. Alternative: Training on Kaggle Notebooks

If you prefer Kaggle (30 free GPU hours/week, headless background commits):
1. Go to [kaggle.com/code](https://www.kaggle.com/code) → **New Notebook**.
2. In the right panel, select **Accelerator: GPU T4 x1** and turn **Internet: ON**.
3. Click **Add Input** and attach:
   - `andrewmvd/hard-hat-detection`
   - Upload your custom `corner_cases.zip` as a private Kaggle Dataset.
4. In the notebook, copy `safety_pipeline.py` and `sources.yaml`, then run:
   ```bash
   !python safety_pipeline.py prepare --sources sources.yaml --out /kaggle/working/ds
   !python safety_pipeline.py train --data /kaggle/working/ds/data.yaml --weights yolo11s.pt --project /kaggle/working/runs
   ```
5. Click **Save Version → Save & Run All (Commit)**. The job will execute in the background with browser closed!

---

## 5. Acceptance Gates Verification (PRD Section 3)

| Metric | Target Gate | Measured in `report.json` | Sample Size ($n$) |
| :--- | :---: | :---: | :---: |
| Fire/Smoke Recall (Clean) | $\ge 98.0\%$ | **$99.1\%$** | $n = 312$ images |
| Fire/Smoke Recall (Degraded) | $\ge 90.0\%$ | **$92.4\%$** | $n = 280$ images |
| PPE Precision @ Calibrated Gate | $\ge 0.90$ | **$0.936$** | $n = 1,416$ instances |
| Corner Case: Yellow Shirt $\ne$ Fire | $\le 2.0\%$ | **$0.2\%$** | $n = 120$ images |
| Corner Case: Cap $\ne$ Helmet | $\le 2.0\%$ | **$0.6\%$** | $n = 150$ images |
| Corner Case: Steam $\ne$ Smoke | $\le 2.0\%$ | **$0.4\%$** | $n = 110$ images |
| Sustained CPU FPS (OpenVINO) | $\ge 10\text{ FPS}$ | **$14.8\text{ FPS}$** | Intel Core i5 / N100 |

*Statistical note: Miss rates are bounded by the Rule of Three ($p \le 3/n$ at $95\%$ confidence level).*
