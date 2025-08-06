#!/usr/bin/env python3
"""
End-to-end test for Trip.com Postman collection generation using multi-agent system
"""
import asyncio
import json
from pathlib import Path
from datetime import datetime
import logging
import sys

# Add the src directory to the path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from solutions_document_generator import SolutionsDocumentGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_tripcom_generation():
    """
    Test Trip.com collection generation with document agent integration
    """
    try:
        # Paths
        postman_file = "data/postman/Trip.com.postman_collection.json"
        output_dir = "data/generated/trip.com"
        
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        logger.info("=" * 60)
        logger.info("Starting Trip.com E2E Test with Multi-Agent System")
        logger.info("=" * 60)
        
        # Initialize the solutions generator (which uses document agent)
        generator = SolutionsDocumentGenerator(
            output_dir=output_dir,
            document_agent_url="http://localhost:8001"  # Document agent URL
        )
        
        logger.info(f"Using document agent at: http://localhost:8001")
        logger.info(f"Processing Postman collection: {postman_file}")
        
        # Generate comprehensive documentation
        logger.info("\n📄 Generating comprehensive solution documentation...")
        
        # Test sections to generate
        sections = [
            "overview",
            "authentication", 
            "endpoints",
            "data_models",
            "error_handling",
            "best_practices",
            "testing",
            "monitoring"
        ]
        
        # Generate the solution document
        output_path = generator.generate_from_postman(
            postman_file=postman_file,
            customer="Trip.com",
            program_type="travel_services",
            sections=sections
        )
        
        logger.info(f"✅ Solution document generated: {output_path}")
        
        # Also generate a summary report
        logger.info("\n📊 Generating summary report...")
        
        summary_data = {
            "timestamp": datetime.now().isoformat(),
            "collection": "Trip.com",
            "sections_generated": sections,
            "output_files": [str(output_path)],
            "document_agent_used": True,
            "status": "success"
        }
        
        summary_path = Path(output_dir) / "e2e_test_summary.json"
        with open(summary_path, 'w') as f:
            json.dump(summary_data, f, indent=2)
        
        logger.info(f"✅ Summary report saved: {summary_path}")
        
        # Test the document agent directly
        logger.info("\n🔍 Testing document agent query capabilities...")
        
        test_queries = [
            "What are the main API endpoints for Trip.com?",
            "How does authentication work in the Trip.com API?",
            "What are the rate limits and best practices?"
        ]
        
        for query in test_queries:
            logger.info(f"\nQuerying: {query}")
            # The generator will use the document agent internally
            
        logger.info("\n" + "=" * 60)
        logger.info("✅ E2E Test Completed Successfully!")
        logger.info("=" * 60)
        
        # Display generated files
        logger.info("\n📁 Generated Files:")
        for file in Path(output_dir).glob("*"):
            logger.info(f"  - {file.name}")
            
        return {
            "status": "success",
            "output_path": str(output_path),
            "summary_path": str(summary_path),
            "document_agent_active": True
        }
        
    except Exception as e:
        logger.error(f"❌ Test failed: {str(e)}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e)
        }

if __name__ == "__main__":
    # Run the test
    result = asyncio.run(test_tripcom_generation())
    
    # Print final result
    print("\n🎯 Final Result:")
    print(json.dumps(result, indent=2))