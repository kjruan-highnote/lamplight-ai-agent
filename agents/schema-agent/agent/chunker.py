import re
from pathlib import Path
from graphql import parse, print_ast, ObjectTypeDefinitionNode, InterfaceTypeDefinitionNode, EnumTypeDefinitionNode, ScalarTypeDefinitionNode, InputObjectTypeDefinitionNode, UnionTypeDefinitionNode, DocumentNode, FieldDefinitionNode, OperationType, SchemaDefinitionNode
from graphql.language.printer import print_block_string

CATEGORY_MAP = {
    'queries': ObjectTypeDefinitionNode,
    'mutations': ObjectTypeDefinitionNode,
    'objects': ObjectTypeDefinitionNode,
    'interfaces': InterfaceTypeDefinitionNode,
    'enums': EnumTypeDefinitionNode,
    'scalars': ScalarTypeDefinitionNode,
    'inputs': InputObjectTypeDefinitionNode,
    'unions': UnionTypeDefinitionNode,
}

CATEGORY_FILTERS = {
    'queries': lambda node: getattr(node, 'name', None) and node.name.value == 'Query',
    'mutations': lambda node: getattr(node, 'name', None) and node.name.value == 'Mutation',
    'objects': lambda node: isinstance(node, ObjectTypeDefinitionNode) and node.name.value not in ['Query', 'Mutation'],
    'interfaces': lambda node: isinstance(node, InterfaceTypeDefinitionNode),
    'enums': lambda node: isinstance(node, EnumTypeDefinitionNode),
    'scalars': lambda node: isinstance(node, ScalarTypeDefinitionNode),
    'inputs': lambda node: isinstance(node, InputObjectTypeDefinitionNode),
    'unions': lambda node: isinstance(node, UnionTypeDefinitionNode),
}

def get_docstring(node):
    if hasattr(node, 'description') and node.description:
        return print_block_string(node.description.value)
    return None

def optimize_graphql_content(content: str) -> str:
    """Optimize GraphQL content for token efficiency while preserving semantics"""
    lines = content.split('\n')
    optimized_lines = []
    prev_line = None
    
    for line in lines:
        # Remove excessive whitespace but preserve structure
        stripped = line.strip()
        if not stripped:
            continue
            
        # Remove duplicate docstring markers (""""""" -> """)
        if '"""""""' in stripped:
            stripped = stripped.replace('"""""""', '"""')
        elif '""""""' in stripped:
            stripped = stripped.replace('""""""', '"""')
        
        # Skip duplicate docstring lines
        if stripped.startswith('"""') and prev_line and prev_line.strip() == stripped:
            continue
            
        # Preserve minimal indentation for readability
        if line.startswith('  ') and not line.startswith('    '):
            formatted_line = '  ' + stripped
        elif line.startswith('    '):
            formatted_line = '    ' + stripped
        else:
            formatted_line = stripped
            
        optimized_lines.append(formatted_line)
        prev_line = line
    
    return '\n'.join(optimized_lines)

def chunk_schema(schema_path: str, output_dir: str):
    content = Path(schema_path).read_text()
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    doc = parse(content)
    count = 0
    for category, node_type in CATEGORY_MAP.items():
        for defn in doc.definitions:
            if CATEGORY_FILTERS[category](defn):
                # For Query/Mutation, split by field
                if category in ['queries', 'mutations']:
                    for field in defn.fields or []:
                        field_name = field.name.value
                        # Build SDL for this field - print_ast already includes docstring
                        lines = [f"type {defn.name.value} {{"]
                        # Print field with its arguments and type
                        field_sdl = print_ast(field).strip()
                        lines.append(f"  {field_sdl}")
                        lines.append("}")
                        chunk = "\n".join(lines)
                        # Optimize chunk for token efficiency
                        optimized_chunk = optimize_graphql_content(chunk)
                        filename = f"{count:03d}_{category}_{field_name}.graphql"
                        Path(output_dir, filename).write_text(optimized_chunk + "\n")
                        count += 1
                else:
                    # For all other types, one file per object
                    chunk = print_ast(defn).strip()
                    # Optimize chunk for token efficiency
                    optimized_chunk = optimize_graphql_content(chunk)
                    filename = f"{count:03d}_{category}_{defn.name.value}.graphql"
                    Path(output_dir, filename).write_text(optimized_chunk + "\n")
                    count += 1
    print(f"✅ Chunked {count} total blocks into '{output_dir}'.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GraphQL chunker using graphql-core, with full docstring support.")
    parser.add_argument("--schema", required=True, help="Path to GraphQL SDL schema file")
    parser.add_argument("--out", default="chunks", help="Output directory for chunks")
    args = parser.parse_args()

    chunk_schema(args.schema, args.out)
