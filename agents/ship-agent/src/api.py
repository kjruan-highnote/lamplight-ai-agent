"""
Ship Agent API - Clean Version
Provides API endpoints for solution document generation using the modular pattern
"""
import os
import sys
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from datetime import datetime
import json
import yaml

# Add src to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modular_solution_generator import ModularSolutionGenerator
from postman_sync import PostmanToOperationsSync

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
    description="API for generating solution documents from program configs and customer contexts",
    version="3.0.0"
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
generator = ModularSolutionGenerator()
syncer = PostmanToOperationsSync()

# Request/Response Models
class GenerateSolutionRequest(BaseModel):
    """Request to generate a solution document"""
    program_type: str = Field(..., description="Program type (e.g., ap_automation)")
    customer_name: Optional[str] = Field(None, description="Customer name for context")
    export_formats: Optional[List[str]] = Field(None, description="Export formats: 'confluence', 'html', 'pdf'")

class SyncPostmanRequest(BaseModel):
    """Request to sync Postman collections"""
    collection_name: Optional[str] = Field(None, description="Specific collection to sync (optional)")

class ListResourcesResponse(BaseModel):
    """Response with available resources"""
    items: List[str]
    count: int

class ProgramInfoResponse(BaseModel):
    """Response with program configuration details"""
    program_type: str
    vendor: str
    version: str
    capabilities: List[str]
    categories: List[Dict[str, Any]]
    workflows: Optional[Dict[str, Any]]
    compliance: Optional[Dict[str, Any]]

class CustomerContextResponse(BaseModel):
    """Response with customer context details"""
    customer_name: str
    industry: Optional[str]
    business_context: Optional[Dict[str, Any]]
    use_cases: Optional[Dict[str, Any]]
    success_metrics: Optional[Dict[str, Any]]


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("Starting Ship Agent API v3.0...")
    
    # List available resources
    programs_dir = generator.config_loader.config_dir
    contexts_dir = generator.context_loader.context_dir
    
    programs = len(list(programs_dir.glob("*.yaml")))
    contexts = len(list(contexts_dir.glob("*.json")))
    
    logger.info(f"Available programs: {programs}")
    logger.info(f"Available customer contexts: {contexts}")
    logger.info("Ship Agent API ready")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "3.0.0",
        "pattern": "modular",
        "description": "Program Config + Customer Context = Solution"
    }


@app.get("/programs", response_model=ListResourcesResponse)
async def list_programs():
    """List all available program configurations"""
    programs_dir = generator.config_loader.config_dir
    programs = []
    
    for config_file in sorted(programs_dir.glob("*.yaml")):
        program = config_file.stem
        # Skip enhanced versions in listing (they're used automatically)
        if not program.endswith('_enhanced'):
            programs.append(program)
    
    return {
        "items": programs,
        "count": len(programs)
    }


@app.get("/programs/{program_type}", response_model=ProgramInfoResponse)
async def get_program_info(program_type: str):
    """Get detailed information about a program configuration"""
    try:
        config = generator.config_loader.load(program_type)
        
        return {
            "program_type": config.get("program_type", program_type),
            "vendor": config.get("vendor", "unknown"),
            "version": config.get("version", "1.0.0"),
            "capabilities": config.get("capabilities", []),
            "categories": config.get("categories", []),
            "workflows": config.get("workflows"),
            "compliance": config.get("compliance")
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Program '{program_type}' not found")
    except Exception as e:
        logger.error(f"Failed to load program config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/contexts", response_model=ListResourcesResponse)
async def list_contexts():
    """List all available customer contexts"""
    contexts_dir = generator.context_loader.context_dir
    contexts = []
    
    for context_file in sorted(contexts_dir.glob("*.json")):
        customer = context_file.stem.replace('_context', '').replace('_v2', '')
        if customer not in contexts:
            contexts.append(customer)
    
    return {
        "items": contexts,
        "count": len(contexts)
    }


@app.get("/contexts/{customer_name}", response_model=CustomerContextResponse)
async def get_customer_context(customer_name: str):
    """Get detailed information about a customer context"""
    context = generator.context_loader.load(customer_name)
    
    if not context:
        raise HTTPException(status_code=404, detail=f"Customer context '{customer_name}' not found")
    
    customer_info = context.get("customer", {})
    
    return {
        "customer_name": customer_info.get("name", customer_name),
        "industry": customer_info.get("industry"),
        "business_context": context.get("business_context"),
        "use_cases": context.get("use_cases"),
        "success_metrics": context.get("success_metrics")
    }


@app.post("/generate")
async def generate_solution(request: GenerateSolutionRequest):
    """
    Generate a solution document
    
    Combines program configuration with optional customer context
    to create a comprehensive solution document.
    Supports multiple export formats: markdown, confluence, html, pdf
    """
    try:
        # Generate document with optional export formats
        output_files = generator.generate(
            program_type=request.program_type,
            customer_name=request.customer_name,
            export_formats=request.export_formats
        )
        
        # Read the markdown document for preview
        markdown_path = output_files.get('markdown', list(output_files.values())[0] if output_files else None)
        
        if markdown_path:
            with open(markdown_path, 'r') as f:
                content = f.read()
            content_preview = content[:1000] + "..." if len(content) > 1000 else content
        else:
            content_preview = "Document generated successfully"
        
        return {
            "status": "success",
            "program_type": request.program_type,
            "customer_name": request.customer_name,
            "output_files": output_files,
            "content_preview": content_preview,
            "full_content_lines": len(content.split('\n')) if markdown_path else 0,
            "timestamp": datetime.now().isoformat()
        }
    
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate solution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/generate/{program_type}")
async def generate_solution_get(program_type: str, customer: Optional[str] = None, formats: Optional[str] = None):
    """
    Generate a solution document via GET request
    
    Convenience endpoint for generating documents via simple GET request.
    Formats can be comma-separated: 'confluence,html,pdf'
    """
    export_formats = formats.split(',') if formats else None
    request = GenerateSolutionRequest(
        program_type=program_type,
        customer_name=customer,
        export_formats=export_formats
    )
    return await generate_solution(request)


@app.get("/download/{program_type}")
async def download_solution(program_type: str, customer: Optional[str] = None, format: str = "markdown"):
    """
    Generate and download a solution document
    
    Returns the generated document as a downloadable file.
    Format options: markdown, confluence, html
    """
    try:
        # Determine export formats
        export_formats = [format] if format != "markdown" else None
        
        # Generate document
        output_files = generator.generate(
            program_type=program_type,
            customer_name=customer,
            export_formats=export_formats
        )
        
        # Get the requested file path
        file_path = output_files.get(format)
        if not file_path:
            raise HTTPException(status_code=400, detail=f"Format '{format}' not available")
        
        # Get filename
        filename = Path(file_path).name
        
        # Determine media type
        media_types = {
            'markdown': 'text/markdown',
            'confluence': 'text/plain',
            'html': 'text/html',
            'pdf': 'application/pdf'
        }
        media_type = media_types.get(format, 'application/octet-stream')
        
        # Return as file download
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename
        )
    
    except Exception as e:
        logger.error(f"Failed to generate document for download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sync/postman")
async def sync_postman(request: SyncPostmanRequest):
    """
    Sync Postman collections to operations files
    
    Updates operation files from Postman collections (source of truth).
    """
    try:
        if request.collection_name:
            # Sync specific collection
            postman_file = syncer.postman_dir / f"{request.collection_name}.json"
            if not postman_file.exists():
                raise HTTPException(status_code=404, detail=f"Collection '{request.collection_name}' not found")
            
            count = syncer.sync_collection(postman_file)
            
            return {
                "status": "success",
                "collection": request.collection_name,
                "operations_synced": count,
                "timestamp": datetime.now().isoformat()
            }
        else:
            # Sync all collections
            results = syncer.sync_all()
            
            return {
                "status": "success",
                "results": results,
                "total_operations": sum(c for c in results.values() if c >= 0),
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        logger.error(f"Failed to sync Postman collections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/operations/{program_type}")
async def get_operations(program_type: str):
    """Get operations for a specific program"""
    operations_file = syncer.operations_dir / f"{program_type}_operations.json"
    
    if not operations_file.exists():
        # Try to load from Postman and sync
        postman_file = syncer.postman_dir / f"{program_type}.json"
        if postman_file.exists():
            syncer.sync_collection(postman_file)
        else:
            raise HTTPException(status_code=404, detail=f"No operations found for '{program_type}'")
    
    with open(operations_file, 'r') as f:
        operations = json.load(f)
    
    # Group by category
    categories = {}
    for op in operations:
        category = op.get('metadata', {}).get('category', 'uncategorized')
        if category not in categories:
            categories[category] = []
        categories[category].append(op['name'])
    
    return {
        "program_type": program_type,
        "total_operations": len(operations),
        "categories": categories,
        "operations": operations
    }


@app.get("/workflows/{program_type}")
async def get_workflows(program_type: str):
    """Get workflows defined for a program"""
    try:
        config = generator.config_loader.load(program_type)
        workflows = config.get("workflows", {})
        
        if not workflows:
            return {
                "program_type": program_type,
                "workflows": {},
                "message": "No workflows defined for this program"
            }
        
        return {
            "program_type": program_type,
            "workflows": workflows,
            "count": len(workflows)
        }
    
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Program '{program_type}' not found")


@app.get("/pattern")
async def explain_pattern():
    """Explain the modular pattern used by this API"""
    return {
        "pattern": "Modular Solution Generation",
        "formula": "Program Config (YAML) + Customer Context (JSON) = Solution Document (Markdown)",
        "components": {
            "program_config": {
                "location": "data/programs/*.yaml",
                "purpose": "Technical structure and requirements",
                "contains": ["capabilities", "workflows", "operations", "compliance"]
            },
            "customer_context": {
                "location": "data/contexts/*_context.json",
                "purpose": "Business narrative and requirements",
                "contains": ["business_context", "objectives", "use_cases", "success_metrics"]
            },
            "postman_collection": {
                "location": "data/postman/*.json",
                "purpose": "Actual API operations (optional)",
                "contains": ["GraphQL queries", "mutations", "examples"]
            }
        },
        "benefits": [
            "No hardcoded customer logic",
            "Clean separation of concerns",
            "Easy to extend (just add data files)",
            "Reusable components"
        ],
        "usage_examples": {
            "generic_solution": "GET /generate/ap_automation",
            "customer_specific": "GET /generate/ap_automation?customer=trip_com",
            "with_download": "GET /download/ap_automation?customer=trip_com"
        }
    }


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Ship Agent API",
        "version": "3.0.0",
        "description": "Modular solution document generator",
        "pattern": "Program Config + Customer Context = Solution",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "pattern": "/pattern",
            "programs": "/programs",
            "contexts": "/contexts",
            "generate": "/generate",
            "operations": "/operations/{program_type}",
            "workflows": "/workflows/{program_type}"
        },
        "documentation": "See /docs for interactive API documentation"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)