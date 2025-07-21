import re
from pathlib import Path
from typing import List, Tuple

def extract_fields_with_docstrings(type_body: str) -> List[Tuple[str, str]]:
    """
    Extracts fields with optional docstrings from a type block.
    Returns a list of (docstring, field_signature) tuples.
    """
    pattern = re.compile(
        r'(?:(?P<docstring>"""[\s\S]+?""")\s*)?(?P<signature>\w+\s*\([^)]*\)|\w+)\s*:\s*[^\n]+',
        re.DOTALL
    )
    return [(m.group("docstring") or "", m.group("signature").strip()) for m in pattern.finditer(type_body)]

def chunk_schema(schema_path: str, output_dir: str):
    """
    Parses a GraphQL SDL schema file and writes separate chunk files for:
    - each Query/Mutation field
    - each full input, enum, interface, union, and scalar block
    """
    content = Path(schema_path).read_text()
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    count = 0

    # Chunk each Query/Mutation field individually
    qmt_pattern = re.compile(r'type\s+(Query|Mutation)\s*\{([\s\S]*?)\}', re.DOTALL)
    for type_name, type_body in qmt_pattern.findall(content):
        fields = extract_fields_with_docstrings(type_body)
        for docstring, signature in fields:
            field_name_match = re.match(r'(\w+)', signature)
            if field_name_match:
                field_name = field_name_match.group(1)
            else:
                field_name = "unknown"
            chunk = f"type {type_name} {{\n"
            if docstring:
                chunk += f"  {docstring.strip()}\n"
            chunk += f"  {signature}\n}}"
            filename = f"{count:03d}_{type_name}_{field_name}.graphql"
            Path(output_dir, filename).write_text(chunk + "\n")
            count += 1

    # Generic block chunking (input, enum, interface, union, scalar)
    def chunk_block(keyword: str, label: str):
        nonlocal count
        pattern = re.compile(rf'({keyword}\s+\w+\s*\{{[\s\S]*?\}})', re.DOTALL)
        for match in pattern.findall(content):
            name_match = re.match(rf'{keyword}\s+(\w+)', match)
            if name_match:
                name = name_match.group(1)
                filename = f"{count:03d}_{label}_{name}.graphql"
                Path(output_dir, filename).write_text(match.strip() + "\n")
                count += 1

    chunk_block('input', 'input')
    chunk_block('enum', 'enum')
    chunk_block('interface', 'interface')
    chunk_block('union', 'union')
    chunk_block('scalar', 'scalar')

    print(f"✅ Chunked {count} total blocks into '{output_dir}'.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Chunk GraphQL SDL types into separate files.")
    parser.add_argument("--schema", required=True, help="Path to GraphQL SDL schema file")
    parser.add_argument("--out", default="chunks", help="Output directory for chunks")
    args = parser.parse_args()

    chunk_schema(args.schema, args.out)
