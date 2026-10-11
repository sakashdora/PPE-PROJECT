with open("edge/app/association.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("\r\n", "\n")

old_policy = """        # 4.1 HELMET STATUS:
        # Rule A: If a helmet is associated with this worker, they are COMPLIANT.
        # (Even if a bare head box was also detected, the helmet presence overrides bare head!)
        if a.has_helmet:
            a.helmet_status = "COMPLIANT"
        # Rule B: If no helmet is found, but a clear bare head detection exists with sufficient confidence:
        elif a.has_head_detection and a.head_confidence >= 0.35:
            a.helmet_status = "VIOLATION"
            a.missing_items.append("helmet")
            a.violations.append("NO_HELMET")
        # Rule C: Neither helmet nor bare head detected:
        # e.g., occluded worker, worker facing away, head outside frame
        else:
            # If the person box is tall and unobstructed at the top, but neither helmet nor head was detected,
            # we classify as UNKNOWN to prevent false violations or false compliance.
            a.helmet_status = "UNKNOWN"

        # 4.2 VEST STATUS:
        if a.has_vest:
            a.vest_status = "COMPLIANT"
        else:
            # If upper body / head is confirmed in the frame (helmet or head detected)
            # and no vest is detected: worker is visibly lacking mandatory vest!
            if (a.has_helmet or a.has_head_detection) and "vest" in required_ppe:
                a.vest_status = "VIOLATION"
                a.missing_items.append("vest")
                a.violations.append("NO_VEST")
            else:
                # Occluded worker or upper body not confirmed
                a.vest_status = "UNKNOWN"

        # 4.3 OVERALL SAFETY STATUS:
        if a.helmet_status == "VIOLATION" or a.vest_status == "VIOLATION":
            a.safety_status = "VIOLATION"
        elif a.helmet_status == "COMPLIANT" and a.vest_status == "COMPLIANT":
            a.safety_status = "COMPLIANT"
        elif a.helmet_status == "COMPLIANT" and "vest" not in required_ppe:
            a.safety_status = "COMPLIANT"
        else:
            a.safety_status = "UNKNOWN" """

new_policy = """        # 4.1 HELMET STATUS:
        # Rule A: If a helmet is associated with this worker, they are COMPLIANT.
        # (Helmet presence strictly overrides any overlapping bare head/face detections!)
        if a.has_helmet:
            a.helmet_status = "COMPLIANT"
            a.has_head_detection = False
        # Rule B: If no helmet is found, but a clear bare head detection exists with confident threshold:
        elif a.has_head_detection and a.head_confidence >= 0.45:
            a.helmet_status = "VIOLATION"
            a.missing_items.append("helmet")
            a.violations.append("NO_HELMET")
        # Rule C: Neither helmet nor bare head detected (occluded worker, back turned, distant):
        else:
            a.helmet_status = "UNKNOWN"

        # 4.2 VEST STATUS:
        if a.has_vest:
            a.vest_status = "COMPLIANT"
        else:
            # Only classify missing vest as violation when upper body is confirmed and worker is close enough (ph >= 0.22)
            if (a.has_helmet or a.has_head_detection) and "vest" in required_ppe and ph >= 0.22:
                a.vest_status = "VIOLATION"
                a.missing_items.append("vest")
                a.violations.append("NO_VEST")
            else:
                # Distant worker, thermal coat, or upper body not resolvable
                a.vest_status = "UNKNOWN"

        # 4.3 OVERALL SAFETY STATUS:
        if a.helmet_status == "VIOLATION" or a.vest_status == "VIOLATION":
            a.safety_status = "VIOLATION"
        elif a.helmet_status == "COMPLIANT" and (a.vest_status == "COMPLIANT" or "vest" not in required_ppe):
            a.safety_status = "COMPLIANT"
        else:
            a.safety_status = "UNKNOWN" """

if old_policy.strip() in content:
    content = content.replace(old_policy.strip(), new_policy.strip(), 1)
    print("Replaced compliance policy in association.py")
else:
    # try normalized
    print("Direct match failed, replacing section...")
    idx_start = content.find("# 4.1 HELMET STATUS:")
    idx_end = content.find("return assessments")
    if idx_start != -1 and idx_end != -1:
        content = content[:idx_start] + new_policy.strip() + "\n\n    " + content[idx_end:]
        print("Replaced section via boundaries!")

with open("edge/app/association.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated edge/app/association.py")
