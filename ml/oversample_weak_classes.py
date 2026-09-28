#!/usr/bin/env python3
"""
oversample_weak_classes.py
--------------------------------------------------------------------------------
Targeted class-aware oversampler and augmentation pipeline for Factory Safety AI.
Solves the empirical 23:1 class imbalance discovered in PS06:
  - no_boots  (Class 7): 869   train instances (1.13%) -> Multiplied ~6x
  - no_gloves (Class 6): 2,033 train instances (2.63%) -> Multiplied ~3x
  - gloves    (Class 4): 3,409 train instances (4.42%) -> Multiplied ~2x

CRITICAL INVARIANTS:
1. Only modifies the 'train' split. 'val' is strictly untouched to maintain
   an honest, scientifically valid validation benchmark.
2. Augmented variants apply physically realistic industrial transformations:
   - Horizontal Flip (x_center = 1.0 - x_center)
   - Photometric / illumination jitter (factory lighting simulation)
   - Sensor noise / slight motion blur (CCTV fidelity)
   - Mild affine scale/shift jitter (with strict bbox boundary clipping)
3. Zero pixel duplicate overfitting: Every replica is unique.

USAGE (Local or Google Colab):
    python ml/oversample_weak_classes.py --data /content/drive/MyDrive/ppe_project/data.yaml
    python ml/oversample_weak_classes.py --data ds/data.yaml --mult-no-boots 6 --mult-no-gloves 3
"""

import argparse
import copy
import csv
import os
import random
import sys
from collections import defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML not found. Run: pip install pyyaml")

try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit("OpenCV / NumPy not found. Run: pip install opencv-python numpy")


# ── Default Classes & Recommended Multipliers ──────────────────────────────────
UNIFIED_CLASSES = [
    "person",      # 0
    "helmet",      # 1
    "head",        # 2
    "vest",        # 3
    "gloves",      # 4  (weak: 4.42%)
    "boots",       # 5
    "no_gloves",   # 6  (weak: 2.63%)
    "no_boots",    # 7  (critical: 1.13%)
    "fire",        # 8
    "smoke",       # 9
    "cigarette"    # 10
]

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ── Realistic Industrial Augmentations ─────────────────────────────────────────

def augment_horizontal_flip(image: np.ndarray, bboxes: list) -> tuple:
    """Flip horizontally and mirror bounding box x-centers."""
    flipped_img = cv2.flip(image, 1)
    new_bboxes = []
    for cls_id, x, y, w, h in bboxes:
        new_x = max(0.0, min(1.0, 1.0 - x))
        new_bboxes.append((cls_id, new_x, y, w, h))
    return flipped_img, new_bboxes


def augment_photometric(image: np.ndarray, bboxes: list) -> tuple:
    """Simulate shifting factory illumination (ambient lights, shadow, overcast)."""
    alpha = random.uniform(0.75, 1.25)  # Contrast
    beta = random.randint(-25, 25)       # Brightness
    adj_img = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
    return adj_img, copy.deepcopy(bboxes)


def augment_cctv_motion_blur(image: np.ndarray, bboxes: list) -> tuple:
    """Simulate industrial CCTV motion blur or high-ISO noise."""
    choice = random.choice(["blur", "noise", "haze"])
    if choice == "blur":
        k_size = random.choice([3, 5, 7])
        kernel = np.zeros((k_size, k_size))
        kernel[int((k_size - 1) / 2), :] = np.ones(k_size) / k_size
        aug_img = cv2.filter2D(image, -1, kernel)
    elif choice == "noise":
        noise = np.random.normal(0, random.uniform(8, 20), image.shape).astype(np.uint8)
        aug_img = cv2.add(image, noise)
    else:  # Light factory haze/steam
        haze = np.ones_like(image, dtype=np.uint8) * 220
        aug_img = cv2.addWeighted(image, 0.85, haze, 0.15, 0)
    return aug_img, copy.deepcopy(bboxes)


def augment_scale_translate(image: np.ndarray, bboxes: list) -> tuple:
    """Subtle scale and translation jitter with boundary-checked bboxes."""
    h_img, w_img = image.shape[:2]
    scale = random.uniform(0.92, 1.08)
    tx = random.uniform(-0.04, 0.04) * w_img
    ty = random.uniform(-0.04, 0.04) * h_img

    M = np.array([
        [scale, 0, tx + (1 - scale) * w_img / 2],
        [0, scale, ty + (1 - scale) * h_img / 2]
    ], dtype=np.float32)

    aug_img = cv2.warpAffine(image, M, (w_img, h_img), borderMode=cv2.BORDER_REFLECT_101)

    new_bboxes = []
    for cls_id, x, y, w, h in bboxes:
        abs_x1 = (x - w / 2) * w_img
        abs_y1 = (y - h / 2) * h_img
        abs_x2 = (x + w / 2) * w_img
        abs_y2 = (y + h / 2) * h_img

        pts = np.array([[abs_x1, abs_y1, 1], [abs_x2, abs_y2, 1]], dtype=np.float32).T
        trans_pts = M @ pts

        new_x1 = max(0.0, min(float(w_img), trans_pts[0, 0]))
        new_y1 = max(0.0, min(float(h_img), trans_pts[1, 0]))
        new_x2 = max(0.0, min(float(w_img), trans_pts[0, 1]))
        new_y2 = max(0.0, min(float(h_img), trans_pts[1, 1]))

        new_w = (new_x2 - new_x1) / w_img
        new_h = (new_y2 - new_y1) / h_img
        new_xc = (new_x1 + new_x2) / (2.0 * w_img)
        new_yc = (new_y1 + new_y2) / (2.0 * h_img)

        if new_w > 0.005 and new_h > 0.005:
            new_bboxes.append((cls_id, new_xc, new_yc, new_w, new_h))

    if not new_bboxes:
        return image, copy.deepcopy(bboxes)

    return aug_img, new_bboxes


def apply_random_transform(image: np.ndarray, bboxes: list, variant_idx: int) -> tuple:
    """Apply a deterministic sequence of variations based on variant index."""
    img, box = image.copy(), copy.deepcopy(bboxes)
    
    # 1. Flip on odd variants
    if variant_idx % 2 == 1:
        img, box = augment_horizontal_flip(img, box)

    # 2. Lighting adjustment
    if variant_idx in [1, 2, 5, 6]:
        img, box = augment_photometric(img, box)

    # 3. Scale / shift
    if variant_idx in [2, 3, 6, 7]:
        img, box = augment_scale_translate(img, box)

    # 4. Blur / noise
    if variant_idx in [3, 4, 7]:
        img, box = augment_cctv_motion_blur(img, box)

    return img, box


# ── File & Path Helpers ────────────────────────────────────────────────────────

def load_yolo_labels(lbl_path: Path, max_classes: int = 11) -> list:
    """Read a YOLO txt file and return list of (cls_id, x, y, w, h)."""
    boxes = []
    if not lbl_path.exists():
        return boxes
    try:
        with open(lbl_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 5:
                    cls_id = int(parts[0])
                    if 0 <= cls_id < max_classes:
                        x, y, w, h = map(float, parts[1:5])
                        boxes.append((cls_id, x, y, w, h))
    except Exception:
        pass
    return boxes


def write_yolo_labels(lbl_path: Path, bboxes: list):
    """Write list of (cls_id, x, y, w, h) to a YOLO txt file."""
    with open(lbl_path, "w", encoding="utf-8") as f:
        for cls_id, x, y, w, h in bboxes:
            f.write(f"{cls_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}\n")


def find_image_for_label(images_dir: Path, lbl_stem: str) -> Path | None:
    """Locate corresponding image file for a given label stem."""
    for ext in IMAGE_EXTENSIONS:
        candidate = images_dir / f"{lbl_stem}{ext}"
        if candidate.exists():
            return candidate
    return None


# ── Main Oversampling Orchestrator ─────────────────────────────────────────────

def run_oversampling(
    data_yaml_path: Path | None = None,
    train_images_dir: Path | None = None,
    train_labels_dir: Path | None = None,
    multipliers: dict | None = None,
    dry_run: bool = False
):
    if multipliers is None:
        multipliers = {"no_boots": 6, "no_gloves": 3, "gloves": 2}

    print("=" * 80)
    print("🚀 FACTORY SAFETY AI — TARGETED CLASS-AWARE OVERSAMPLING PIPELINE")
    print("=" * 80)

    if train_images_dir is None or train_labels_dir is None:
        if data_yaml_path and data_yaml_path.exists():
            print(f"📄 Data YAML: {data_yaml_path.resolve()}")
            with open(data_yaml_path, "r") as f:
                cfg = yaml.safe_load(f)
            dataset_root = Path(cfg.get("path", data_yaml_path.parent))
            train_images_dir = Path(str(dataset_root / cfg.get("train", "images/train")))
            train_labels_dir = Path(str(train_images_dir).replace("/images/", "/labels/").replace("\\images\\", "\\labels\\"))
        else:
            # Auto-detect candidates
            candidates = [
                (Path("/content/ds/images/train"), Path("/content/ds/labels/train")),
                (Path("ds/images/train"), Path("ds/labels/train")),
                (Path("dataset/images/train"), Path("dataset/labels/train")),
            ]
            for img_cand, lbl_cand in candidates:
                if img_cand.exists() and lbl_cand.exists():
                    train_images_dir = img_cand
                    train_labels_dir = lbl_cand
                    break

    if train_images_dir is None or not train_images_dir.exists():
        sys.exit(f"❌ Training images directory not found: {train_images_dir}")
    if train_labels_dir is None or not train_labels_dir.exists():
        sys.exit(f"❌ Training labels directory not found: {train_labels_dir}")

    print(f"📁 Source train images: {train_images_dir}")
    print(f"📁 Source train labels: {train_labels_dir}")
    print("🎯 Multipliers:")
    for cls_name, mult in multipliers.items():
        print(f"   • {cls_name:<12}: +{mult}x new augmented samples")
    print("-" * 80)


    # Step 1: Scan current distribution
    print("⏳ Scanning baseline training labels...")
    label_files = sorted(train_labels_dir.glob("*.txt"))
    initial_counts = defaultdict(int)
    img_class_map = defaultdict(set)

    for lf in label_files:
        boxes = load_yolo_labels(lf)
        for b in boxes:
            initial_counts[b[0]] += 1
            img_class_map[lf.stem].add(b[0])

    total_init_instances = sum(initial_counts.values()) or 1
    print(f"   Baseline: {len(label_files):,} label files, {total_init_instances:,} instances.")

    # Step 2: Determine oversampling candidates
    target_cls_ids = {
        7: ("no_boots", multipliers.get("no_boots", 6)),
        6: ("no_gloves", multipliers.get("no_gloves", 3)),
        4: ("gloves", multipliers.get("gloves", 2)),
    }

    image_actions = {}
    for stem, present_classes in img_class_map.items():
        chosen_mult = 0
        for cid in [7, 6, 4]:
            if cid in present_classes:
                chosen_mult = max(chosen_mult, target_cls_ids[cid][1])
        if chosen_mult > 0:
            image_actions[stem] = chosen_mult

    print(f"✨ Found {len(image_actions):,} unique images containing target weak classes to augment.")
    if dry_run:
        print("🔍 DRY RUN enabled — skipping disk writes.")

    # Step 3: Execute augmentations
    created_images = 0
    added_instances = defaultdict(int)

    if not dry_run:
        print("\n⚙️  Generating augmented images and labels...")
        for idx, (stem, mult) in enumerate(image_actions.items(), 1):
            lbl_file = train_labels_dir / f"{stem}.txt"
            img_file = find_image_for_label(train_images_dir, stem)

            if not img_file or not lbl_file.exists():
                continue

            orig_img = cv2.imread(str(img_file))
            if orig_img is None:
                continue

            orig_boxes = load_yolo_labels(lbl_file)
            if not orig_boxes:
                continue

            for m in range(1, mult + 1):
                aug_img, aug_boxes = apply_random_transform(orig_img, orig_boxes, m)
                if not aug_boxes:
                    continue

                aug_stem = f"{stem}_os{m}"
                out_img_path = train_images_dir / f"{aug_stem}{img_file.suffix}"
                out_lbl_path = train_labels_dir / f"{aug_stem}.txt"

                cv2.imwrite(str(out_img_path), aug_img)
                write_yolo_labels(out_lbl_path, aug_boxes)

                created_images += 1
                for b in aug_boxes:
                    added_instances[b[0]] += 1

            if idx % 500 == 0 or idx == len(image_actions):
                print(f"   Processed {idx:,}/{len(image_actions):,} images ({created_images:,} variants created)...")

    # Step 4: Final Distribution Comparison Table
    final_counts = {}
    for cid in range(len(UNIFIED_CLASSES)):
        final_counts[cid] = initial_counts[cid] + added_instances[cid]

    total_final = sum(final_counts.values()) or 1

    print("\n" + "=" * 80)
    print("📊 BEFORE vs AFTER CLASS DISTRIBUTION COMPARISON")
    print("=" * 80)
    headers = ["ID", "Class Name", "Before", "Before %", "Added", "After", "After %", "Multiplier"]
    fmt = "{:<3}  {:<12}  {:<8}  {:<9}  {:<7}  {:<8}  {:<8}  {:<10}"
    print(fmt.format(*headers))
    print("─" * 80)

    for cid, name in enumerate(UNIFIED_CLASSES):
        b_cnt = initial_counts[cid]
        b_pct = (b_cnt / total_init_instances) * 100.0
        add = added_instances[cid]
        a_cnt = final_counts[cid]
        a_pct = (a_cnt / total_final) * 100.0
        boost = f"×{a_cnt / max(b_cnt, 1):.2f}" if add > 0 else "-"
        print(fmt.format(
            cid, name, f"{b_cnt:,}", f"{b_pct:.2f}%", f"+{add:,}",
            f"{a_cnt:,}", f"{a_pct:.2f}%", boost
        ))

    print("─" * 80)
    print(f"Total Images:    {len(label_files):,} ➔ {len(label_files) + created_images:,} (+{created_images:,})")
    print(f"Total Instances: {total_init_instances:,} ➔ {total_final:,} (+{sum(added_instances.values()):,})")
    print("=" * 80)

    # Save summary report
    out_dir = data_yaml_path.parent if data_yaml_path else train_images_dir.parent.parent
    csv_out = out_dir / "oversampled_distribution_report.csv"
    with open(csv_out, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)
        writer.writerow(["class_id", "class_name", "before_count", "added_count", "after_count", "before_pct", "after_pct"])
        for cid, name in enumerate(UNIFIED_CLASSES):
            b_cnt = initial_counts[cid]
            b_pct = (b_cnt / total_init_instances) * 100.0
            add = added_instances[cid]
            a_cnt = final_counts[cid]
            a_pct = (a_cnt / total_final) * 100.0
            writer.writerow([cid, name, b_cnt, add, a_cnt, round(b_pct, 2), round(a_pct, 2)])
    print(f"\n💾 Saved oversampled report: {csv_out.resolve()}")


def main():
    parser = argparse.ArgumentParser(description="Targeted class-aware oversampling for YOLO datasets")
    parser.add_argument("--data", type=str, default="/content/drive/MyDrive/ppe_project/data.yaml",
                        help="Path to data.yaml")
    parser.add_argument("--mult-no-boots", type=int, default=6,
                        help="Multiplier for no_boots instances (default: 6)")
    parser.add_argument("--mult-no-gloves", type=int, default=3,
                        help="Multiplier for no_gloves instances (default: 3)")
    parser.add_argument("--mult-gloves", type=int, default=2,
                        help="Multiplier for gloves instances (default: 2)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Analyze distribution without writing files")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        for fallback in [
            Path("/content/ds/data.yaml"),
            Path("data.yaml"),
            Path("ml/data.yaml"),
            Path("ds/data.yaml"),
        ]:
            if fallback.exists():
                data_path = fallback
                break

    if not data_path.exists():
        sys.exit(f"❌ data.yaml not found at: {args.data}")

    mults = {
        "no_boots": args.mult_no_boots,
        "no_gloves": args.mult_no_gloves,
        "gloves": args.mult_gloves,
    }

    run_oversampling(data_path, mults, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
