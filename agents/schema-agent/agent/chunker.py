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
                        docstring = get_docstring(field)
                        field_name = field.name.value
                        # Build SDL for this field
                        lines = [f"type {defn.name.value} {{"]
                        if docstring:
                            lines.append(f"  \"\"\"{docstring}\"\"\"")
                        # Print field with its arguments and type
                        field_sdl = print_ast(field).strip()
                        lines.append(f"  {field_sdl}")
                        lines.append("}")
                        chunk = "\n".join(lines)
                        filename = f"{count:03d}_{category}_{field_name}.graphql"
                        Path(output_dir, filename).write_text(chunk + "\n")
                        count += 1
                else:
                    # For all other types, one file per object
                    chunk = print_ast(defn).strip()
                    filename = f"{count:03d}_{category}_{defn.name.value}.graphql"
                    Path(output_dir, filename).write_text(chunk + "\n")
                    count += 1
    print(f"✅ Chunked {count} total blocks into '{output_dir}'.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GraphQL chunker using graphql-core, with full docstring support.")
    parser.add_argument("--schema", required=True, help="Path to GraphQL SDL schema file")
    parser.add_argument("--out", default="chunks", help="Output directory for chunks")
    args = parser.parse_args()

    chunk_schema(args.schema, args.out)
