import cv2
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "edge"))
from app.config import ThresholdsConfig
from app.infer import ONNXRuntimeEngine
from app.postprocess import filter_and_validate_detections
from app.association import associate_person_ppe_v2

engine = ONNXRuntimeEngine("models/best_s5.onnx", ThresholdsConfig())

for vpath in ["Test_video/16511598_1080_1920_60fps.mp4", "Test_video/19832492-hd_1920_1080_25fps (1).mp4"]:
    cap = cv2.VideoCapture(vpath)
    fcount = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"\n==========================================")
    print(f"File: {vpath}")
    print(f"Res: {w}x{h}, FPS: {fps:.1f}, Frames: {fcount}, Duration: {fcount/fps:.1f}s")
    print(f"==========================================")
    
    sample_indices = [int(fcount * p) for p in [0.0, 0.1, 0.25, 0.5, 0.75, 0.9]]
    for fidx in sample_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, fidx)
        ret, frame = cap.read()
        if not ret:
            continue
        raw = engine.infer(frame)
        val = filter_and_validate_detections(raw)
        persons = [d for d in val if d.class_name == "person"]
        ppes = [d for d in val if d.class_name != "person"]
        assessments = associate_person_ppe_v2(persons, ppes)
        print(f"--- Frame {fidx} ({fidx/fps:.2f}s) ---")
        print(f"  Raw: {[d.class_name + f':{d.confidence:.2f}' for d in raw]}")
        print(f"  Val: {[d.class_name + f':{d.confidence:.2f}' for d in val]}")
        for idx, a in enumerate(assessments):
            print(f"  Worker {idx+1}: safety={a.safety_status}, helmet={a.helmet_status}({a.helmet_confidence:.2f}), vest={a.vest_status}({a.vest_confidence:.2f})")
    cap.release()
