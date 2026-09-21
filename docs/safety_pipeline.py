#!/usr/bin/env python3
"""
Factory Safety AI (PS06) - complete data -> train -> calibrate -> eval -> export pipeline.

Run order:
    python safety_pipeline.py prepare --sources sources.yaml --out datasets/factory_safety
    python safety_pipeline.py synth   --out datasets/factory_safety
    python safety_pipeline.py train   --data datasets/factory_safety/data.yaml
    python safety_pipeline.py eval    --weights runs/factory_safety/s2_full/weights/best.pt \
                                      --data datasets/factory_safety --sources sources.yaml
    python safety_pipeline.py export  --weights .../best.pt --data datasets/factory_safety/data.yaml
    python safety_pipeline.py bench   --exports exports.json --data datasets/factory_safety/data.yaml
    python safety_pipeline.py infer   --weights .../best.pt --thresholds report/thresholds.json \
                                      --video demo.mp4 --camera "Sector-4"

Design rules (from the STPI brief):
  * fire/smoke  -> recall first (zero missed fires); false alarms filtered downstream
  * PPE         -> precision first (avoid alarm fatigue)
  * hard negatives (orange clothes, caps, steam) are trained on AND held out for testing
  * everything reported is measured, nothing is asserted
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import shutil
import sys
import time
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from pathlib import Path

import numpy as np
import yaml

# ---------------------------------------------------------------------------
# Unified taxonomy. "head" = bare head (== no_helmet). no_gloves / no_boots = explicit missing-item labels
# (Ultralytics Construction-PPE has them; absence can't be reliably inferred from a missing box).
# ---------------------------------------------------------------------------
CLASSES = ["person", "helmet", "head", "vest", "gloves", "boots", "no_gloves", "no_boots",
           "fire", "smoke", "cigarette"]
CID = {n: i for i, n in enumerate(CLASSES)}
CRITICAL = ["fire", "smoke"]
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def iter_images(d):
    return sorted(p for p in Path(d).rglob("*") if p.suffix.lower() in IMG_EXT)


# ===========================================================================
# 1. DATA: load heterogeneous sources -> unified YOLO dataset
# ===========================================================================
def dhash(path, size=8):
    from PIL import Image
    with Image.open(path) as im:
        a = np.asarray(im.convert("L").resize((size + 1, size), Image.LANCZOS), dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return "".join("1" if b else "0" for b in bits)


def _voc_boxes(xml_path):
    root = ET.parse(xml_path).getroot()
    W = float(root.findtext("size/width", "0"))
    H = float(root.findtext("size/height", "0"))
    out = []
    if W <= 0 or H <= 0:
        return out
    for o in root.findall("object"):
        name = (o.findtext("name") or "").strip().lower()
        b = o.find("bndbox")
        if b is None:
            continue
        x1, y1, x2, y2 = (float(b.findtext(k, "0")) for k in ("xmin", "ymin", "xmax", "ymax"))
        out.append((name, ((x1 + x2) / 2 / W, (y1 + y2) / 2 / H, (x2 - x1) / W, (y2 - y1) / H)))
    return out


def _yolo_boxes(txt_path, names):
    out = []
    for line in txt_path.read_text().splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cls = int(float(p[0]))
        v = list(map(float, p[1:]))
        if len(v) > 4:  # polygon (segmentation) -> bbox
            xs, ys = v[0::2], v[1::2]
            x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
            v = [(x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1]
        if 0 <= cls < len(names):
            out.append((names[cls].strip().lower(), tuple(v[:4])))
    return out


def load_source(src):
    """Yield (image_path, [(unified_cid, cx, cy, w, h)]) for a source; unmapped classes dropped."""
    root = Path(src["path"])
    img_dir = root / src.get("images_dir", "images")
    lbl_dir = root / src.get("labels_dir", "labels")
    cmap = {k.lower(): v for k, v in src["map"].items()}
    for img in iter_images(img_dir):
        rel = img.relative_to(img_dir).with_suffix(".xml" if src["format"] == "voc" else ".txt")
        lp = lbl_dir / rel
        if not lp.exists():
            continue
        raw = _voc_boxes(lp) if src["format"] == "voc" else _yolo_boxes(lp, src["names"])
        boxes = [(CID[cmap[n]], *b) for n, b in raw if n in cmap and cmap[n] in CID]
        if boxes:  # drop images with nothing we care about (avoids silent missing-label negatives)
            yield img, boxes


def cmd_prepare(a):
    cfg = yaml.safe_load(open(a.sources))
    out = Path(a.out).resolve()
    if out.exists():
        if not a.force:
            sys.exit(f"{out} exists; use --force to rebuild")
        shutil.rmtree(out)
    for s in ("train", "val"):
        (out / "images" / s).mkdir(parents=True)
        (out / "labels" / s).mkdir(parents=True)

    items, seen, stats = [], set(), defaultdict(int)

    def add(name, img, boxes):
        h = dhash(img)
        if h in seen:
            stats["duplicates_dropped"] += 1
            return
        seen.add(h)
        items.append((name, img, boxes))

    for src in cfg["sources"]:
        n0 = len(items)
        for img, boxes in load_source(src):
            add(src["name"], img, boxes)
        print(f"[prepare] {src['name']}: {len(items) - n0} images")
    for i, d in enumerate(cfg.get("hard_negatives", [])):
        n0 = len(items)
        for img in iter_images(d):
            add(f"neg{i}", img, [])
        print(f"[prepare] hard_negatives {d}: {len(items) - n0} images")

    counts = {"train": defaultdict(int), "val": defaultdict(int)}
    train_imgs = []  # (path, set(class names))
    for idx, (name, img, boxes) in enumerate(items):
        base = re.sub(r"[_\-. ]?\d+$", "", img.stem)
        key = f"{name}:{base}" if a.group_by_stem else str(idx)
        split = "val" if int(hashlib.md5(key.encode()).hexdigest(), 16) % 100 < a.val_pct else "train"
        stem = f"{name}_{idx:06d}"
        dst = out / "images" / split / (stem + img.suffix.lower())
        shutil.copy2(img, dst)
        lines = [f"{c} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for c, cx, cy, w, h in boxes]
        (out / "labels" / split / (stem + ".txt")).write_text("\n".join(lines))
        for c, *_ in boxes:
            counts[split][CLASSES[c]] += 1
        counts[split]["_images"] += 1
        counts[split]["_negatives"] += int(not boxes)
        if split == "train":
            train_imgs.append((dst, {CLASSES[c] for c, *_ in boxes}))

    # class-imbalance handling: repeat images containing rare/critical classes
    over = cfg.get("oversample", {})
    lines = []
    for p, cls_set in train_imgs:
        rep = max([1] + [int(over.get(c, 1)) for c in cls_set])
        lines += [str(p)] * rep
    random.Random(0).shuffle(lines)
    (out / "train.txt").write_text("\n".join(lines))

    data = {"path": str(out), "train": str(out / "train.txt"), "val": "images/val",
            "names": {i: n for i, n in enumerate(CLASSES)}}
    yaml.dump(data, open(out / "data.yaml", "w"), sort_keys=False)
    json.dump({k: dict(v) for k, v in counts.items()} | {"stats": dict(stats)},
              open(out / "stats.json", "w"), indent=2)
    print(json.dumps({k: dict(v) for k, v in counts.items()}, indent=2))
    print("[prepare] classes with < 300 train instances need more data:",
          [c for c in CLASSES if counts["train"].get(c, 0) < 300])
    print(f"[prepare] wrote {out/'data.yaml'}")


# ===========================================================================
# 2. SYNTHETIC DEGRADATION: robustness eval set (fog/dust, noise, blur, dark, high angle)
# ===========================================================================
def _fog(img, rng):
    h, w = img.shape[:2]
    n = rng.random((h // 32 + 2, w // 32 + 2)).astype(np.float32)
    import cv2
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)[..., None]
    alpha = rng.uniform(0.3, 0.65) * np.clip(n, 0, 1)
    return (img * (1 - alpha) + 205 * alpha).clip(0, 255).astype(np.uint8)


def _noise(img, rng):
    return (img.astype(np.float32) + rng.normal(0, rng.uniform(12, 28), img.shape)).clip(0, 255).astype(np.uint8)


def _motion(img, rng):
    import cv2
    k = int(rng.integers(7, 21)) | 1
    ker = np.zeros((k, k), np.float32)
    ker[k // 2, :] = 1
    M = cv2.getRotationMatrix2D((k / 2 - 0.5, k / 2 - 0.5), float(rng.uniform(0, 180)), 1)
    ker = cv2.warpAffine(ker, M, (k, k))
    return cv2.filter2D(img, -1, ker / max(ker.sum(), 1e-6))


def _lowlight(img, rng):
    g = rng.uniform(1.8, 3.0)
    dark = 255 * (img.astype(np.float32) / 255) ** g
    return _noise(dark.astype(np.uint8), rng)


def _highangle(img, boxes, rng):
    """Top-down perspective squeeze; boxes are [(cid, cx, cy, w, h)] normalised."""
    import cv2
    h, w = img.shape[:2]
    t = rng.uniform(0.12, 0.28)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[w * t, h * 0.05], [w * (1 - t), h * 0.05], [w, h], [0, h]])
    M = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
    nb = []
    for c, cx, cy, bw, bh in boxes:
        x1, y1, x2, y2 = (cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h
        pts = cv2.perspectiveTransform(np.float32([[[x1, y1], [x2, y1], [x2, y2], [x1, y2]]]), M)[0]
        nx1, ny1 = np.clip(pts.min(0), 0, [w, h])
        nx2, ny2 = np.clip(pts.max(0), 0, [w, h])
        if (nx2 - nx1) * (ny2 - ny1) > 0.2 * (x2 - x1) * (y2 - y1):
            nb.append((c, (nx1 + nx2) / 2 / w, (ny1 + ny2) / 2 / h, (nx2 - nx1) / w, (ny2 - ny1) / h))
    return out, nb


def cmd_synth(a):
    import cv2
    root = Path(a.out).resolve()
    idir, ldir = root / "images" / "val_degraded", root / "labels" / "val_degraded"
    idir.mkdir(parents=True, exist_ok=True)
    ldir.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in iter_images(root / "images" / "val"):
        img = cv2.imread(str(p))
        if img is None:
            continue
        lab = root / "labels" / "val" / (p.stem + ".txt")
        boxes = [(int(x.split()[0]), *map(float, x.split()[1:5])) for x in lab.read_text().splitlines() if x.strip()]
        rng = np.random.default_rng(int(hashlib.md5(p.name.encode()).hexdigest()[:8], 16))
        variants = {"fog": (_fog(img, rng), boxes), "noise": (_noise(img, rng), boxes),
                    "motion": (_motion(img, rng), boxes), "dark": (_lowlight(img, rng), boxes),
                    "angle": _highangle(img, boxes, rng)}
        for vn, (vi, vb) in variants.items():
            cv2.imwrite(str(idir / f"{p.stem}__{vn}.jpg"), vi)
            (ldir / f"{p.stem}__{vn}.txt").write_text(
                "\n".join(f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for c, x, y, w, h in vb))
            n += 1
    d = yaml.safe_load(open(root / "data.yaml"))
    d["val"] = "images/val_degraded"
    yaml.dump(d, open(root / "data_degraded.yaml", "w"), sort_keys=False)
    print(f"[synth] wrote {n} degraded val images + data_degraded.yaml")


# ===========================================================================
# 3. TRAINING: two-stage fine-tune with industrial augmentation
# ===========================================================================
def industrial_hyp():
    """Colour semantics matter (hi-vis vests, fire) so hue jitter stays small; brightness varies a lot."""
    return dict(hsv_h=0.010, hsv_s=0.6, hsv_v=0.5, degrees=10.0, translate=0.1, scale=0.5, shear=2.0,
                perspective=0.0005, flipud=0.0, fliplr=0.5, mosaic=1.0, mixup=0.10)


def _first_ok(*makers):
    for m in makers:
        try:
            return m()
        except Exception:
            continue
    return None


def industrial_albumentations():
    """Pixel-level fog/dust/noise/blur/shadow/compression. Version-tolerant; skips what the installed lib lacks."""
    try:
        import albumentations as A
    except ImportError:
        print("[train] albumentations missing -> fog/noise augmentation skipped (pip install albumentations)")
        return None
    ts = [
        _first_ok(lambda: A.RandomFog(fog_coef_range=(0.1, 0.5), alpha_coef=0.1, p=0.25),
                  lambda: A.RandomFog(fog_coef_lower=0.1, fog_coef_upper=0.5, alpha_coef=0.1, p=0.25)),
        _first_ok(lambda: A.GaussNoise(std_range=(0.03, 0.1), p=0.25),
                  lambda: A.GaussNoise(var_limit=(10, 60), p=0.25)),
        _first_ok(lambda: A.MotionBlur(blur_limit=(3, 9), p=0.15)),
        _first_ok(lambda: A.RandomShadow(p=0.2)),
        _first_ok(lambda: A.RandomBrightnessContrast(0.3, 0.3, p=0.4)),
        _first_ok(lambda: A.CLAHE(p=0.1)),
        _first_ok(lambda: A.ImageCompression(quality_range=(40, 90), p=0.2),
                  lambda: A.ImageCompression(quality_lower=40, quality_upper=90, p=0.2)),
    ]
    return [t for t in ts if t is not None]


def cmd_train(a):
    from ultralytics import YOLO
    common = dict(data=a.data, imgsz=a.imgsz, batch=a.batch, device=a.device, workers=a.workers,
                  project=a.project, seed=0, plots=True, **industrial_hyp())
    aug = industrial_albumentations()

    def run(model, **kw):
        try:
            if aug:
                return model.train(augmentations=aug, **common, **kw)
        except (SyntaxError, KeyError, TypeError) as e:  # older ultralytics: no `augmentations` arg
            print(f"[train] custom augmentations unsupported here ({e.__class__.__name__}); using defaults")
        return model.train(**common, **kw)

    # Stage 1: freeze backbone, teach the (re-initialised) head the 9 new classes.
    m = YOLO(a.weights)
    run(m, name="s1_head", epochs=a.s1_epochs, freeze=a.freeze, optimizer="AdamW", lr0=1e-3, lrf=0.1,
        warmup_epochs=1, close_mosaic=0, patience=0)
    best1 = Path(m.trainer.save_dir) / "weights" / "best.pt"

    # Stage 2: unfreeze everything, low LR + cosine, turn mosaic off for the last epochs.
    m = YOLO(str(best1))
    run(m, name="s2_full", epochs=a.s2_epochs, optimizer="AdamW", lr0=2e-4, lrf=0.01, cos_lr=True,
        warmup_epochs=2, close_mosaic=10, patience=25)
    print("[train] best weights:", Path(m.trainer.save_dir) / "weights" / "best.pt")


# ===========================================================================
# 4. THRESHOLD CALIBRATION (asymmetric error costs, measured not assumed)
# ===========================================================================
def _iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u > 0 else 0.0


def _match_class(preds, gts, iou_thr=0.5):
    """Greedy match by confidence (prefix-consistent, so one pass serves every threshold)."""
    used, flags = set(), []
    for conf, box in sorted(preds, key=lambda x: -x[0]):
        best, bj = 0.0, -1
        for j, g in enumerate(gts):
            if j in used:
                continue
            v = _iou(box, g)
            if v > best:
                best, bj = v, j
        ok = best >= iou_thr
        if ok:
            used.add(bj)
        flags.append((conf, ok))
    return flags


def pick_thresholds(records, recall_target=0.98, ppe_min_precision=0.90):
    """
    records: [{"preds":[(cid, conf, xyxy)], "gts":[(cid, xyxy)]}]
    critical classes -> highest threshold whose IMAGE-level recall >= target (a fire anywhere in the frame counts)
    other classes    -> highest-recall threshold with box precision >= ppe_min_precision, else best F0.5
    """
    thr, report = {}, {}
    grid = np.arange(0.02, 0.96, 0.01)
    for cid, name in enumerate(CLASSES):
        if name in CRITICAL:
            pos, neg = [], []
            for r in records:
                mx = max([c for k, c, _ in r["preds"] if k == cid], default=0.0)
                (pos if any(k == cid for k, _ in r["gts"]) else neg).append(mx)
            if not pos:
                report[name] = {"warning": "no positive val images"}
                thr[name] = 0.10
                continue
            pos, neg = np.array(pos), np.array(neg or [0.0])
            rec = np.array([(pos >= t).mean() for t in grid])
            ok = np.where(rec >= recall_target)[0]
            t = float(grid[ok[-1]]) if len(ok) else float(grid[0])
            thr[name] = t
            report[name] = {"threshold": t, "image_recall": float((pos >= t).mean()),
                            "false_alarm_rate_on_negatives": float((neg >= t).mean()),
                            "n_pos": len(pos), "n_neg": len(neg), "target_met": bool(len(ok))}
        else:
            confs, tps, npos = [], [], 0
            for r in records:
                gts = [b for k, b in r["gts"] if k == cid]
                npos += len(gts)
                for c, ok in _match_class([(c, b) for k, c, b in r["preds"] if k == cid], gts):
                    confs.append(c)
                    tps.append(ok)
            if npos == 0:
                report[name] = {"warning": "no GT in val"}
                thr[name] = 0.5
                continue
            confs, tps = np.array(confs), np.array(tps, bool)
            best, bestscore = grid[len(grid) // 2], -1
            cand = []
            for t in grid:
                sel = confs >= t
                tp = int((tps & sel).sum())
                fp = int((~tps & sel).sum())
                p = tp / (tp + fp) if tp + fp else 0.0
                rc = tp / npos
                f05 = (1.25 * p * rc / (0.25 * p + rc)) if (p + rc) else 0.0
                cand.append((t, p, rc, f05))
            good = [c for c in cand if c[1] >= ppe_min_precision]
            t, p, rc, _ = max(good, key=lambda c: c[2]) if good else max(cand, key=lambda c: c[3])
            thr[name] = float(t)
            report[name] = {"threshold": float(t), "precision": float(p), "recall": float(rc), "n_gt": npos}
    return thr, report


def critical_report(records, thr):
    out = {}
    for name in CRITICAL:
        cid = CID[name]
        pos = [max([c for k, c, _ in r["preds"] if k == cid], default=0.0) for r in records
               if any(k == cid for k, _ in r["gts"])]
        neg = [max([c for k, c, _ in r["preds"] if k == cid], default=0.0) for r in records
               if not any(k == cid for k, _ in r["gts"])]
        out[name] = {"image_recall": float((np.array(pos) >= thr[name]).mean()) if pos else None,
                     "false_alarm_rate": float((np.array(neg) >= thr[name]).mean()) if neg else None,
                     "n_pos": len(pos), "n_neg": len(neg)}
    return out


def collect_records(model, img_dir, lbl_dir, imgsz, device, conf=0.02, batch=16):
    from PIL import Image
    paths = iter_images(img_dir)
    recs = []
    for i in range(0, len(paths), batch):
        chunk = paths[i:i + batch]
        res = model.predict([str(p) for p in chunk], conf=conf, iou=0.6, imgsz=imgsz, device=device, verbose=False)
        for p, r in zip(chunk, res):
            H, W = r.orig_shape
            preds = [(int(c), float(s), tuple(b)) for c, s, b in
                     zip(r.boxes.cls.tolist(), r.boxes.conf.tolist(), r.boxes.xyxy.tolist())]
            gts = []
            lp = Path(lbl_dir) / (p.stem + ".txt")
            if lp.exists():
                for line in lp.read_text().splitlines():
                    q = line.split()
                    if len(q) >= 5:
                        c, cx, cy, w, h = int(q[0]), *map(float, q[1:5])
                        gts.append((c, ((cx - w / 2) * W, (cy - h / 2) * H, (cx + w / 2) * W, (cy + h / 2) * H)))
            recs.append({"path": str(p), "preds": preds, "gts": gts})
    return recs


def _val_metrics(model, data, imgsz, device):
    m = model.val(data=data, imgsz=imgsz, device=device, plots=False, verbose=False)
    out = {"mAP50": float(m.box.map50), "mAP50-95": float(m.box.map), "per_class": {}}
    try:
        for i, ci in enumerate(m.box.ap_class_index):
            p, r, ap50, ap = m.box.class_result(i)
            out["per_class"][CLASSES[int(ci)]] = {"P": float(p), "R": float(r), "AP50": float(ap50)}
    except Exception:
        pass
    return out


def cmd_eval(a):
    from ultralytics import YOLO
    root, rep = Path(a.data).resolve(), Path(a.report_dir)
    rep.mkdir(parents=True, exist_ok=True)
    model = YOLO(a.weights)
    report = {"clean_val": _val_metrics(model, str(root / "data.yaml"), a.imgsz, a.device)}
    if (root / "data_degraded.yaml").exists():
        report["degraded_val"] = _val_metrics(model, str(root / "data_degraded.yaml"), a.imgsz, a.device)

    clean = collect_records(model, root / "images/val", root / "labels/val", a.imgsz, a.device)
    thr, cal = pick_thresholds(clean, a.fire_recall, a.ppe_precision)
    report["thresholds"], report["calibration"] = thr, cal
    json.dump(thr, open(rep / "thresholds.json", "w"), indent=2)
    if (root / "images/val_degraded").exists():
        deg = collect_records(model, root / "images/val_degraded", root / "labels/val_degraded", a.imgsz, a.device)
        report["critical_clean"] = critical_report(clean, thr)
        report["critical_degraded"] = critical_report(deg, thr)

    # Held-out corner-case folders: every image is a NEGATIVE for the listed class -> any hit = false positive
    cases = {}
    if a.sources:
        for name, c in (yaml.safe_load(open(a.sources)).get("corner_cases") or {}).items():
            paths = iter_images(c["path"])
            if not paths:
                continue
            floor = min(thr[f] for f in c["forbidden"])
            res = model.predict([str(p) for p in paths], conf=floor, imgsz=a.imgsz, device=a.device, verbose=False)
            fp = 0
            for r in res:
                fp += any(CLASSES[int(k)] in c["forbidden"] and s >= thr[CLASSES[int(k)]]
                          for k, s in zip(r.boxes.cls.tolist(), r.boxes.conf.tolist()))
            cases[name] = {"images": len(paths), "false_positive_rate": fp / len(paths), "forbidden": c["forbidden"]}
    report["corner_cases"] = cases
    json.dump(report, open(rep / "report.json", "w"), indent=2)
    print(json.dumps(report, indent=2))
    print(f"[eval] wrote {rep/'report.json'} and {rep/'thresholds.json'}")


# ===========================================================================
# 5. EDGE EXPORT + BENCHMARK
# ===========================================================================
def cmd_export(a):
    from ultralytics import YOLO
    m, outs = YOLO(a.weights), {}
    jobs = {"onnx": dict(format="onnx", imgsz=a.imgsz, simplify=True),
            "openvino_fp16": dict(format="openvino", imgsz=a.imgsz, half=True),
            "openvino_int8": dict(format="openvino", imgsz=a.imgsz, int8=True, data=a.data)}
    try:
        import torch
        if torch.cuda.is_available():
            jobs["tensorrt_fp16"] = dict(format="engine", imgsz=a.imgsz, half=True)  # build on the target Jetson/GPU
    except ImportError:
        pass
    for k, kw in jobs.items():
        try:
            outs[k] = str(m.export(**kw))
            print(f"[export] {k} -> {outs[k]}")
        except Exception as e:
            print(f"[export] {k} FAILED: {e}")
    json.dump(outs, open("exports.json", "w"), indent=2)


def cmd_bench(a):
    """Latency/FPS on THIS machine + accuracy of each exported artifact (quantisation can cost mAP)."""
    from ultralytics import YOLO
    exports = json.load(open(a.exports))
    imgs = [str(p) for p in iter_images(Path(a.data).parent / "images" / "val")[:a.n]]
    rows = {}
    for k, path in exports.items():
        try:
            m = YOLO(path, task="detect")
            m.predict(imgs[:3], imgsz=a.imgsz, verbose=False, device=a.device)  # warm-up
            t0 = time.perf_counter()
            for p in imgs:
                m.predict(p, imgsz=a.imgsz, verbose=False, device=a.device)
            ms = (time.perf_counter() - t0) / len(imgs) * 1000
            v = m.val(data=a.data, imgsz=a.imgsz, device=a.device, plots=False, verbose=False)
            rows[k] = {"ms_per_frame": round(ms, 1), "fps": round(1000 / ms, 1), "mAP50": round(float(v.box.map50), 4)}
        except Exception as e:
            rows[k] = {"error": str(e)}
    print(json.dumps(rows, indent=2))
    json.dump(rows, open("bench.json", "w"), indent=2)


# ===========================================================================
# 6. RUNTIME LOGIC: temporal voting + person-level PPE association + contextual alerts
# ===========================================================================
class TemporalVoter:
    """Fire on n hits within the last m frames. Fire: n=2,m=5 (fast). PPE: n=8,m=10 (stable)."""
    def __init__(self, n, m):
        self.n, self.h = n, deque(maxlen=m)

    def update(self, hit):
        self.h.append(bool(hit))
        return sum(self.h) >= self.n


def _center(b):
    return (b[0] + b[2]) / 2, (b[1] + b[3]) / 2


def _inside(pt, b):
    return b[0] <= pt[0] <= b[2] and b[1] <= pt[1] <= b[3]


def ppe_violations(dets, frame_h, min_person_h=0.12):
    """dets: [{"name","conf","box"}]. Returns set of missing items.
    helmet/gloves/boots: positive evidence only (bare head / no_gloves / no_boots detected inside a person box).
    vest: no explicit label exists, so absence = no vest box inside a large-enough person box."""
    persons = [d for d in dets if d["name"] == "person" and (d["box"][3] - d["box"][1]) / frame_h >= min_person_h]
    by = lambda n: [d for d in dets if d["name"] == n]
    ev = {"helmet": by("head"), "gloves": by("no_gloves"), "boots": by("no_boots")}
    vests = by("vest")
    missing = set()
    for p in persons:
        for item, boxes in ev.items():
            if any(_inside(_center(b["box"]), p["box"]) for b in boxes):
                missing.add(item)
        if not any(_inside(_center(v["box"]), p["box"]) for v in vests):
            missing.add("vest")
    return missing


def cmd_infer(a):
    import cv2
    from ultralytics import YOLO
    model, thr = YOLO(a.weights), json.load(open(a.thresholds))
    voters = {"fire": TemporalVoter(2, 5), "smoke": TemporalVoter(2, 5),
              "helmet": TemporalVoter(8, 10), "vest": TemporalVoter(8, 10),
              "gloves": TemporalVoter(8, 10), "boots": TemporalVoter(8, 10)}
    cap, fno, fps = cv2.VideoCapture(a.video), 0, None
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    floor = min(thr.values())
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        r = model.predict(frame, conf=floor, imgsz=a.imgsz, device=a.device, verbose=False)[0]
        dets = [{"name": CLASSES[int(k)], "conf": float(s), "box": tuple(b)} for k, s, b in
                zip(r.boxes.cls.tolist(), r.boxes.conf.tolist(), r.boxes.xyxy.tolist())]
        dets = [d for d in dets if d["conf"] >= thr[d["name"]]]
        names = {d["name"] for d in dets}
        t = f"{fno / fps:7.2f}s"
        for c in CRITICAL:
            if voters[c].update(c in names):
                print(f"{t} [CRITICAL] {a.camera}: {c.upper()} detected")
        miss = ppe_violations(dets, frame.shape[0])
        for item in ("helmet", "vest", "gloves", "boots"):
            if voters[item].update(item in miss):
                print(f"{t} [COMPLIANCE] {a.camera}: missing {item}")
        fno += 1


# ===========================================================================
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    p = sp.add_parser("prepare")
    p.add_argument("--sources", default="sources.yaml")
    p.add_argument("--out", default="datasets/factory_safety")
    p.add_argument("--val-pct", type=int, default=15)
    p.add_argument("--group-by-stem", action="store_true", help="keep video frames of one clip in the same split")
    p.add_argument("--force", action="store_true")
    p.set_defaults(f=cmd_prepare)

    p = sp.add_parser("synth")
    p.add_argument("--out", default="datasets/factory_safety")
    p.set_defaults(f=cmd_synth)

    p = sp.add_parser("train")
    p.add_argument("--data", default="datasets/factory_safety/data.yaml")
    p.add_argument("--weights", default="yolo11s.pt")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--device", default="0")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--project", default="runs/factory_safety")
    p.add_argument("--s1-epochs", type=int, default=15)
    p.add_argument("--s2-epochs", type=int, default=60)
    p.add_argument("--freeze", type=int, default=10)
    p.set_defaults(f=cmd_train)

    p = sp.add_parser("eval")
    p.add_argument("--weights", required=True)
    p.add_argument("--data", default="datasets/factory_safety")
    p.add_argument("--sources", default="sources.yaml")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default="0")
    p.add_argument("--report-dir", default="report")
    p.add_argument("--fire-recall", type=float, default=0.98)
    p.add_argument("--ppe-precision", type=float, default=0.90)
    p.set_defaults(f=cmd_eval)

    p = sp.add_parser("export")
    p.add_argument("--weights", required=True)
    p.add_argument("--data", default="datasets/factory_safety/data.yaml")
    p.add_argument("--imgsz", type=int, default=640)
    p.set_defaults(f=cmd_export)

    p = sp.add_parser("bench")
    p.add_argument("--exports", default="exports.json")
    p.add_argument("--data", default="datasets/factory_safety/data.yaml")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default="cpu")
    p.add_argument("--n", type=int, default=100)
    p.set_defaults(f=cmd_bench)

    p = sp.add_parser("infer")
    p.add_argument("--weights", required=True)
    p.add_argument("--thresholds", default="report/thresholds.json")
    p.add_argument("--video", required=True)
    p.add_argument("--camera", default="Sector-1")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default="cpu")
    p.set_defaults(f=cmd_infer)

    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
