#!/usr/bin/env python3
"""
patch-context.py — Apply context-aware patches to existing dictionary entries.

Adds translation_start, translation_end, translation_question fields and
connector tags to words that benefit from position/context-aware translations.

Usage:
    python3 scripts/patch-context.py
"""

import json
import os

DICT_PATH = os.path.join(os.path.dirname(__file__), '..', 'dictionary.json')
PATCHES_PATH = os.path.join(os.path.dirname(__file__), '..', 'context-patches.json')

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def apply_patches(dictionary, patches):
    added_new = 0
    updated = 0

    for key, patch in patches.items():
        if key in dictionary:
            entry = dictionary[key]
            changed = False

            # Apply context translation fields
            for field in ('translation_start', 'translation_end', 'translation_question'):
                if field in patch and field not in entry:
                    entry[field] = patch[field]
                    changed = True

            # Merge tags (add without duplicating)
            if 'tags_add' in patch:
                existing = set(entry.get('tags', []))
                new_tags = set(patch['tags_add'])
                merged = list(existing | new_tags)
                if sorted(merged) != sorted(list(existing)):
                    entry['tags'] = sorted(merged)
                    changed = True

            if changed:
                updated += 1
        else:
            # Entry doesn't exist yet — create it
            new_entry = {k: v for k, v in patch.items() if k != 'tags_add'}
            if 'tags_add' in patch:
                new_entry['tags'] = patch['tags_add']
            if 'translation' not in new_entry:
                print(f"  SKIP (no translation): {key}")
                continue
            dictionary[key] = new_entry
            added_new += 1

    return updated, added_new

def main():
    dictionary = load_json(DICT_PATH)
    patches = load_json(PATCHES_PATH)

    before = len(dictionary)
    updated, added = apply_patches(dictionary, patches)

    # Sort alphabetically
    dictionary = dict(sorted(dictionary.items()))
    save_json(DICT_PATH, dictionary)

    print(f"Before: {before} | Updated: {updated} | Added new: {added} | Total: {len(dictionary)}")

if __name__ == '__main__':
    main()
