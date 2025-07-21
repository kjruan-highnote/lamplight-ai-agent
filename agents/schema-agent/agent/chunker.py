import re
from pathlib import Path

def extract_named_blocks(schema: str, keyword: str) -> list[tuple[str, str]]:
    pattern = re.compile(rf"{keyword} (\w+)\s*\{{", re.MULTILINE)
    blocks = []
    for match in pattern.finditer(schema):
        name = match.group(1)
        start = match.end() - 1
        depth = 0
        in_string = False
        i = start
        while i < len(schema):
            if schema[i:i+3] == '"""':
                in_string = not in_string
                i += 3
                continue
            if not in_string:
                if schema[i] == '{':
                    depth += 1
                elif schema[i] == '}':
                    depth -= 1
                    if depth == 0:
                        blocks.append((name, schema[match.start():i+1]))
                        break
            i += 1
    return blocks

def extract_fields_with_docstrings(type_body: str) -> list[tuple[str, str]]:
    pattern = re.compile(
        r'(?:(?P<docstring>"""[\s\S]+?""")\s*)?(?P<signature>\w+\s*\([^)]*\)|\w+)\s*:\s*[^\n]+',
        re.DOTALL
    )
    return [(m.group("docstring") or "", m.group("signature").strip()) for m in pattern.finditer(type_body)]

def chunk_schema(schema_path: str, output_dir: str):
    content = Path(schema_path).read_text()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    count = 0

    # Handle Query and Mutation fields individually
    pattern_qm = re.compile(r"type\s+(Query|Mutation)\s*\{([\s\S]*?)\}", re.DOTALL)
    for type_name, type_body in pattern_qm.findall(content):
        fields = extract_fields_with_docstrings(type_body)
        for docstring, signature in fields:
            field_name = re.match(r'(\w+)', signature).group(1)
            chunk = f"type {type_name} {{\n"
            if docstring:
                chunk += f"  {docstring.strip()}\n"
            chunk += f"  {signature}\n}}"
            filename = f"{count:03d}_{type_name}_{field_name}.graphql"
            Path(output_dir, filename).write_text(chunk + "\n")
            count += 1

    # Full-block types: input, enum, interface, union, scalar
    for keyword in ['input', 'enum', 'interface', 'union', 'scalar']:
        blocks = extract_named_blocks(content, keyword)
        for name, body in blocks:
            filename = f"{count:03d}_{keyword}_{name}.graphql"
            Path(output_dir, filename).write_text(body.strip() + "\n")
            count += 1

    print(f"✅ Chunked {count} total blocks into '{output_dir}'.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Safe GraphQL chunker with full multiline docstring support.")
    parser.add_argument("--schema", required=True, help="Path to GraphQL SDL schema file")
    parser.add_argument("--out", default="chunks", help="Output directory for chunks")
    args = parser.parse_args()

    chunk_schema(args.schema, args.out)
