with open("edge/app/postprocess.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find line with "head_has_helmet = any("
for idx, line in enumerate(lines):
    if 'd.class_name in ("helmet", "head") and' in line:
        print(f"Found at line {idx+1}")
        lines[idx] = '                        d.class_name == "helmet" and\n'
    if 'elif rel_y <= 0.35:' in line and 'head level' in lines[idx+1]:
        print(f"Rel y found at line {idx+1}")
        lines[idx] = '                elif rel_y <= 0.38:\n'
    if 'if not head_has_helmet and item.confidence >= 0.40:' in line:
        print(f"Confidence found at line {idx+1}")
        lines[idx] = '                    if not head_has_helmet and item.confidence >= 0.35:\n'

# Find secondary NMS and insert bare head suppression
for idx, line in enumerate(lines):
    if 'if item.class_name == "no_boots":' in line:
        # find the end of this block
        end_idx = idx + 1
        while 'final_items.append(item)' not in lines[end_idx]:
            end_idx += 1
        insertion = [
            '        elif item.class_name == "head":\n',
            '            # If a helmet is detected in the head region, suppress bare-head detection (face under hardhat)\n',
            '            conflicts_helmet = any(\n',
            '                other.class_name == "helmet" and (\n',
            '                    calculate_iou(item.bbox, other.bbox) > 0.05 or\n',
            '                    abs(box_center(item.bbox)[0] - box_center(other.bbox)[0]) < 0.14\n',
            '                )\n',
            '                for other in validated_ppe if other is not item\n',
            '            )\n',
            '            if conflicts_helmet:\n',
            '                continue\n',
        ]
        lines = lines[:end_idx] + insertion + lines[end_idx:]
        print(f"Inserted bare-head suppression at line {end_idx+1}")
        break

with open("edge/app/postprocess.py", "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Saved edge/app/postprocess.py")
