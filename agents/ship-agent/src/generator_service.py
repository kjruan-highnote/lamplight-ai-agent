#!/usr/bin/env python3
"""
Generator Service API
HTTP service wrapper for document generation functionality
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from pathlib import Path
import json
import yaml
import tempfile
import logging
from datetime import datetime

# Import existing generators
from modular_solution_generator import ModularSolutionGenerator
from workflow_diagram_generator import WorkflowDiagramGenerator
from export_formatter import MultiFormatExporter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Generator Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class GeneratorOptions(BaseModel):
    includeMetadata: Optional[bool] = True
    solutionSections: Optional[Dict[str, bool]] = None
    workflowOptions: Optional[Dict[str, Any]] = None
    erdOptions: Optional[Dict[str, Any]] = None

class GenerateRequest(BaseModel):
    id: str
    type: str
    program: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    options: GeneratorOptions
    exportFormats: List[str]

class ExportRequest(BaseModel):
    documentId: str
    content: str
    format: str

class GenerateResponse(BaseModel):
    title: str
    content: str
    sections: List[Dict[str, str]]
    exports: List[Dict[str, Any]]

# Initialize generators
base_dir = Path(__file__).parent.parent
solution_generator = ModularSolutionGenerator(base_dir)
workflow_generator = WorkflowDiagramGenerator(base_dir)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/generate", response_model=GenerateResponse)
async def generate_document(request: GenerateRequest):
    """Generate a document based on type and configuration"""
    try:
        logger.info(f"Generating {request.type} document (ID: {request.id})")
        
        if request.type == "solution":
            return await generate_solution_document(request)
        elif request.type == "workflow":
            return await generate_workflow_diagram(request)
        elif request.type == "erd":
            return await generate_erd_diagram(request)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown generator type: {request.type}")
            
    except Exception as e:
        logger.error(f"Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_solution_document(request: GenerateRequest) -> GenerateResponse:
    """Generate a solution document"""
    try:
        # Prepare program config
        program_config = request.program or {}
        
        # Prepare customer context
        customer_context = request.context
        
        # Map options to generator format
        sections_config = request.options.solutionSections or {
            "executiveSummary": True,
            "technicalOverview": True,
            "useCases": True,
            "workflows": True,
            "apiReference": True,
            "integrationGuide": True,
            "securityCompliance": False,
            "appendices": False,
        }
        
        # Generate document content
        document_content = solution_generator.generate_from_data(
            program_config=program_config,
            customer_context=customer_context,
            sections=sections_config
        )
        
        # Parse sections from content
        sections = parse_markdown_sections(document_content)
        
        # Generate exports
        exports = []
        if "markdown" in request.exportFormats:
            exports.append({
                "format": "markdown",
                "url": f"/exports/{request.id}.md",
                "size": len(document_content.encode('utf-8'))
            })
        
        # Generate title
        title = "Solution Document"
        if request.program and "metadata" in request.program:
            title = request.program["metadata"].get("name", "Solution Document")
        if request.context and "customer" in request.context:
            title = f"{title} for {request.context['customer']['name']}"
        
        return GenerateResponse(
            title=title,
            content=document_content,
            sections=sections,
            exports=exports
        )
        
    except Exception as e:
        logger.error(f"Solution generation failed: {str(e)}")
        raise

async def generate_workflow_diagram(request: GenerateRequest) -> GenerateResponse:
    """Generate a workflow diagram"""
    try:
        # Extract workflow data from program
        if not request.program or "workflows" not in request.program:
            raise ValueError("Program must contain workflows")
        
        workflows = request.program["workflows"]
        if not workflows:
            raise ValueError("No workflows found in program")
        
        # Generate diagrams for each workflow
        diagrams = []
        for workflow_name, workflow_data in workflows.items():
            diagram = workflow_generator.generate_workflow_template(
                workflow_name=workflow_name,
                workflow_data=workflow_data,
                program_type=request.program.get("program_type", "unknown")
            )
            diagrams.append(f"## {workflow_name}\n\n{diagram}")
        
        content = "\n\n".join(diagrams)
        
        # Parse sections
        sections = [
            {"id": name, "title": name, "preview": f"Workflow diagram for {name}"}
            for name in workflows.keys()
        ]
        
        # Generate exports
        exports = []
        if "markdown" in request.exportFormats:
            exports.append({
                "format": "markdown",
                "url": f"/exports/{request.id}.md",
                "size": len(content.encode('utf-8'))
            })
        
        title = f"Workflow Diagrams - {request.program.get('metadata', {}).get('name', 'Program')}"
        
        return GenerateResponse(
            title=title,
            content=content,
            sections=sections,
            exports=exports
        )
        
    except Exception as e:
        logger.error(f"Workflow generation failed: {str(e)}")
        raise

async def generate_erd_diagram(request: GenerateRequest) -> GenerateResponse:
    """Generate an ERD diagram"""
    try:
        # This is a placeholder - you would implement ERD generation logic here
        content = """# Entity Relationship Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    CUSTOMER {
        string name
        string email
        string address
    }
    ORDER {
        int orderNumber
        date orderDate
        string status
    }
    LINE-ITEM {
        int quantity
        float price
    }
    PRODUCT {
        string name
        float price
        string category
    }
```
"""
        
        sections = [
            {"id": "erd", "title": "Entity Relationships", "preview": "Database schema diagram"}
        ]
        
        exports = []
        if "markdown" in request.exportFormats:
            exports.append({
                "format": "markdown",
                "url": f"/exports/{request.id}.md",
                "size": len(content.encode('utf-8'))
            })
        
        title = f"ERD - {request.program.get('metadata', {}).get('name', 'Program')}" if request.program else "ERD Diagram"
        
        return GenerateResponse(
            title=title,
            content=content,
            sections=sections,
            exports=exports
        )
        
    except Exception as e:
        logger.error(f"ERD generation failed: {str(e)}")
        raise

@app.post("/export")
async def export_document(request: ExportRequest):
    """Export a document to a specific format"""
    try:
        # Create temporary file with content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write(request.content)
            temp_path = Path(f.name)
        
        # Use export formatter
        exporter = MultiFormatExporter(temp_path.parent)
        
        # Map format names
        format_map = {
            "pdf": ["pdf"],
            "html": ["html"],
            "confluence": ["confluence"],
            "docx": ["docx"],
            "markdown": ["markdown"]
        }
        
        if request.format not in format_map:
            raise ValueError(f"Unsupported format: {request.format}")
        
        # Export to requested format
        exported = exporter.export_document(temp_path, format_map[request.format])
        
        # Clean up temp file
        temp_path.unlink()
        
        # Return export URL (in production, this would upload to S3 or similar)
        return {
            "url": f"/exports/{request.documentId}.{request.format}",
            "format": request.format
        }
        
    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def parse_markdown_sections(content: str) -> List[Dict[str, str]]:
    """Parse markdown content and extract sections"""
    sections = []
    lines = content.split('\n')
    current_section = None
    
    for line in lines:
        if line.startswith('## '):
            if current_section:
                sections.append(current_section)
            
            title = line[3:].strip()
            current_section = {
                "id": title.lower().replace(' ', '-'),
                "title": title,
                "preview": ""
            }
        elif current_section and line.strip() and not line.startswith('#'):
            if len(current_section["preview"]) < 100:
                current_section["preview"] += line.strip() + " "
    
    if current_section:
        sections.append(current_section)
    
    # Trim previews
    for section in sections:
        section["preview"] = section["preview"][:100].strip()
        if len(section["preview"]) == 100:
            section["preview"] += "..."
    
    return sections

class ModularSolutionGenerator:
    """Wrapper for the existing solution generator"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
    
    def generate_from_data(self, program_config: Dict, customer_context: Optional[Dict], sections: Dict[str, bool]) -> str:
        """Generate solution document from data"""
        
        # Build document sections based on options
        document_parts = []
        
        # Header
        title = program_config.get("metadata", {}).get("name", "Solution Document")
        if customer_context and "customer" in customer_context:
            title = f"{title} for {customer_context['customer']['name']}"
        
        document_parts.append(f"# {title}\n")
        document_parts.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d')}\n")
        
        # Executive Summary
        if sections.get("executiveSummary", True):
            document_parts.append("\n## Executive Summary\n")
            if customer_context and "business_context" in customer_context:
                business = customer_context["business_context"]
                if "objectives" in business:
                    document_parts.append("### Objectives\n")
                    for obj in business["objectives"]:
                        document_parts.append(f"- {obj}\n")
            else:
                document_parts.append(program_config.get("metadata", {}).get("description", ""))
        
        # Technical Overview
        if sections.get("technicalOverview", True):
            document_parts.append("\n## Technical Overview\n")
            if "api_type" in program_config:
                document_parts.append(f"**API Type:** {program_config['api_type']}\n")
            if "vendor" in program_config:
                document_parts.append(f"**Vendor:** {program_config['vendor']}\n")
            
            if "capabilities" in program_config:
                document_parts.append("\n### Capabilities\n")
                for cap_id, cap_data in program_config["capabilities"].items():
                    document_parts.append(f"\n#### {cap_data.get('name', cap_id)}\n")
                    document_parts.append(f"{cap_data.get('description', '')}\n")
        
        # Use Cases
        if sections.get("useCases", True) and customer_context:
            if "use_cases" in customer_context:
                document_parts.append("\n## Use Cases\n")
                for uc in customer_context["use_cases"]:
                    document_parts.append(f"\n### {uc.get('title', 'Use Case')}\n")
                    document_parts.append(f"{uc.get('description', '')}\n")
        
        # Workflows
        if sections.get("workflows", True) and "workflows" in program_config:
            document_parts.append("\n## Workflows\n")
            for wf_name, wf_data in program_config["workflows"].items():
                document_parts.append(f"\n### {wf_name}\n")
                if "description" in wf_data:
                    document_parts.append(f"{wf_data['description']}\n")
                if "steps" in wf_data:
                    document_parts.append("\n**Steps:**\n")
                    for i, step in enumerate(wf_data["steps"], 1):
                        document_parts.append(f"{i}. {step.get('description', step.get('action', ''))}\n")
        
        # API Reference
        if sections.get("apiReference", True):
            document_parts.append("\n## API Reference\n")
            document_parts.append("See program documentation for detailed API specifications.\n")
        
        # Integration Guide
        if sections.get("integrationGuide", True):
            document_parts.append("\n## Integration Guide\n")
            document_parts.append("### Prerequisites\n")
            document_parts.append("- API credentials configured\n")
            document_parts.append("- Network connectivity established\n")
            document_parts.append("- Required permissions granted\n")
        
        # Security & Compliance
        if sections.get("securityCompliance", True):
            document_parts.append("\n## Security & Compliance\n")
            if "compliance" in program_config:
                comp = program_config["compliance"]
                if "standards" in comp:
                    document_parts.append("### Standards\n")
                    for std in comp["standards"]:
                        document_parts.append(f"- {std}\n")
        
        return "".join(document_parts)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)