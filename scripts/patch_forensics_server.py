with open("edge/app/forensics_server.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("\r\n", "\n")

old_badge = """        # Compact label badge
        h_tag = "HELMET OK" if trk.helmet_status == "COMPLIANT" else ("NO HELMET" if trk.helmet_status == "VIOLATION" else "HELMET ?")
        v_tag = "VEST OK" if trk.vest_status == "COMPLIANT" else ("NO VEST" if trk.vest_status == "VIOLATION" else "VEST ?")
        b_status = getattr(trk, "boots_status", "UNKNOWN")
        b_tag = "BOOTS OK" if b_status == "COMPLIANT" else ("NO BOOTS" if b_status == "VIOLATION" else "BOOTS ?")
        lbl = f"ID #{trk.track_id:03d} | {h_tag} | {v_tag} | {b_tag}"

        (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
        by1 = py1 - th - 2 * pad_y
        by2 = py1
        text_y = py1 - pad_y
        if by1 < 0:
            by1 = py1
            by2 = py1 + th + 2 * pad_y
            text_y = py1 + th + pad_y"""

new_badge = """        # Compact label badge
        h_tag = "HELMET OK" if trk.helmet_status == "COMPLIANT" else ("NO HELMET" if trk.helmet_status == "VIOLATION" else "HELMET ?")
        v_tag = "VEST OK" if trk.vest_status == "COMPLIANT" else ("NO VEST" if trk.vest_status == "VIOLATION" else "VEST ?")
        lbl = f"ID #{trk.track_id:03d} | {h_tag} | {v_tag}"
        b_status = getattr(trk, "boots_status", "UNKNOWN")
        if b_status == "COMPLIANT":
            lbl += " | BOOTS OK"
        elif b_status == "VIOLATION":
            lbl += " | NO BOOTS"
        g_status = getattr(trk, "gloves_status", "UNKNOWN")
        if g_status == "COMPLIANT":
            lbl += " | GLOVES OK"
        elif g_status == "VIOLATION":
            lbl += " | NO GLOVES"

        (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
        by1 = py1 - th - 2 * pad_y
        by2 = py1
        text_y = py1 - pad_y
        if by1 < 50:
            by1 = max(52, py1)
            by2 = by1 + th + 2 * pad_y
            text_y = by1 + th + pad_y"""

assert old_badge in content, "old_badge not found in forensics_server.py"
content = content.replace(old_badge, new_badge, 1)

with open("edge/app/forensics_server.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated edge/app/forensics_server.py badge layout")
