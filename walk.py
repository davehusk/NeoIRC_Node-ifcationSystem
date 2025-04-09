import os

output_file = "project_code_dump.txt"
allowed_extensions = {".js", ".ejs", ".html"} # *.css
exclude_dirs = {"node_modules"}

def should_include(file_path):
    _, ext = os.path.splitext(file_path)
    return ext in allowed_extensions

def is_excluded(path):
    return any(part in exclude_dirs for part in path.split(os.sep))

with open(output_file, "w", encoding="utf-8") as out:
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]  # skip node_modules and any excluded dirs

        for file in files:
            file_path = os.path.join(root, file)
            if is_excluded(file_path) or not should_include(file):
                continue
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    rel_path = os.path.relpath(file_path, ".")
                    out.write(f"---/{rel_path.replace(os.sep, '/')}\n")
                    out.write(f.read())
                    out.write("\n---\n\n")
            except Exception as e:
                print(f"Skipped {file_path}: {e}")

print(f"Script/code files dumped to {output_file}")
