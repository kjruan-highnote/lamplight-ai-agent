"""
Hybrid MCP Server - Direct integration with agent code as libraries

This approach:
1. Runs as a SINGLE process (easy deployment)
2. Directly imports and uses existing agent code (no duplication)
3. No network overhead (all in-memory)
4. Fully portable (one process, one config)
"""

import asyncio
import sys
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add agent directories to Python path
BASE_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE_DIR / "agents" / "schema-agent"))
sys.path.insert(0, str(BASE_DIR / "agents" / "document-agent"))
sys.path.insert(0, str(BASE_DIR / "agents" / "advisory-agent"))
sys.path.insert(0, str(BASE_DIR / "agents" / "ship-agent"))

# Import MCP components
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Import existing agent components directly
from src.retriever import Retriever as SchemaRetriever
from src.llm_agent import LLMAgent as SchemaLLMAgent
from src.doc_llm_agent import DocLLMAgent
from src.faiss_retriever import FAISSDocumentRetriever
from src.agent_router import AgentRouter
from src.query_classifier import QueryClassifier as AdvisoryClassifier
from src.solutions_document_generator import SolutionsDocumentGenerator
from src.unified_generator import UnifiedGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HybridMCPServer:
    """
    Hybrid MCP Server that uses existing agent code as libraries
    
    Benefits:
    1. Single process - easy to deploy anywhere
    2. No code duplication - uses existing agent implementations
    3. No network overhead - everything runs in-memory
    4. Maintains all optimizations from original agents
    5. Easy to package and distribute (single Python app)
    """
    
    def __init__(self):
        self.server = Server("lamplight-hybrid")
        
        # Initialize agent components (using existing code)
        logger.info("Initializing agent components...")
        
        # Schema Agent components
        self.schema_retriever = SchemaRetriever(
            schema_path=str(BASE_DIR / "agents" / "schema-agent" / "schema" / "highnote.graphql"),
            embeddings_dir=str(BASE_DIR / "agents" / "schema-agent" / "embeddings")
        )
        self.schema_agent = SchemaLLMAgent(
            retriever=self.schema_retriever,
            model_name="llama3"
        )
        
        # Document Agent components
        self.doc_retriever = FAISSDocumentRetriever(
            chunks_dir=str(BASE_DIR / "agents" / "document-agent" / "data" / "chunks"),
            index_path=str(BASE_DIR / "agents" / "document-agent" / "data" / "faiss_index")
        )
        self.doc_agent = DocLLMAgent(
            retriever=self.doc_retriever,
            model_name="llama3"
        )
        
        # Advisory Agent components
        self.query_classifier = AdvisoryClassifier()
        self.agent_router = AgentRouter(
            schema_agent=self.schema_agent,
            doc_agent=self.doc_agent
        )
        
        # Ship Agent components
        self.solutions_generator = SolutionsDocumentGenerator(
            operations_dir=str(BASE_DIR / "agents" / "ship-agent" / "data")
        )
        self.unified_generator = UnifiedGenerator(
            config_dir=str(BASE_DIR / "agents" / "ship-agent" / "config")
        )
        
        self._register_handlers()
        logger.info("All components initialized successfully!")
    
    def _register_handlers(self):
        """Register MCP protocol handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            return [
                Tool(
                    name="query",
                    description="Unified query with intelligent routing",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Your question"},
                            "context": {"type": "string", "description": "Optional context"}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="query_schema",
                    description="Direct GraphQL schema query",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="query_documentation",
                    description="Query documentation",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "category": {"type": "string", "enum": ["basics", "issuing", "acquiring", "sdks"]}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="generate_collection",
                    description="Generate Postman collection for a program",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {"type": "string"},
                            "operations": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="generate_implementation_guide",
                    description="Generate implementation guide for a program",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {"type": "string"},
                            "format": {"type": "string", "enum": ["markdown", "json"]}
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="list_programs",
                    description="List all available programs",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool calls using existing agent code"""
            
            try:
                if name == "query":
                    # Use advisory agent's routing logic
                    query = arguments["query"]
                    context = arguments.get("context", "")
                    
                    # Classify query
                    query_type = self.query_classifier.classify(query)
                    logger.info(f"Query classified as: {query_type}")
                    
                    # Route to appropriate agent(s)
                    response = await self.agent_router.route_query(
                        query=query,
                        query_type=query_type,
                        context=context
                    )
                    
                    return [TextContent(type="text", text=response)]
                
                elif name == "query_schema":
                    # Direct schema query
                    response = await self.schema_agent.generate_response(
                        query=arguments["query"],
                        context_chunks=self.schema_retriever.retrieve(arguments["query"])
                    )
                    return [TextContent(type="text", text=response)]
                
                elif name == "query_documentation":
                    # Direct documentation query
                    category = arguments.get("category")
                    chunks = self.doc_retriever.retrieve(
                        arguments["query"],
                        category_filter=category
                    )
                    response = await self.doc_agent.generate_response(
                        query=arguments["query"],
                        context_chunks=chunks
                    )
                    return [TextContent(type="text", text=response)]
                
                elif name == "generate_collection":
                    # Generate Postman collection
                    collection = self.unified_generator.generate_collection(
                        program_type=arguments["program_type"],
                        operations=arguments.get("operations", [])
                    )
                    return [TextContent(
                        type="text",
                        text=f"Generated Postman collection for {arguments['program_type']} with {len(collection['item'])} operations"
                    )]
                
                elif name == "generate_implementation_guide":
                    # Generate implementation guide
                    guide = self.solutions_generator.generate_guide(
                        program_type=arguments["program_type"],
                        format=arguments.get("format", "markdown")
                    )
                    return [TextContent(type="text", text=guide)]
                
                elif name == "list_programs":
                    # List available programs
                    programs = self.unified_generator.list_programs()
                    text = "Available programs:\n"
                    for prog in programs:
                        text += f"- {prog['name']}: {prog['description']}\n"
                    return [TextContent(type="text", text=text)]
                
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
                    
            except Exception as e:
                logger.error(f"Error in tool {name}: {e}", exc_info=True)
                return [TextContent(type="text", text=f"Error: {str(e)}")]
    
    async def run(self):
        """Run the MCP server"""
        logger.info("Starting Hybrid MCP Server...")
        logger.info("This is a single-process server using existing agent code")
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="lamplight-hybrid",
                    server_version="3.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(tools_changed=True),
                        experimental_capabilities={},
                    ),
                ),
            )

async def main():
    server = HybridMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())