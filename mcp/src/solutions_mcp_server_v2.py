#!/usr/bin/env python3
"""
Solutions MCP Server V2

Enhanced version that uses Postman collections as the source of truth for operations.
Automatically syncs from Postman collections on startup.
"""

import json
import logging
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Import sync utility
from postman_sync import PostmanToOperationsSync, PostmanOperationExtractor

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
SHIP_DIR = BASE_DIR / "agents" / "ship-agent"
POSTMAN_DIR = SHIP_DIR / "data" / "postman"
OPERATIONS_DIR = SHIP_DIR / "data" / "operations"
PROGRAMS_DIR = SHIP_DIR / "data" / "programs"


@dataclass
class PostmanOperation:
    """Represents an operation extracted from Postman"""
    name: str
    program_type: str
    operation_type: str  # query or mutation
    graphql: Dict[str, Any]
    category: str
    path: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None


@dataclass
class PostmanProgram:
    """Represents a program derived from Postman collection"""
    name: str
    program_type: str
    operations: List[PostmanOperation]
    categories: Dict[str, List[str]]  # category -> operation names
    total_operations: int
    last_synced: datetime


class SolutionsMCPServerV2:
    """
    Enhanced MCP Server that uses Postman collections as source of truth
    """
    
    def __init__(self, auto_sync: bool = True):
        """Initialize the Solutions MCP Server V2"""
        self.server = Server("lamplight-solutions-v2")
        self.postman_dir = POSTMAN_DIR
        self.operations_dir = OPERATIONS_DIR
        self.programs_dir = PROGRAMS_DIR
        
        # Auto-sync from Postman on startup
        if auto_sync:
            logger.info("Syncing from Postman collections...")
            self._sync_from_postman()
        
        # Load data
        logger.info("Loading Solutions MCP Server V2 data...")
        self.programs = self._load_programs_from_postman()
        self.operations = self._load_operations_from_postman()
        
        # Register MCP handlers
        self._register_handlers()
        
        logger.info(f"Solutions MCP Server V2 initialized:")
        logger.info(f"  - {len(self.programs)} programs from Postman")
        logger.info(f"  - {sum(len(ops) for ops in self.operations.values())} total operations")
        logger.info(f"  - Source: Postman collections (source of truth)")
    
    def _sync_from_postman(self):
        """Sync all Postman collections to operations files"""
        syncer = PostmanToOperationsSync(self.postman_dir, self.operations_dir)
        results = syncer.sync_all()
        logger.info(f"Synced {sum(c for c in results.values() if c >= 0)} operations from Postman")
    
    def _load_programs_from_postman(self) -> Dict[str, PostmanProgram]:
        """Load programs directly from Postman collections"""
        programs = {}
        
        for postman_file in self.postman_dir.glob("*.json"):
            try:
                with open(postman_file, 'r') as f:
                    collection = json.load(f)
                
                # Extract program info
                collection_name = collection.get('info', {}).get('name', postman_file.stem)
                program_type = self._normalize_program_name(collection_name)
                
                # Extract all operations
                operations = []
                categories = {}
                
                for item in collection.get('item', []):
                    ops = PostmanOperationExtractor.process_item(item, '', program_type)
                    for op in ops:
                        # Create PostmanOperation
                        operation = PostmanOperation(
                            name=op['name'],
                            program_type=program_type,
                            operation_type=op['operation_type'],
                            graphql=op['graphql'],
                            category=op['metadata'].get('category', 'uncategorized'),
                            path=op['metadata'].get('path', ''),
                            description=op['metadata'].get('description'),
                            tags=op['metadata'].get('tags', [])
                        )
                        operations.append(operation)
                        
                        # Track categories
                        cat = operation.category
                        if cat not in categories:
                            categories[cat] = []
                        categories[cat].append(operation.name)
                
                # Create program
                program = PostmanProgram(
                    name=collection_name,
                    program_type=program_type,
                    operations=operations,
                    categories=categories,
                    total_operations=len(operations),
                    last_synced=datetime.now()
                )
                
                programs[program_type] = program
                
            except Exception as e:
                logger.error(f"Failed to load program from {postman_file}: {e}")
        
        return programs
    
    def _load_operations_from_postman(self) -> Dict[str, List[PostmanOperation]]:
        """Load operations grouped by program from Postman"""
        operations = {}
        
        for program_type, program in self.programs.items():
            operations[program_type] = program.operations
        
        return operations
    
    def _normalize_program_name(self, name: str) -> str:
        """Normalize program name for consistency"""
        mappings = {
            'Consumer Credit': 'consumer_credit',
            'Trip.com': 'trip_com',
            'AP Automation': 'ap_automation',
            'Fleet': 'fleet'
        }
        
        if name in mappings:
            return mappings[name]
        
        return name.lower().replace(' ', '_').replace('.', '_').replace('-', '_')
    
    def _register_handlers(self):
        """Register MCP protocol handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List available MCP tools"""
            return [
                Tool(
                    name="list_programs",
                    description="List all programs from Postman collections",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="get_program_info",
                    description="Get program info from Postman collection",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {
                                "type": "string",
                                "description": "Program type (e.g., consumer_credit, trip_com)"
                            }
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="find_operations",
                    description="Search operations in Postman collections",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query"
                            },
                            "program_type": {
                                "type": "string",
                                "description": "Filter by program (optional)"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Max results",
                                "default": 10
                            }
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="get_operation_details",
                    description="Get full operation details from Postman",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "operation_name": {
                                "type": "string",
                                "description": "Operation name"
                            },
                            "program_type": {
                                "type": "string",
                                "description": "Program type"
                            }
                        },
                        "required": ["operation_name", "program_type"]
                    }
                ),
                Tool(
                    name="sync_from_postman",
                    description="Re-sync operations from Postman collections",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="get_postman_stats",
                    description="Get statistics about Postman collections",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool execution"""
            
            try:
                if name == "list_programs":
                    result = self._list_programs()
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_program_info":
                    result = self._get_program_info(arguments["program_type"])
                    return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
                
                elif name == "find_operations":
                    result = self._find_operations(
                        arguments["query"],
                        arguments.get("program_type"),
                        arguments.get("limit", 10)
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_operation_details":
                    result = self._get_operation_details(
                        arguments["operation_name"],
                        arguments["program_type"]
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
                
                elif name == "sync_from_postman":
                    self._sync_from_postman()
                    self.programs = self._load_programs_from_postman()
                    self.operations = self._load_operations_from_postman()
                    result = {
                        "status": "success",
                        "programs_loaded": len(self.programs),
                        "total_operations": sum(len(ops) for ops in self.operations.values())
                    }
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_postman_stats":
                    result = self._get_postman_stats()
                    return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
                
                else:
                    return [TextContent(
                        type="text",
                        text=json.dumps({"error": f"Unknown tool: {name}"})
                    )]
                    
            except Exception as e:
                logger.error(f"Error in tool {name}: {e}", exc_info=True)
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": str(e)})
                )]
    
    def _list_programs(self) -> Dict[str, Any]:
        """List all programs from Postman"""
        programs_list = []
        
        for prog_type, program in self.programs.items():
            programs_list.append({
                "program_type": prog_type,
                "name": program.name,
                "total_operations": program.total_operations,
                "categories": len(program.categories),
                "last_synced": program.last_synced.isoformat()
            })
        
        return {
            "programs": programs_list,
            "total": len(programs_list),
            "source": "Postman collections"
        }
    
    def _get_program_info(self, program_type: str) -> Dict[str, Any]:
        """Get detailed program information from Postman"""
        
        if program_type not in self.programs:
            return {"error": f"Program '{program_type}' not found"}
        
        program = self.programs[program_type]
        
        return {
            "name": program.name,
            "program_type": program.program_type,
            "total_operations": program.total_operations,
            "categories": {
                cat: {
                    "operations": ops,
                    "count": len(ops)
                }
                for cat, ops in program.categories.items()
            },
            "last_synced": program.last_synced.isoformat(),
            "source": "Postman collection"
        }
    
    def _find_operations(self, query: str, program_type: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """Find operations matching query"""
        results = []
        query_lower = query.lower()
        
        # Search in specified program or all
        search_programs = [program_type] if program_type and program_type in self.operations else self.operations.keys()
        
        for prog_type in search_programs:
            for op in self.operations[prog_type]:
                score = 0
                
                # Search in name
                if query_lower in op.name.lower():
                    score += 10
                
                # Search in category
                if query_lower in op.category.lower():
                    score += 5
                
                # Search in tags
                if op.tags:
                    for tag in op.tags:
                        if query_lower in tag.lower():
                            score += 3
                
                # Search in description
                if op.description and query_lower in op.description.lower():
                    score += 2
                
                if score > 0:
                    results.append({
                        "name": op.name,
                        "program_type": op.program_type,
                        "operation_type": op.operation_type,
                        "category": op.category,
                        "score": score
                    })
        
        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _get_operation_details(self, operation_name: str, program_type: str) -> Dict[str, Any]:
        """Get complete operation details"""
        
        if program_type not in self.operations:
            return {"error": f"Program '{program_type}' not found"}
        
        for op in self.operations[program_type]:
            if op.name == operation_name:
                return {
                    "name": op.name,
                    "program_type": op.program_type,
                    "operation_type": op.operation_type,
                    "category": op.category,
                    "path": op.path,
                    "description": op.description,
                    "tags": op.tags,
                    "graphql": op.graphql
                }
        
        return {"error": f"Operation '{operation_name}' not found in {program_type}"}
    
    def _get_postman_stats(self) -> Dict[str, Any]:
        """Get statistics about Postman collections"""
        stats = {
            "collections": len(self.programs),
            "total_operations": sum(p.total_operations for p in self.programs.values()),
            "programs": {}
        }
        
        for prog_type, program in self.programs.items():
            stats["programs"][prog_type] = {
                "name": program.name,
                "operations": program.total_operations,
                "categories": len(program.categories),
                "queries": sum(1 for op in program.operations if op.operation_type == "query"),
                "mutations": sum(1 for op in program.operations if op.operation_type == "mutation")
            }
        
        return stats
    
    async def run(self):
        """Run the MCP server"""
        logger.info("=" * 60)
        logger.info("Lamplight Solutions MCP Server V2")
        logger.info("=" * 60)
        logger.info("")
        logger.info("Using Postman collections as source of truth")
        logger.info(f"Loaded {len(self.programs)} programs")
        logger.info(f"Total operations: {sum(p.total_operations for p in self.programs.values())}")
        logger.info("")
        logger.info("Starting server...")
        logger.info("=" * 60)
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="lamplight-solutions-v2",
                    server_version="2.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(tools_changed=True),
                        experimental_capabilities={},
                    ),
                ),
            )


async def main():
    """Main entry point"""
    server = SolutionsMCPServerV2(auto_sync=True)
    await server.run()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())