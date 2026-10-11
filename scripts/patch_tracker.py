with open("edge/app/tracker.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '        elif viol_h_votes >= 3 and viol_h_votes > comp_h_votes:\n            self.helmet_status = "VIOLATION"',
    '        elif viol_h_votes >= 2 and viol_h_votes > comp_h_votes:\n            self.helmet_status = "VIOLATION"'
)
content = content.replace(
    '        elif viol_v_votes >= 3 and viol_v_votes > comp_v_votes:\n            self.vest_status = "VIOLATION"',
    '        elif viol_v_votes >= 2 and viol_v_votes > comp_v_votes:\n            self.vest_status = "VIOLATION"'
)

with open("edge/app/tracker.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated edge/app/tracker.py")
