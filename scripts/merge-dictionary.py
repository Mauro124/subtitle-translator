#!/usr/bin/env python3
"""Merge dictionary-additions.json into dictionary.json."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "dictionary.json"), encoding="utf-8") as f:
    existing = json.load(f)

with open(os.path.join(ROOT, "dictionary-additions.json"), encoding="utf-8") as f:
    additions = json.load(f)

before = len(existing)
# additions do NOT overwrite existing entries
merged = {**additions, **existing}
merged = dict(sorted(merged.items()))
after = len(merged)

with open(os.path.join(ROOT, "dictionary.json"), "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"Before: {before} | Added: {after - before} | Total: {after}")
