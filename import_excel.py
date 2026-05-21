"""导入 tk.xlsx → src/data/questions.json"""
import json
from pathlib import Path
from openpyxl import load_workbook

SRC = Path("tk.xlsx")
OUT = Path("src/data")
OUT.mkdir(parents=True, exist_ok=True)

wb = load_workbook(SRC, data_only=True)
TYPE_MAP = {"单选题": "single", "多选题": "multiple", "填空题": "fill", "判断题": "bool"}

all_questions = []
for sheet_name in ["单选题", "多选题", "填空题", "判断题"]:
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    for i, row in enumerate(rows):
        qtype = TYPE_MAP[sheet_name]
        order = i + 1

        if qtype in ("single", "multiple"):
            seq, title, a, b, c, d, e, answer, analysis = row
            options = {
                k: str(v).strip()
                for k, v in {"A": a, "B": b, "C": c, "D": d, "E": e}.items()
                if v is not None and str(v).strip()
            }
        elif qtype == "fill":
            seq, title, answer, analysis = row
            options = {}
        elif qtype == "bool":
            seq, title, answer, analysis = row
            options = {"A": "对", "B": "错"}

        q = {
            "id": f"{qtype}-{order}",
            "type": qtype,
            "order": order,
            "title": str(title).strip() if title else "",
            "options": options,
            "answer": str(answer).strip().upper() if answer else "",
            "analysis": str(analysis).strip() if analysis else "",
        }
        all_questions.append(q)

with open(OUT / "questions.json", "w", encoding="utf-8") as f:
    json.dump(all_questions, f, ensure_ascii=False, indent=2)

print(f"Imported {len(all_questions)} questions → {OUT / 'questions.json'}")
