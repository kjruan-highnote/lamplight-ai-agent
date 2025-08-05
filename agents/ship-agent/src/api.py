"""
Ship Agent API - Flexible pattern generation system
"""
import os
import sys
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from datetime import datetime
import json
import asyncio

# Add src to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from plugin_registry import PluginRegistry
from context_manager import FlexibleContext, ContextAggregator
from ship_agent import ShipAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
PORT = int(os.getenv("SHIP_AGENT_PORT", "8003"))

app = FastAPI(
    title="Ship Agent API",
    description="Flexible pattern generation and context management system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
registry = PluginRegistry()
context_manager = FlexibleContext()
ship_agent = ShipAgent(registry, context_manager)

# Request/Response Models
class ContextDimension(BaseModel):
    name: str
    attributes: Dict[str, Any]

class DataSourceIngestion(BaseModel):
    source_type: str
    config: Dict[str, Any]
    data: Optional[Dict[str, Any]] = None

class PatternRequest(BaseModel):
    pattern_type: str
    pattern_data: Dict[str, Any]
    source_id: Optional[str] = None

class GenerationRequest(BaseModel):
    program_type: str
    dimensions: Dict[str, str]
    options: Optional[Dict[str, Any]] = None
    output_format: str = "postman"

class CorrectionRequest(BaseModel):
    original: Any
    corrected: Any
    reason: str
    context: Optional[Dict[str, Any]] = None

class PluginRegistration(BaseModel):
    plugin_type: str
    name: str
    definition: Dict[str, Any]

class QueryRequest(BaseModel):
    query_type: str
    filters: Optional[Dict[str, Any]] = None


@app.on_event("startup")
async def startup_event():
    """Initialize Ship agent on startup"""
    logger.info("Starting Ship Agent...")
    
    # Discover and load plugins
    discovered = registry.discover_plugins(auto_load=True)
    logger.info(f"Discovered plugins: {discovered}")
    
    # Load saved contexts if available
    if context_manager.load_context("default"):
        logger.info("Loaded default context")
    
    logger.info("Ship Agent ready")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ship_agent_ready": True,
        "plugins": registry.list_plugins(),
        "context_stats": context_manager.get_statistics()
    }


# Context Management Endpoints

@app.post("/context/dimension")
async def add_dimension(dimension: ContextDimension):
    """Add a new dimension to the context"""
    try:
        context_manager.add_dimension(dimension.name, dimension.attributes)
        return {
            "status": "success",
            "dimension": dimension.name,
            "message": f"Dimension '{dimension.name}' added successfully"
        }
    except Exception as e:
        logger.error(f"Failed to add dimension: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/context/source")
async def add_source(source: DataSourceIngestion):
    """Add a data source to context"""
    try:
        source_id = context_manager.add_source(source.source_type, source.data or {})
        
        # Try to ingest data if plugin exists
        plugin = registry.get_plugin("data_sources", source.source_type, source.config)
        if plugin:
            patterns = await asyncio.to_thread(plugin.ingest, source.data)
            for pattern_type, pattern_data in patterns.get('patterns', {}).items():
                context_manager.add_pattern(pattern_type, pattern_data, source_id)
        
        return {
            "status": "success",
            "source_id": source_id,
            "source_type": source.source_type
        }
    except Exception as e:
        logger.error(f"Failed to add source: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/context/pattern")
async def add_pattern(pattern: PatternRequest):
    """Add a pattern to context"""
    try:
        pattern_id = context_manager.add_pattern(
            pattern.pattern_type,
            pattern.pattern_data,
            pattern.source_id
        )
        return {
            "status": "success",
            "pattern_id": pattern_id,
            "pattern_type": pattern.pattern_type
        }
    except Exception as e:
        logger.error(f"Failed to add pattern: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/context/correction")
async def add_correction(correction: CorrectionRequest):
    """Add a correction for learning"""
    try:
        context_manager.add_correction(
            correction.original,
            correction.corrected,
            correction.reason,
            correction.context
        )
        return {
            "status": "success",
            "message": "Correction recorded for learning"
        }
    except Exception as e:
        logger.error(f"Failed to add correction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/context/query")
async def query_context(query: QueryRequest):
    """Query the context"""
    try:
        results = context_manager.query(query.query_type, query.filters)
        return {
            "status": "success",
            "query_type": query.query_type,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Failed to query context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/context/status")
async def get_context_status():
    """Get current context status"""
    return {
        "statistics": context_manager.get_statistics(),
        "dimensions": list(context_manager.metadata['dimensions'].keys()),
        "sources": list(context_manager.metadata['sources'].keys()),
        "patterns": len(context_manager.metadata['patterns']),
        "rules": len(context_manager.metadata['rules']),
        "corrections": len(context_manager.metadata['corrections'])
    }


# Plugin Management Endpoints

@app.get("/plugins")
async def list_plugins(plugin_type: Optional[str] = None):
    """List available plugins"""
    return {
        "plugins": registry.list_plugins(plugin_type)
    }


@app.post("/plugins/register")
async def register_plugin(registration: PluginRegistration):
    """Register a new plugin dynamically"""
    try:
        plugin = registry.create_dynamic_plugin(
            registration.plugin_type,
            registration.name,
            registration.definition
        )
        return {
            "status": "success",
            "plugin": registration.name,
            "type": registration.plugin_type,
            "info": plugin.get_info() if plugin else None
        }
    except Exception as e:
        logger.error(f"Failed to register plugin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/plugins/reload/{plugin_type}/{name}")
async def reload_plugin(plugin_type: str, name: str):
    """Reload a plugin"""
    try:
        success = registry.reload_plugin(plugin_type, name)
        return {
            "status": "success" if success else "failed",
            "plugin": name,
            "type": plugin_type
        }
    except Exception as e:
        logger.error(f"Failed to reload plugin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Generation Endpoints

@app.post("/generate/queries")
async def generate_queries(request: GenerationRequest):
    """Generate queries for a specific program type and context"""
    try:
        result = await ship_agent.generate_queries(
            request.program_type,
            request.dimensions,
            request.options
        )
        return {
            "status": "success",
            "program_type": request.program_type,
            "queries": result
        }
    except Exception as e:
        logger.error(f"Failed to generate queries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/collection")
async def generate_collection(request: GenerationRequest):
    """Generate a complete Postman collection"""
    try:
        result = await ship_agent.generate_collection(
            request.program_type,
            request.dimensions,
            request.output_format,
            request.options
        )
        return {
            "status": "success",
            "program_type": request.program_type,
            "format": request.output_format,
            "collection": result
        }
    except Exception as e:
        logger.error(f"Failed to generate collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/test-data")
async def generate_test_data(request: GenerationRequest):
    """Generate test data for a specific context"""
    try:
        result = await ship_agent.generate_test_data(
            request.program_type,
            request.dimensions,
            request.options
        )
        return {
            "status": "success",
            "program_type": request.program_type,
            "test_data": result
        }
    except Exception as e:
        logger.error(f"Failed to generate test data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# File Upload Endpoints

@app.post("/upload/postman")
async def upload_postman_collection(file: UploadFile = File(...)):
    """Upload and parse a Postman collection"""
    try:
        content = await file.read()
        collection_data = json.loads(content)
        
        # Process with Postman plugin if available
        plugin = registry.get_plugin("data_sources", "postman")
        if plugin:
            patterns = await asyncio.to_thread(plugin.extract_patterns, {'collection': collection_data})
            
            # Add to context
            source_id = context_manager.add_source("postman", collection_data)
            for pattern_type, pattern_data in patterns.get('patterns', {}).items():
                context_manager.add_pattern(pattern_type, pattern_data, source_id)
            
            return {
                "status": "success",
                "filename": file.filename,
                "source_id": source_id,
                "patterns_extracted": len(patterns.get('patterns', {}))
            }
        else:
            # Store raw data
            source_id = context_manager.add_source("postman", collection_data)
            return {
                "status": "success",
                "filename": file.filename,
                "source_id": source_id,
                "message": "Collection stored, Postman plugin not available for pattern extraction"
            }
    except Exception as e:
        logger.error(f"Failed to upload Postman collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload/confluence")
async def upload_confluence_data(content: str = Form(...), url: Optional[str] = Form(None)):
    """Upload Confluence documentation"""
    try:
        data = {
            "content": content,
            "url": url,
            "timestamp": datetime.now().isoformat()
        }
        
        source_id = context_manager.add_source("confluence", data)
        
        # Extract patterns if plugin available
        plugin = registry.get_plugin("data_sources", "confluence")
        if plugin:
            patterns = await asyncio.to_thread(plugin.extract_patterns, data)
            for pattern_type, pattern_data in patterns.get('patterns', {}).items():
                context_manager.add_pattern(pattern_type, pattern_data, source_id)
        
        return {
            "status": "success",
            "source_id": source_id,
            "source_type": "confluence"
        }
    except Exception as e:
        logger.error(f"Failed to upload Confluence data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Context Persistence Endpoints

@app.post("/context/save/{name}")
async def save_context(name: str):
    """Save current context"""
    try:
        context_manager.save_context(name)
        return {
            "status": "success",
            "message": f"Context saved as '{name}'"
        }
    except Exception as e:
        logger.error(f"Failed to save context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/context/load/{name}")
async def load_context(name: str):
    """Load a saved context"""
    try:
        success = context_manager.load_context(name)
        if success:
            return {
                "status": "success",
                "message": f"Context '{name}' loaded successfully"
            }
        else:
            raise HTTPException(status_code=404, detail=f"Context '{name}' not found")
    except Exception as e:
        logger.error(f"Failed to load context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)