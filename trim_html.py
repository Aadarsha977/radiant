file_path = r'd:\Aadarsha\vs code\codebase\radient\radiant-dental-index.html'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

original_count = len(lines)
print(f'Original line count: {original_count}')

# Keep only first 767 lines
trimmed_lines = lines[:767]

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(trimmed_lines)

# Verify
with open(file_path, 'r', encoding='utf-8') as f:
    new_lines = f.readlines()

new_count = len(new_lines)
last_line = new_lines[-1].strip() if new_lines else ''

print(f'New line count: {new_count}')
print(f'Lines removed: {original_count - new_count}')
print(f'Last line content: {last_line}')
print(f'Verification: {"SUCCESS" if new_count == 767 and last_line == "</html>" else "FAILED"}')
