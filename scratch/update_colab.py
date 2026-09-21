import json

with open('ml/safety_pipeline.py', 'r', encoding='utf-8') as f:
    sp_code = f.read()

with open('ml/sources.yaml', 'r', encoding='utf-8') as f:
    sy_code = f.read()

cells = []

# Title & Overview
cells.append({
    'cell_type': 'markdown',
    'metadata': {},
    'source': [
        '# Factory Safety AI (PS06): Training & Fine-Tuning on Google Colab GPU\n',
        '\n',
        '**End-to-End Pipeline:** Automated Ingestion -> Unified 11-Class Schema -> Synthetic Degradation -> Two-Stage Transfer Learning -> Calibration -> OpenVINO & ONNX Export.\n',
        '\n',
        '### Prerequisites:\n',
        '1. **GPU Runtime:** Select **Runtime -> Change runtime type -> T4 GPU** (or A100/V100 if Colab Pro).\n',
        '2. **Kaggle API:** Pre-configured with token `KGAT_cb60af189690669e1155bec4547f89e2`.\n',
        '3. **Google Drive:** Mount Google Drive to persist all models and checkpoints across disconnects.\n',
        '4. **Zero-Setup:** All scripts (`safety_pipeline.py`, `sources.yaml`) are self-contained in this notebook!\n'
    ]
})

# Cell 1: Hardware & Drive Mount
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 1. Verify NVIDIA GPU and Mount Google Drive\n',
        '!nvidia-smi\n',
        '\n',
        'from google.colab import drive\n',
        'drive.mount("/content/drive")\n',
        '\n',
        'import os\n',
        'P = "/content/drive/MyDrive/ppe_project"\n',
        'os.makedirs(f"{P}/weights/pretrained", exist_ok=True)\n',
        'os.makedirs(f"{P}/weights/finetuned", exist_ok=True)\n',
        'os.makedirs(f"{P}/runs", exist_ok=True)\n',
        'os.makedirs(f"{P}/report", exist_ok=True)\n',
        'os.makedirs("/content/raw", exist_ok=True)\n',
        'print(f"[OK] Project directory initialized on Google Drive: {P}")\n'
    ]
})

# Cell 2: Dependencies & Kaggle Token
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 2. Install ML Dependencies and Configure Kaggle Token\n',
        '!pip -q install ultralytics albumentations openvino onnx onnxruntime kaggle pyyaml pandas opencv-python\n',
        '\n',
        'import os\n',
        'os.environ["KAGGLE_API_TOKEN"] = "KGAT_cb60af189690669e1155bec4547f89e2"\n',
        'user_kaggle = os.path.expanduser("~/.kaggle")\n',
        'os.makedirs(user_kaggle, exist_ok=True)\n',
        'with open(f"{user_kaggle}/access_token", "w") as f:\n',
        '    f.write("KGAT_cb60af189690669e1155bec4547f89e2\\n")\n',
        'print("[OK] Dependencies installed and Kaggle access token authenticated.")\n'
    ]
})

# Cell 3: Write sources.yaml
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': ['%%writefile /content/sources.yaml\n'] + [l + '\n' for l in sy_code.splitlines()]
})

# Cell 4: Write safety_pipeline.py
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': ['%%writefile /content/safety_pipeline.py\n'] + [l + '\n' for l in sp_code.splitlines()]
})

# Cell 5: Automated Dataset Download
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 5. Download and Unpack All Datasets directly to local NVMe (/content/raw)\n',
        'import os\n',
        'os.makedirs("/content/raw", exist_ok=True)\n',
        'os.makedirs("/content/raw_zips", exist_ok=True)\n',
        '\n',
        '# 5a. Ultralytics Construction-PPE (~1,416 images)\n',
        'print("[*] Downloading Construction-PPE...")\n',
        '!wget -q https://raw.githubusercontent.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip -P /content/raw_zips\n',
        '!unzip -q -o /content/raw_zips/construction-ppe.zip -d /content/raw/construction-ppe\n',
        '\n',
        '# 5b. Kaggle Hard Hat Detection (5,000 images, andrewmvd)\n',
        'print("[*] Downloading Hard-Hat Detection (andrewmvd)...")\n',
        '!kaggle datasets download -d andrewmvd/hard-hat-detection -p /content/raw/hardhat --unzip\n',
        '\n',
        '# 5c. Kaggle FIRE Dataset (999 images, phylake1337)\n',
        'print("[*] Downloading FIRE Dataset (phylake1337)...")\n',
        '!kaggle datasets download -d phylake1337/fire-dataset -p /content/raw/fire --unzip\n',
        '\n',
        '# 5d. WildFire Smoke Dataset (737 images, ahemateja19bec1025)\n',
        'print("[*] Downloading WildFire Smoke Dataset (ahemateja19bec1025)...")\n',
        '!kaggle datasets download -d ahemateja19bec1025/wildfiresmokedatasetyolo -p /content/raw/smoke --unzip\n',
        '\n',
        '# 5e. Full SH17 PPE Detection Dataset (8,099 images, 60,000+ annotations, mugheesahmad)\n',
        'print("[*] Downloading Full SH17 PPE Dataset (mugheesahmad)...")\n',
        '!kaggle datasets download -d mugheesahmad/sh17-dataset-for-ppe-detection -p /content/raw/sh17 --unzip\n',
        '# Free 14 GB disk space immediately on Colab\n',
        '!rm -f /content/raw/sh17/sh17-dataset-for-ppe-detection.zip\n',
        '\n',
        '# Initialize corner-cases folders\n',
        '!python /content/safety_pipeline.py download --raw-dir /content/raw\n',
        '\n',
        'print("[OK] All datasets downloaded, extracted, and initialized in /content/raw!")\n'
    ]
})

# Cell 6: Prepare & Synth
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 6. Prepare Unified 11-Class Dataset and Synthetic Degraded Validation Set\n',
        '!python /content/safety_pipeline.py prepare --sources /content/sources.yaml --out /content/ds\n',
        '!python /content/safety_pipeline.py synth --out /content/ds --count 200\n',
        '\n',
        '# Save consolidated dataset archive to Google Drive for future instant reuse\n',
        '!tar -cf {P}/ds_unified_16k.tar -C /content ds\n',
        'print(f"[OK] Consolidated dataset saved to Google Drive: {P}/ds_unified_16k.tar")\n'
    ]
})

# Cell 7: Two-Stage Fine-Tuning
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 7. Download Pretrained YOLO11s & Run Two-Stage Transfer Fine-Tuning\n',
        'from ultralytics import YOLO\n',
        'YOLO("yolo11s.pt")\n',
        '!cp yolo11s.pt {P}/weights/pretrained/\n',
        '\n',
        '# Schedule:\n',
        '# - Stage 1 (15 epochs): Freeze 10 backbone layers, warm up 11-class detection head\n',
        '# - Stage 2 (60 epochs): Full network fine-tuning with cosine LR decay & close_mosaic=10\n',
        '!python /content/safety_pipeline.py train \\\n',
        '    --data /content/ds/data.yaml \\\n',
        '    --weights yolo11s.pt \\\n',
        '    --project {P}/runs \\\n',
        '    --s1-epochs 15 \\\n',
        '    --s2-epochs 60 \\\n',
        '    --batch 16 \\\n',
        '    --imgsz 640 \\\n',
        '    --workers 2\n'
    ]
})

# Cell 8: Eval & Acceptance Gate
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 8. Evaluate Calibrated Accuracies, Negative Corner Cases, and Acceptance Gates\n',
        'best_weights = f"{P}/runs/s2_full/weights/best.pt"\n',
        '\n',
        '!python /content/safety_pipeline.py eval \\\n',
        '    --weights {best_weights} \\\n',
        '    --data /content/ds/data.yaml \\\n',
        '    --corner-cases /content/raw/corner_cases \\\n',
        '    --out {P}/report\n',
        '\n',
        '# Display calibrated thresholds and test report\n',
        'import json\n',
        'with open(f"{P}/report/report.json", "r") as f:\n',
        '    print(json.dumps(json.load(f), indent=2))\n'
    ]
})

# Cell 9: Export & Direct Download
cells.append({
    'cell_type': 'code',
    'execution_count': None,
    'metadata': {},
    'outputs': [],
    'source': [
        '# 9. Export to ONNX and OpenVINO, Benchmark CPU FPS, and Download\n',
        'best_weights = f"{P}/runs/s2_full/weights/best.pt"\n',
        '!python /content/safety_pipeline.py export --weights {best_weights}\n',
        '!python /content/safety_pipeline.py bench --weights {best_weights}\n',
        '\n',
        '# Copy models to Google Drive finetuned folder\n',
        '!cp {P}/runs/s2_full/weights/best.pt {P}/weights/finetuned/\n',
        '!cp {P}/runs/s2_full/weights/best.onnx {P}/weights/finetuned/\n',
        'print(f"[OK] Exported models saved to Google Drive: {P}/weights/finetuned/")\n',
        '\n',
        '# Download directly to your local machine (models/ and report/)\n',
        'from google.colab import files\n',
        'files.download(f"{P}/runs/s2_full/weights/best.onnx")\n',
        'files.download(f"{P}/report/report.json")\n'
    ]
})

nb = {
    'cells': cells,
    'metadata': {
        'accelerator': 'GPU',
        'colab': {
            'gpuType': 'T4',
            'provenance': []
        },
        'language_info': {
            'name': 'python'
        }
    },
    'nbformat': 4,
    'nbformat_minor': 0
}

with open('ml/train_colab.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('[OK] ml/train_colab.ipynb successfully updated with 100% self-contained cells!')
