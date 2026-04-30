#!/usr/bin/env python
# Read the file
file_path = r'd:\Aadarsha\vs code\codebase\radient\radiant-dental-index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines in file: {len(lines)}")

# Keep only lines 1-767 (first 767 lines)
trimmed_lines = lines[:767]

print(f"Keeping lines 1-767, total: {len(trimmed_lines)} lines")

# Write back to the same file
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(trimmed_lines)

print(f"File successfully trimmed and written back.")

# Verify the operation
with open(file_path, 'r', encoding='utf-8') as f:
    final_lines = f.readlines()

print(f"Verification - File now contains {len(final_lines)} lines")
print("Success: File has been trimmed to exactly 767 lines")
