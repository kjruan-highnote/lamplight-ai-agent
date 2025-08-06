"""
Ship Agent API - Simplified version
"""
import os
import sys
import logging
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from datetime import datetime
import json
import asyncio

# Add src to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ship_agent_simplified import SimplifiedShipAgent
from subscriber_implementation_guide import SubscriberImplementationGuide
from implementation_llm_agent import ImplementationLLMAgent

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
    description="Simplified Ship Agent for generating program-specific collections",
    version="2.0.0"
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
ship_agent = SimplifiedShipAgent()
implementation_guide = SubscriberImplementationGuide()
llm_agent = ImplementationLLMAgent(
    model=os.getenv("LLM_MODEL", "llama3"),
    doc_agent_url=os.getenv("DOC_AGENT_URL", "http://localhost:8001"),
    schema_agent_url=os.getenv("SCHEMA_AGENT_URL", "http://localhost:8000")
)

# Request/Response Models
class GenerationRequest(BaseModel):
    program_type: str
    dimensions: Dict[str, str]
    options: Optional[Dict[str, Any]] = None

class TestDataRequest(BaseModel):
    program_type: str
    dimensions: Dict[str, str]
    options: Optional[Dict[str, Any]] = None

class AvailableProgramsResponse(BaseModel):
    programs: list[str]
    count: int

class ImplementationQueryRequest(BaseModel):
    question: str = Field(..., description="Implementation question to answer")
    program_type: Optional[str] = Field(None, description="Optional program/subscriber context")
    specific_area: Optional[str] = Field(None, description="Specific area like 'authentication', 'card_issuance'")

class ImplementationGuideRequest(BaseModel):
    program_type: str = Field(..., description="Program type to get guide for")
    specific_area: Optional[str] = Field(None, description="Optional specific area to focus on")


@app.on_event("startup")
async def startup_event():
    """Initialize Ship agent on startup"""
    logger.info("Starting Simplified Ship Agent...")
    
    # Load operations cache
    ship_agent._load_operations_cache()
    
    logger.info(f"Loaded {len(ship_agent.operations_cache)} program types")
    logger.info("Ship Agent ready")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ship_agent_ready": True,
        "available_programs": len(ship_agent.operations_cache),
        "version": "2.0.0"
    }


@app.get("/programs", response_model=AvailableProgramsResponse)
async def list_programs():
    """List all available program types"""
    programs = list(ship_agent.operations_cache.keys())
    return {
        "programs": sorted(programs),
        "count": len(programs)
    }


@app.get("/programs/{program_type}")
async def get_program_info(program_type: str):
    """Get information about a specific program type"""
    if program_type not in ship_agent.operations_cache:
        raise HTTPException(status_code=404, detail=f"Program type '{program_type}' not found")
    
    # Get operations for this program
    operations = ship_agent.operations_cache[program_type]
    
    # Get YAML config if available
    yaml_config = ship_agent._load_program_config(program_type)
    
    # Organize operations by category
    categories = {}
    for op in operations.values():
        category = op.get('metadata', {}).get('category', 'uncategorized')
        if category not in categories:
            categories[category] = []
        categories[category].append(op['name'])
    
    return {
        "program_type": program_type,
        "total_operations": len(operations),
        "categories": categories,
        "dimensions": yaml_config.get('dimensions', {}) if yaml_config else {},
        "flows": yaml_config.get('operation_flows', {}) if yaml_config else {},
        "metadata": yaml_config.get('metadata', {}) if yaml_config else {}
    }


@app.post("/generate/collection")
async def generate_collection(request: GenerationRequest):
    """Generate a complete Postman collection"""
    try:
        result = await ship_agent.generate_collection(
            request.program_type,
            request.dimensions,
            request.options
        )
        return {
            "status": "success",
            "program_type": request.program_type,
            "collection": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/test-data")
async def generate_test_data(request: TestDataRequest):
    """Generate test data for specific operations"""
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate test data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/operations/{program_type}/{operation_name}")
async def get_operation_details(program_type: str, operation_name: str):
    """Get details for a specific operation"""
    if program_type not in ship_agent.operations_cache:
        raise HTTPException(status_code=404, detail=f"Program type '{program_type}' not found")
    
    operations = ship_agent.operations_cache[program_type]
    if operation_name not in operations:
        raise HTTPException(status_code=404, detail=f"Operation '{operation_name}' not found in {program_type}")
    
    return {
        "program_type": program_type,
        "operation": operations[operation_name]
    }


@app.get("/categories/{program_type}")
async def get_categories(program_type: str):
    """Get all categories for a program type"""
    if program_type not in ship_agent.operations_cache:
        raise HTTPException(status_code=404, detail=f"Program type '{program_type}' not found")
    
    operations = ship_agent.operations_cache[program_type]
    categories = {}
    
    for op in operations.values():
        category = op.get('metadata', {}).get('category', 'uncategorized')
        if category not in categories:
            categories[category] = {
                'name': category,
                'operations': [],
                'count': 0
            }
        categories[category]['operations'].append(op['name'])
        categories[category]['count'] += 1
    
    return {
        "program_type": program_type,
        "categories": list(categories.values())
    }


@app.post("/implementation/query")
async def query_implementation(request: ImplementationQueryRequest):
    """
    Answer specific implementation questions for subscribers using LLM
    
    This endpoint can answer questions like:
    - How do I implement authentication for Trip.com?
    - What are the required operations for card issuance?
    - How to handle multi-currency transactions?
    
    Uses LLM with multi-agent collaboration for comprehensive answers.
    """
    try:
        # Use LLM agent for intelligent responses
        response = await llm_agent.answer_implementation_question(
            question=request.question,
            program_type=request.program_type,
            include_code_examples=True
        )
        
        return {
            "status": "success",
            "query": request.question,
            "response": response,
            "llm_powered": True
        }
    except Exception as e:
        logger.error(f"Failed to answer implementation query: {e}")
        # Fallback to static implementation guide
        try:
            static_response = await implementation_guide.answer_implementation_question(
                question=request.question,
                program_type=request.program_type
            )
            return {
                "status": "success",
                "query": request.question,
                "response": static_response,
                "llm_powered": False,
                "fallback": True
            }
        except:
            raise HTTPException(status_code=500, detail=str(e))


@app.post("/implementation/guide")
async def get_implementation_guide(request: ImplementationGuideRequest):
    """
    Get detailed implementation guide for a specific program/subscriber
    
    Returns step-by-step implementation instructions, required operations,
    best practices, and common challenges.
    """
    try:
        guide = await implementation_guide.get_implementation_guide(
            program_type=request.program_type,
            specific_area=request.specific_area
        )
        
        return {
            "status": "success",
            "guide": guide
        }
    except Exception as e:
        logger.error(f"Failed to get implementation guide: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/implementation/patterns")
async def list_implementation_patterns():
    """List all available implementation patterns"""
    patterns = implementation_guide.implementation_patterns
    
    return {
        "patterns": [
            {
                "program_type": key,
                "name": value.get("name"),
                "phases": value.get("implementation_phases", []),
                "features": value.get("key_features", [])
            }
            for key, value in patterns.items()
        ],
        "count": len(patterns)
    }


@app.get("/implementation/best-practices/{program_type}")
async def get_best_practices(program_type: str):
    """Get best practices for a specific program implementation"""
    practices = implementation_guide._get_best_practices(program_type)
    
    return {
        "program_type": program_type,
        "best_practices": practices
    }


@app.post("/chat")
async def chat_implementation(request: ImplementationQueryRequest):
    """
    Chat endpoint for Advisory Agent integration
    Provides intelligent implementation assistance with multi-agent collaboration
    """
    try:
        # Determine if this is an implementation-specific question
        implementation_keywords = [
            "implement", "integrate", "setup", "configure", "deploy",
            "trip.com", "consumer credit", "ap automation",
            "virtual card", "webhook", "authentication", "authorization"
        ]
        
        is_implementation = any(
            keyword in request.question.lower() 
            for keyword in implementation_keywords
        )
        
        if is_implementation or request.program_type:
            # Use LLM agent for implementation questions
            response = await llm_agent.answer_implementation_question(
                question=request.question,
                program_type=request.program_type,
                include_code_examples=True
            )
            
            return {
                "answer": response["answer"],
                "confidence": response["confidence"],
                "source": "ship_agent",
                "relevant_operations": response.get("relevant_operations", []),
                "code_examples": response.get("code_examples", []),
                "best_practices": response.get("best_practices", []),
                "llm_powered": True
            }
        else:
            # For non-implementation questions, provide guidance
            return {
                "answer": "This question appears to be general. For implementation-specific questions about programs like Trip.com, please include program context.",
                "confidence": 0.3,
                "source": "ship_agent",
                "suggestion": "Try asking about specific implementation topics like authentication, card issuance, or webhook integration."
            }
            
    except Exception as e:
        logger.error(f"Chat implementation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)