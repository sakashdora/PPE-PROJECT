"""
Factory Safety AI - ARGUS AI
End-to-End API Integration Verification
Uploads Test_video to Forensics Streaming API and validates all SSE events.
"""

import sys
import json
import time
import requests
from pathlib import Path

def test_stream_api():
    root = Path(__file__).resolve().parent.parent
    video_path = root / "Test_video" / "19832492-hd_1920_1080_25fps (1).mp4"
    if not video_path.exists():
        print(f"[FAIL] Video file not found: {video_path}")
        return False

    url = "http://127.0.0.1:8090/forensics/stream"
    headers = {"x-edge-api-key": "edge-api-key-factory-plant-01"}

    print(f"[*] Sending {video_path.name} to {url}...")
    t0 = time.time()
    
    with open(video_path, "rb") as f:
        files = {"files": (video_path.name, f, "video/mp4")}
        response = requests.post(url, headers=headers, files=files, stream=True, timeout=120)

    if response.status_code != 200:
        print(f"[FAIL] Unexpected status code: {response.status_code} - {response.text}")
        return False

    print(f"[*] Response received ({response.status_code}). Reading SSE events...")
    
    events = []
    frame_events = 0
    done_payload = None

    for line in response.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("data:"):
            payload = json.loads(line[5:].strip())
            etype = payload.get("type")
            events.append(etype)
            if etype == "start":
                print(f"  -> [START] Frames: {payload.get('total_frames')}, FPS: {payload.get('fps')}, Duration: {payload.get('duration_sec')}s")
            elif etype == "frame":
                frame_events += 1
                if frame_events % 10 == 0:
                    print(f"  -> [FRAME {frame_events}] TS: {payload.get('ts')}s, Active Workers: {payload.get('stats', {}).get('active_workers')}, Compliant: {payload.get('stats', {}).get('compliant_workers')}")
            elif etype == "alert":
                print(f"  -> [ALERT] {payload.get('severity')} - {payload.get('class')}: {payload.get('desc')} @ {payload.get('ts')}s")
            elif etype == "done":
                done_payload = payload
                print(f"  -> [DONE] Final Compliance Score: {payload.get('compliance_score')}%, Unique Workers: {payload.get('unique_workers')}")
            elif etype == "all_done":
                print(f"  -> [ALL_DONE]")

    elapsed = round(time.time() - t0, 2)
    print(f"[*] Stream finished in {elapsed}s. Received {len(events)} events ({frame_events} frames).")

    # Assertions
    assert "start" in events, "Missing 'start' SSE event"
    assert "done" in events, "Missing 'done' SSE event"
    assert done_payload is not None, "Missing done payload"
    
    unique_workers = done_payload.get("unique_workers", 0)
    compliance_score = done_payload.get("compliance_score", 0)
    worker_records = done_payload.get("worker_records", [])

    print("\n--- Final Video Verification Report ---")
    print(f"Total Unique Workers: {unique_workers}")
    print(f"Overall Compliance Score: {compliance_score}%")
    for w in worker_records:
        print(f"  Worker #{w.get('track_id'):03d}: helmet={w.get('helmet')}, vest={w.get('vest')}, safety={w.get('safety_status')}")

    # Check for helmet detection accuracy on Worker 1 and Worker 2
    w1 = next((w for w in worker_records if w.get("track_id") == 1), None)
    w2 = next((w for w in worker_records if w.get("track_id") == 2), None)

    assert w1 is not None, "Worker #001 track not found"
    assert w1.get("helmet") == "COMPLIANT", f"Worker #001 helmet status should be COMPLIANT, got {w1.get('helmet')}"
    print("[PASS] Worker #001 Helmet: Verified COMPLIANT")

    if w2 is not None:
        assert w2.get("helmet") == "COMPLIANT", f"Worker #002 helmet status should be COMPLIANT, got {w2.get('helmet')}"
        print("[PASS] Worker #002 Helmet: Verified COMPLIANT")

    print("[PASS] E2E Video Forensics Stream verification PASSED!")
    return True

if __name__ == "__main__":
    success = test_stream_api()
    sys.exit(0 if success else 1)
