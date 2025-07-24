#!/usr/bin/env python3
"""
Enhanced GraphQL schema chunker that groups operations by business domain.
Creates larger, more contextual chunks for better retrieval and LLM performance.
"""

import re
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
from graphql import parse, print_ast, ObjectTypeDefinitionNode, InterfaceTypeDefinitionNode, EnumTypeDefinitionNode, ScalarTypeDefinitionNode, InputObjectTypeDefinitionNode, UnionTypeDefinitionNode, DocumentNode, FieldDefinitionNode, OperationType, SchemaDefinitionNode
from graphql.language.printer import print_block_string

from .domain_mappings import DOMAIN_OPERATIONS, get_operation_domain, get_domain_description, get_related_types

class EnhancedGraphQLChunker:
    def __init__(self, schema_path: str, output_dir: str):
        self.schema_path = Path(schema_path)
        self.output_dir = Path(output_dir)
        self.doc = None
        self.domain_chunks = defaultdict(list)
        self.type_definitions = {}
        self.dependency_graph = defaultdict(set)
        
    def chunk_schema(self):
        """Main method to chunk the schema by domains."""
        print(f"📊 Loading schema from {self.schema_path}")
        content = self.schema_path.read_text()
        self.doc = parse(content)
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Phase 1: Index all type definitions
        self._index_type_definitions()
        
        # Phase 2: Build dependency graph
        self._build_dependency_graph()
        
        # Phase 3: Group operations by domain
        self._group_operations_by_domain()
        
        # Phase 4: Create domain chunks
        chunk_count = self._create_domain_chunks()
        
        print(f"✅ Created {chunk_count} domain-based chunks in '{self.output_dir}'")
        return chunk_count
        
    def _index_type_definitions(self):
        """Index all type definitions for easy lookup."""
        print("🔍 Indexing type definitions...")
        
        for defn in self.doc.definitions:
            if hasattr(defn, 'name') and defn.name:
                type_name = defn.name.value
                self.type_definitions[type_name] = defn
                
        print(f"📚 Indexed {len(self.type_definitions)} type definitions")
        
    def _build_dependency_graph(self):
        """Build a graph of type dependencies."""
        print("🔗 Building dependency graph...")
        
        for type_name, defn in self.type_definitions.items():
            # Extract referenced types from this definition
            referenced_types = self._extract_referenced_types(defn)
            self.dependency_graph[type_name] = referenced_types
            
    def _extract_referenced_types(self, defn) -> Set[str]:
        """Extract all type names referenced by a definition."""
        referenced = set()
        defn_str = print_ast(defn)
        
        # Match GraphQL type references (capitalized names)
        type_pattern = r'\\b([A-Z][a-zA-Z0-9_]*)'
        matches = re.findall(type_pattern, defn_str)
        
        for match in matches:
            # Filter out GraphQL keywords and scalars
            if match not in ['String', 'Int', 'Float', 'Boolean', 'ID', 'Query', 'Mutation', 'Subscription']:
                referenced.add(match)
                
        return referenced
        
    def _group_operations_by_domain(self):
        """Group mutations and queries by business domain."""
        print("🏗️ Grouping operations by domain...")
        
        for defn in self.doc.definitions:
            if isinstance(defn, ObjectTypeDefinitionNode):
                if defn.name.value == 'Query':
                    self._process_query_fields(defn)
                elif defn.name.value == 'Mutation':
                    self._process_mutation_fields(defn)
                    
    def _process_query_fields(self, query_defn):
        """Process Query type fields and group by domain."""
        for field in query_defn.fields or []:
            field_name = field.name.value
            domain = get_operation_domain(field_name)
            
            self.domain_chunks[domain].append({
                'type': 'query',
                'name': field_name,
                'definition': field,
                'parent': query_defn
            })
            
    def _process_mutation_fields(self, mutation_defn):
        """Process Mutation type fields and group by domain."""
        for field in mutation_defn.fields or []:
            field_name = field.name.value
            domain = get_operation_domain(field_name)
            
            self.domain_chunks[domain].append({
                'type': 'mutation',
                'name': field_name,
                'definition': field,
                'parent': mutation_defn
            })
            
    def _create_domain_chunks(self) -> int:
        """Create the actual chunk files grouped by domain."""
        print("📝 Creating domain chunk files...")
        
        chunk_count = 0
        
        for domain, operations in self.domain_chunks.items():
            if not operations:
                continue
                
            chunk_content = self._build_domain_chunk_content(domain, operations)
            
            # Create filename
            filename = f"{chunk_count:03d}_domain_{domain}.graphql"
            file_path = self.output_dir / filename
            
            # Write chunk file
            file_path.write_text(chunk_content)
            
            print(f"📄 Created {filename} with {len(operations)} operations")
            chunk_count += 1
            
        # Also create individual type chunks for non-operation types
        chunk_count += self._create_individual_type_chunks(chunk_count)
        
        return chunk_count
        
    def _build_domain_chunk_content(self, domain: str, operations: List[Dict]) -> str:
        """Build the content for a domain chunk."""
        lines = []
        
        # Add domain header with description
        domain_desc = get_domain_description(domain)
        lines.append(f'"""')
        lines.append(f'Domain: {domain.replace("_", " ").title()}')
        lines.append(f'')
        lines.append(f'{domain_desc}')
        lines.append(f'')
        lines.append(f'This chunk contains all operations and related types for {domain.replace("_", " ")}.')
        lines.append(f'"""')
        lines.append('')
        
        # Group by operation type
        mutations = [op for op in operations if op['type'] == 'mutation']
        queries = [op for op in operations if op['type'] == 'query']
        
        # Add mutations
        if mutations:
            lines.append('# ===== MUTATIONS =====')
            lines.append('')
            lines.append('type Mutation {')
            
            for op in mutations:
                field_def = op['definition']
                
                # Add docstring if available
                if hasattr(field_def, 'description') and field_def.description:
                    docstring = print_block_string(field_def.description.value)
                    lines.append(f'  """{docstring}"""')
                
                # Add field definition
                field_sdl = print_ast(field_def).strip()
                lines.append(f'  {field_sdl}')
                lines.append('')
                
            lines.append('}')
            lines.append('')
            
        # Add queries
        if queries:
            lines.append('# ===== QUERIES =====')
            lines.append('')
            lines.append('type Query {')
            
            for op in queries:
                field_def = op['definition']
                
                # Add docstring if available
                if hasattr(field_def, 'description') and field_def.description:
                    docstring = print_block_string(field_def.description.value)
                    lines.append(f'  """{docstring}"""')
                
                # Add field definition
                field_sdl = print_ast(field_def).strip()
                lines.append(f'  {field_sdl}')
                lines.append('')
                
            lines.append('}')
            lines.append('')
            
        # Add related types
        related_types = self._get_related_types_for_domain(domain, operations)
        if related_types:
            lines.append('# ===== RELATED TYPES =====')
            lines.append('')
            
            for type_name in sorted(related_types):
                if type_name in self.type_definitions:
                    type_def = self.type_definitions[type_name]
                    type_sdl = print_ast(type_def).strip()
                    lines.append(type_sdl)
                    lines.append('')
                    
        return '\\n'.join(lines)
        
    def _get_related_types_for_domain(self, domain: str, operations: List[Dict]) -> Set[str]:
        """Get all types related to operations in this domain."""
        related_types = set()
        
        # Get operation names
        operation_names = [op['name'] for op in operations]
        
        # Find input and output types for these operations
        for op in operations:
            field_def = op['definition']
            
            # Extract input types
            if field_def.arguments:
                for arg in field_def.arguments:
                    input_type = self._extract_type_name(print_ast(arg.type))
                    if input_type:
                        related_types.add(input_type)
                        # Add dependencies of input type
                        related_types.update(self._get_type_dependencies(input_type, max_depth=2))
            
            # Extract return types
            return_type = self._extract_type_name(print_ast(field_def.type))
            if return_type:
                related_types.add(return_type)
                # Add dependencies of return type
                related_types.update(self._get_type_dependencies(return_type, max_depth=2))
                
        # Add domain-specific related types from mappings
        domain_related = get_related_types(domain)
        for type_pattern in domain_related:
            if '*' in type_pattern:
                # Find matching types
                pattern = type_pattern.replace('*', '.*')
                for type_name in self.type_definitions.keys():
                    if re.match(pattern, type_name, re.IGNORECASE):
                        related_types.add(type_name)
            else:
                related_types.add(type_pattern)
        
        # Filter out basic GraphQL types
        related_types = {t for t in related_types if t in self.type_definitions}
        
        return related_types
        
    def _extract_type_name(self, type_str: str) -> Optional[str]:
        """Extract the base type name from a GraphQL type string."""
        # Remove array brackets and non-null indicators
        clean_type = re.sub(r'[\\[\\]!]', '', type_str).strip()
        
        # Return the base type name
        if clean_type and clean_type not in ['String', 'Int', 'Float', 'Boolean', 'ID']:
            return clean_type
        return None
        
    def _get_type_dependencies(self, type_name: str, max_depth: int) -> Set[str]:
        """Get dependencies of a type up to max_depth."""
        if max_depth <= 0 or type_name not in self.dependency_graph:
            return set()
            
        dependencies = set()
        direct_deps = self.dependency_graph[type_name]
        dependencies.update(direct_deps)
        
        # Recursively get dependencies
        for dep in direct_deps:
            if dep in self.type_definitions:
                sub_deps = self._get_type_dependencies(dep, max_depth - 1)
                dependencies.update(sub_deps)
                
        return dependencies
        
    def _create_individual_type_chunks(self, start_count: int) -> int:
        """Create individual chunks for types not covered by domain chunks."""
        chunk_count = 0
        covered_types = set()
        
        # Collect all types already covered in domain chunks
        for domain, operations in self.domain_chunks.items():
            related_types = self._get_related_types_for_domain(domain, operations)
            covered_types.update(related_types)
            
        # Create chunks for remaining types
        remaining_types = set(self.type_definitions.keys()) - covered_types
        
        type_categories = {
            'interfaces': InterfaceTypeDefinitionNode,
            'enums': EnumTypeDefinitionNode,
            'scalars': ScalarTypeDefinitionNode,
            'unions': UnionTypeDefinitionNode,
            'objects': ObjectTypeDefinitionNode
        }
        
        for category, node_type in type_categories.items():
            category_types = [
                name for name, defn in self.type_definitions.items()
                if isinstance(defn, node_type) and name in remaining_types
            ]
            
            if category_types:
                # Create chunk for this category
                filename = f"{start_count + chunk_count:03d}_types_{category}.graphql"
                file_path = self.output_dir / filename
                
                lines = [f'# {category.upper()} TYPES']
                lines.append('')
                
                for type_name in sorted(category_types):
                    type_def = self.type_definitions[type_name]
                    type_sdl = print_ast(type_def).strip()
                    lines.append(type_sdl)
                    lines.append('')
                    
                file_path.write_text('\\n'.join(lines))
                chunk_count += 1
                
        return chunk_count

def chunk_schema_enhanced(schema_path: str, output_dir: str) -> int:
    """Enhanced schema chunking function."""
    chunker = EnhancedGraphQLChunker(schema_path, output_dir)
    return chunker.chunk_schema()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced GraphQL chunker with domain-based grouping")
    parser.add_argument("--schema", required=True, help="Path to GraphQL SDL schema file")
    parser.add_argument("--out", default="enhanced_chunks", help="Output directory for chunks")
    args = parser.parse_args()
    
    chunk_count = chunk_schema_enhanced(args.schema, args.out)
    print(f"\\n🎉 Successfully created {chunk_count} enhanced chunks!")