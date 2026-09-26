#!/usr/bin/env python3
"""
audit_class_distribution.py
----------------------------
Per-class dataset audit for the Factory Safety AI 11-class YOLO dataset.
Counts bounding-box instances (not just image presence) per class for both
train and val splits, measures average bounding-box area, and flags:
  - Imbalance flag : train_pct_of_total < 10 %
  - Small object flag : avg_bbox_area_pct  < 2 %

No dependencies beyond PyYAML + standard library.
Safe to run in plain Python 3.8+ without ultralytics/torch.

USAGE (local PC — if you have the dataset extracted):
    python ml/audit_class_distribution.py --data path/to/data.yaml

USAGE (Google Colab — copy this cell block):
    !python /content/drive/MyDrive/ppe_project/audit_class_distribution.py \
        --data /content/drive/MyDrive/ppe_project/data.yaml
"""

import argparse
import csv
import os
import sys
from pathlib import Path
from collections import defaultdict

try:
    import yaml
except ImportError:
    sys.exit("PyYAML not found. Run:  pip install pyyaml")

# ── Helpers ────────────────────────────────────────────────────────────────

def find_data_yaml(start: Path) -> Path | None:
    """Search upward from start for data.yaml."""
    for candidate in [
        start / "data.yaml",
        start / "ds" / "data.yaml",
        start / "unified_dataset" / "data.yaml",
        start / "dataset" / "data.yaml",
    ]:
        if candidate.exists():
            return candidate
    # Walk one level deep
    for p in start.rglob("data.yaml"):
        return p
    return None


def resolve_labels_dir(data_yaml_path: Path, split_key: str) -> Path | None:
    """
    Given data.yaml content and a split key ('train' or 'val'),
    return the corresponding labels/ directory Path.
    """
    with open(data_yaml_path) as f:
        cfg = yaml.safe_load(f)

    dataset_root = Path(cfg.get("path", data_yaml_path.parent))
    split_images = Path(cfg.get(split_key, f"images/{split_key}"))

    # Handle absolute vs relative split paths
    if split_images.is_absolute():
        images_dir = split_images
    else:
        images_dir = dataset_root / split_images

    # YOLO convention: labels/ mirrors images/
    labels_dir = Path(str(images_dir).replace("/images/", "/labels/").replace("\\images\\", "\\labels\\"))

    if labels_dir.exists():
        return labels_dir

    # Fallback: sibling labels folder
    alt = images_dir.parent.parent / "labels" / images_dir.name
    if alt.exists():
        return alt

    return None


def audit_split(labels_dir: Path, num_classes: int):
    """
    Walk every .txt label file in labels_dir.
    Returns:
        instance_counts  : dict[class_id -> int]
        bbox_area_sums   : dict[class_id -> float]  (sum of w*h, YOLO relative)
        bbox_area_counts : dict[class_id -> int]
        total_images     : int
        background_images: int  (label file exists but is empty)
        missing_labels   : int  (image has no .txt sibling — counted if dir is images)
    """
    instance_counts  = defaultdict(int)
    bbox_area_sums   = defaultdict(float)
    bbox_area_counts = defaultdict(int)
    total_images     = 0
    background_count = 0

    txt_files = sorted(labels_dir.rglob("*.txt"))
    total_images = len(txt_files)

    for txt in txt_files:
        try:
            lines = txt.read_text(encoding="utf-8").strip().splitlines()
        except Exception:
            background_count += 1
            continue

        if not lines:
            background_count += 1
            continue

        for line in lines:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            try:
                cls_id = int(parts[0])
                w      = float(parts[3])
                h      = float(parts[4])
            except ValueError:
                continue

            if cls_id < 0 or cls_id >= num_classes:
                continue  # Out-of-range class — skip gracefully

            area = w * h  # Relative area (0.0 – 1.0)
            instance_counts[cls_id]   += 1
            bbox_area_sums[cls_id]    += area
            bbox_area_counts[cls_id]  += 1

    return instance_counts, bbox_area_sums, bbox_area_counts, total_images, background_count


def print_table(rows, headers):
    col_widths = [max(len(str(r[i])) for r in ([headers] + rows)) for i in range(len(headers))]
    fmt = "  ".join(f"{{:<{w}}}" for w in col_widths)
    sep = "  ".join("─" * w for w in col_widths)
    print(fmt.format(*headers))
    print(sep)
    for row in rows:
        print(fmt.format(*row))


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="YOLO dataset class distribution audit")
    parser.add_argument("--data", type=str, default=None,
                        help="Path to data.yaml. Auto-detected if omitted.")
    parser.add_argument("--out", type=str, default="class_distribution.csv",
                        help="Output CSV path (default: class_distribution.csv)")
    parser.add_argument("--imbalance-thresh", type=float, default=10.0,
                        help="Flag classes below this %% of total train instances (default: 10)")
    parser.add_argument("--area-thresh", type=float, default=2.0,
                        help="Flag classes below this avg bbox area %% (default: 2)")
    args = parser.parse_args()

    # ── 1. Locate data.yaml ────────────────────────────────────────────────
    if args.data:
        data_yaml = Path(args.data)
        if not data_yaml.exists():
            sys.exit(f"❌ data.yaml not found at: {data_yaml}")
    else:
        # Auto-detect from common Colab and local paths
        candidates = [
            Path("/content/drive/MyDrive/ppe_project/data.yaml"),
            Path("/content/ds/data.yaml"),
            Path("/content/data.yaml"),
            Path("data.yaml"),
            Path("ml/data.yaml"),
            Path("ds/data.yaml"),
        ]
        data_yaml = None
        for c in candidates:
            if c.exists():
                data_yaml = c
                break
        if data_yaml is None:
            data_yaml = find_data_yaml(Path.cwd())
        if data_yaml is None:
            sys.exit(
                "❌ Could not find data.yaml automatically.\n"
                "   Run with:  --data /path/to/data.yaml"
            )

    print(f"\n📄 Using data.yaml: {data_yaml}")

    with open(data_yaml) as f:
        cfg = yaml.safe_load(f)

    class_names = cfg.get("names", [])
    num_classes  = cfg.get("nc", len(class_names))

    if not class_names:
        sys.exit("❌ data.yaml has no 'names' field.")

    print(f"   Classes ({num_classes}): {', '.join(class_names)}\n")

    # ── 2. Audit train split ───────────────────────────────────────────────
    train_labels = resolve_labels_dir(data_yaml, "train")
    val_labels   = resolve_labels_dir(data_yaml, "val")

    if train_labels is None:
        sys.exit("❌ Could not locate labels/train directory from data.yaml.")
    if val_labels is None:
        print("⚠️  Could not locate labels/val — val counts will be zero.\n")

    print(f"📁 Train labels : {train_labels}")
    if val_labels:
        print(f"📁 Val labels   : {val_labels}\n")

    print("⏳ Scanning train split ...")
    tr_inst, tr_area_sum, tr_area_cnt, tr_imgs, tr_bg = audit_split(train_labels, num_classes)
    print(f"   {tr_imgs} label files found, {tr_bg} background (empty).")

    vl_inst = defaultdict(int)
    vl_area_sum = defaultdict(float)
    vl_area_cnt = defaultdict(int)
    vl_imgs = vl_bg = 0

    if val_labels:
        print("⏳ Scanning val split ...")
        vl_inst, vl_area_sum, vl_area_cnt, vl_imgs, vl_bg = audit_split(val_labels, num_classes)
        print(f"   {vl_imgs} label files found, {vl_bg} background (empty).\n")

    # ── 3. Compute totals & percentages ────────────────────────────────────
    total_train_instances = sum(tr_inst.values()) or 1  # Avoid div/0

    rows = []
    for idx, name in enumerate(class_names):
        tr_count  = tr_inst[idx]
        vl_count  = vl_inst[idx]
        tr_pct    = tr_count / total_train_instances * 100.0

        if tr_area_cnt[idx] > 0:
            avg_area_pct = (tr_area_sum[idx] / tr_area_cnt[idx]) * 100.0
        else:
            avg_area_pct = 0.0

        rows.append({
            "class_id":           idx,
            "class_name":         name,
            "train_instance_count": tr_count,
            "val_instance_count":   vl_count,
            "train_pct_of_total":   round(tr_pct, 2),
            "avg_bbox_area_pct":    round(avg_area_pct, 3),
        })

    # ── 4. Print table ─────────────────────────────────────────────────────
    IMBALANCE_THRESH = args.imbalance_thresh
    AREA_THRESH      = args.area_thresh

    print("=" * 80)
    print("CLASS DISTRIBUTION AUDIT — FACTORY SAFETY AI (11-CLASS)")
    print("=" * 80)

    table_rows = []
    for r in rows:
        flags = []
        if r["train_pct_of_total"] < IMBALANCE_THRESH:
            flags.append("⚠️  IMBALANCED")
        if r["avg_bbox_area_pct"] < AREA_THRESH:
            flags.append("⚠️  SMALL OBJ")
        flag_str = "  ".join(flags) if flags else "✅"

        table_rows.append([
            r["class_id"],
            r["class_name"],
            f"{r['train_instance_count']:,}",
            f"{r['val_instance_count']:,}",
            f"{r['train_pct_of_total']:.2f}%",
            f"{r['avg_bbox_area_pct']:.3f}%",
            flag_str,
        ])

    headers = ["ID", "Class Name", "Train Count", "Val Count",
               "Train %", "Avg BBox Area%", "Flags"]
    print()
    print_table(table_rows, headers)
    print()

    # ── 5. Save CSV ────────────────────────────────────────────────────────
    out_path = Path(args.out)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "class_id", "class_name", "train_instance_count",
            "val_instance_count", "train_pct_of_total", "avg_bbox_area_pct"
        ])
        writer.writeheader()
        writer.writerows(rows)
    print(f"📊 Saved: {out_path.resolve()}\n")

    # ── 6. Summary flags ───────────────────────────────────────────────────
    imbalanced = [r["class_name"] for r in rows if r["train_pct_of_total"] < IMBALANCE_THRESH]
    small_obj  = [r["class_name"] for r in rows if r["avg_bbox_area_pct"]  < AREA_THRESH]

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Total train instances : {total_train_instances:,}")
    print(f"  Total train images    : {tr_imgs:,}  (background: {tr_bg})")
    print(f"  Total val images      : {vl_imgs:,}  (background: {vl_bg})")
    print()

    if imbalanced:
        print(f"  ⚠️  IMBALANCE-FLAGGED classes (< {IMBALANCE_THRESH}% of train):")
        for c in imbalanced:
            r = next(x for x in rows if x["class_name"] == c)
            oversample = max(2, round(IMBALANCE_THRESH / max(r["train_pct_of_total"], 0.01)))
            print(f"       • {c:<15}  ({r['train_pct_of_total']:.2f}%  →  recommended oversample ×{oversample})")
    else:
        print(f"  ✅ No classes below {IMBALANCE_THRESH}% — training distribution is balanced.")

    print()

    if small_obj:
        print(f"  ⚠️  SMALL-OBJECT-FLAGGED classes (avg BBox < {AREA_THRESH}% of image):")
        for c in small_obj:
            r = next(x for x in rows if x["class_name"] == c)
            print(f"       • {c:<15}  (avg bbox area = {r['avg_bbox_area_pct']:.3f}%  →  consider imgsz=1280)")
    else:
        print(f"  ✅ No classes with critically small bounding boxes (all ≥ {AREA_THRESH}%).")

    print()
    print("  Hypothesis check:")
    expected_weak = {"gloves", "no_gloves", "no_boots"}
    confirmed = expected_weak & set(imbalanced + small_obj)
    if confirmed:
        print(f"  ✅ CONFIRMED: {', '.join(sorted(confirmed))} are flagged — imbalance hypothesis is valid.")
        print(f"     Recommended action: oversample these classes 2-4× before Stage 5.")
    else:
        print("  ❌ Weak classes NOT flagged by imbalance/area — look elsewhere for the AP gap.")
        print("     Possible causes: annotation quality, class confusion, or model capacity.")

    print("=" * 80)


if __name__ == "__main__":
    main()
