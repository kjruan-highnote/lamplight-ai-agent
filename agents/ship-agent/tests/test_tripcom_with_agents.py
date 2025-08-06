#!/usr/bin/env python3
"""
Test Trip.com documentation generation using the document agent
"""
import asyncio
import json
import requests
from pathlib import Path
from datetime import datetime
import logging
import sys

# Add the src directory to the path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from unified_generator import UnifiedGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_document_agent():
    """Test if document agent is running"""
    try:
        response = requests.get("http://localhost:8001/health")
        if response.status_code == 200:
            logger.info("✅ Document agent is running")
            return True
    except:
        pass
    logger.warning("⚠️ Document agent not responding, will proceed without it")
    return False

async def generate_tripcom_documentation():
    """Generate comprehensive documentation for Trip.com"""
    
    logger.info("=" * 60)
    logger.info("Trip.com Documentation Generation with Multi-Agent System")
    logger.info("=" * 60)
    
    # Test document agent
    document_agent_active = test_document_agent()
    
    # Initialize generator
    generator = UnifiedGenerator(
        data_dir="data",
        output_dir="data/generated/trip.com"
    )
    
    # Create configuration for Trip.com solutions generation
    config = {
        "type": "solutions",
        "postman_file": "data/postman/Trip.com.postman_collection.json",
        "customer": "Trip.com",
        "program_type": "travel_services",
        "sections": [
            "header",
            "executive_summary", 
            "table_of_contents",
            "technical_overview",
            "use_cases",
            "implementation_flows",
            "api_reference",
            "integration_guide",
            "security_compliance",
            "appendices"
        ]
    }
    
    # Save config for reference
    config_path = Path("data/generated/trip.com/generation_config.json")
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    logger.info(f"📝 Configuration saved to: {config_path}")
    
    try:
        # Generate documentation
        logger.info("\n🚀 Generating Trip.com documentation...")
        result = await generator.generate_from_file(config_path)
        
        logger.info("✅ Documentation generated successfully!")
        
        # If document agent is active, query it for additional insights
        if document_agent_active:
            logger.info("\n📊 Querying document agent for additional insights...")
            
            queries = [
                {
                    "query": "What are the main features of the Trip.com API?",
                    "context": "Trip.com travel services"
                },
                {
                    "query": "What authentication methods are supported?",
                    "context": "Trip.com API authentication"
                },
                {
                    "query": "What are the best practices for integration?",
                    "context": "Trip.com API integration"
                }
            ]
            
            for q in queries:
                try:
                    response = requests.post(
                        "http://localhost:8001/query",
                        json=q,
                        timeout=10
                    )
                    if response.status_code == 200:
                        answer = response.json().get('answer', 'No answer available')
                        logger.info(f"\n❓ Q: {q['query']}")
                        logger.info(f"💡 A: {answer[:200]}...")
                except Exception as e:
                    logger.warning(f"Could not query document agent: {e}")
        
        # Generate summary report
        summary = {
            "timestamp": datetime.now().isoformat(),
            "collection": "Trip.com",
            "program_type": "travel_services",
            "document_agent_active": document_agent_active,
            "generated_files": result,
            "status": "success"
        }
        
        summary_path = Path("data/generated/trip.com/generation_summary.json")
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        logger.info(f"\n📄 Summary saved to: {summary_path}")
        
        # List generated files
        logger.info("\n📁 Generated Files:")
        output_dir = Path("data/generated/trip.com")
        for file in output_dir.glob("*"):
            if file.is_file():
                logger.info(f"  - {file.name} ({file.stat().st_size:,} bytes)")
        
        return summary
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}", exc_info=True)
        return {"status": "failed", "error": str(e)}

if __name__ == "__main__":
    result = asyncio.run(generate_tripcom_documentation())
    
    print("\n" + "=" * 60)
    print("🎯 Final Result:")
    print(json.dumps(result, indent=2))
    print("=" * 60)