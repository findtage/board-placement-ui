import os
import json

INPUT_DIR = "assets/boards"
OUTPUT_FILE = os.path.join(INPUT_DIR, "boards_metadata.json")

metadata = {}

for dir_name in os.listdir(INPUT_DIR):
    dir_path = os.path.join(INPUT_DIR, dir_name)
    if not os.path.isdir(dir_path):
        continue

    # Expect folder name in format WxH, e.g., 100x36
    if "x" not in dir_name:
        continue

    try:
        splitX, splitY = map(int, dir_name.lower().split("x"))
    except ValueError:
        print(f"Skipping folder with invalid dimension format: {dir_name}")
        continue

    for file in os.listdir(dir_path):
        if not file.endswith(".png"):
            continue

        board_id = os.path.splitext(file)[0]
        rel_path = f"assets/boards/{dir_name}/{file}"

        metadata[board_id] = {
            "path": rel_path,
            "splitX": splitX,
            "splitY": splitY
        }

print(f"Found {len(metadata)} board entries.")

with open(OUTPUT_FILE, "w") as f:
    json.dump(metadata, f, indent=2)

print(f"✅ Metadata saved to {OUTPUT_FILE}")
