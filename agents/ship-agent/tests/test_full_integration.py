#!/usr/bin/env python3
"""
Full integration test for Trip.com with all agents running
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

def check_all_agents():
    """Check status of all agents"""
    agents = {
        "Schema Agent": "http://localhost:8000/health",
        "Document Agent": "http://localhost:8001/health",
        "Advisory Agent": "http://localhost:8002/health",
        "Ship Agent": "http://localhost:8003/health"
    }
    
    status = {}
    for name, url in agents.items():
        try:
            response = requests.get(url, timeout=2)
            status[name] = response.status_code == 200
            logger.info(f"✅ {name}: {'Active' if status[name] else 'Inactive'}")
        except:
            status[name] = False
            logger.info(f"❌ {name}: Inactive")
    
    return status

def test_advisory_agent(question: str):
    """Test the advisory agent with a question"""
    try:
        response = requests.post(
            "http://localhost:8002/chat",
            json={"question": question},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Advisory agent error: {e}")
        return None

async def test_ship_agent_api():
    """Test the ship agent API"""
    try:
        # Test Trip.com collection generation via API
        response = requests.post(
            "http://localhost:8003/generate",
            json={
                "program_type": "trip.com",
                "dimensions": {
                    "customer": "Trip.com",
                    "api_url": "https://api.trip.com/graphql"
                },
                "options": {
                    "output_format": "postman",
                    "include_test_data": True
                }
            },
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Ship agent returned {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"Ship agent API error: {e}")
        return None

async def main():
    logger.info("=" * 70)
    logger.info("🚀 Full Multi-Agent Integration Test for Trip.com")
    logger.info("=" * 70)
    
    # Check all agents
    logger.info("\n📊 Checking agent status...")
    agent_status = check_all_agents()
    
    active_agents = sum(1 for v in agent_status.values() if v)
    logger.info(f"\n✅ Active agents: {active_agents}/4")
    
    if active_agents < 2:
        logger.error("⚠️ Not enough agents running. Please start all agents first.")
        return
    
    # Test 1: Advisory Agent Integration
    logger.info("\n" + "=" * 50)
    logger.info("Test 1: Advisory Agent - Trip.com Questions")
    logger.info("=" * 50)
    
    questions = [
        "What are the main endpoints in the Trip.com API?",
        "How do I authenticate with Trip.com services?",
        "What GraphQL operations are available for Trip.com?"
    ]
    
    for q in questions:
        logger.info(f"\n❓ Question: {q}")
        result = test_advisory_agent(q)
        if result:
            logger.info(f"✅ Answer: {result.get('answer', '')[:200]}...")
            logger.info(f"   Source: {result.get('source', 'unknown')}")
            logger.info(f"   Confidence: {result.get('confidence', 0):.2f}")
    
    # Test 2: Ship Agent API
    logger.info("\n" + "=" * 50)
    logger.info("Test 2: Ship Agent API - Generate Collection")
    logger.info("=" * 50)
    
    ship_result = await test_ship_agent_api()
    if ship_result:
        logger.info("✅ Ship agent generated collection successfully")
        logger.info(f"   Operations: {ship_result.get('total_operations', 0)}")
        logger.info(f"   Categories: {ship_result.get('categories', [])[:3]}...")
    
    # Test 3: Generate Documentation with Multi-Agent Cooperation
    logger.info("\n" + "=" * 50)
    logger.info("Test 3: Generate Trip.com Documentation")
    logger.info("=" * 50)
    
    generator = UnifiedGenerator(
        data_dir="data",
        output_dir="data/generated/trip.com_full_test"
    )
    
    config = {
        "type": "solutions",
        "postman_file": "data/postman/Trip.com.postman_collection.json",
        "customer": "Trip.com",
        "program_type": "travel_services",
        "sections": [
            "header",
            "executive_summary",
            "technical_overview",
            "api_reference",
            "integration_guide"
        ]
    }
    
    config_path = Path("data/generated/trip.com_full_test/config.json")
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    try:
        result = await generator.generate_from_file(config_path)
        logger.info("✅ Documentation generated successfully")
        for key, value in result.items():
            logger.info(f"   {key}: {value}")
    except Exception as e:
        logger.error(f"❌ Documentation generation failed: {e}")
    
    # Test 4: Cross-Agent Query
    logger.info("\n" + "=" * 50)
    logger.info("Test 4: Cross-Agent Information Retrieval")
    logger.info("=" * 50)
    
    # Query about Trip.com through advisory agent (which routes to appropriate agent)
    complex_query = "Generate a GraphQL mutation for creating a Trip.com booking with payment card"
    logger.info(f"\n🔍 Complex Query: {complex_query}")
    
    result = test_advisory_agent(complex_query)
    if result:
        logger.info("✅ Cross-agent query successful")
        logger.info(f"   Routed to: {result.get('source', 'unknown')}")
        logger.info(f"   Response: {result.get('answer', '')[:300]}...")
    
    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("📊 Integration Test Summary")
    logger.info("=" * 70)
    
    summary = {
        "timestamp": datetime.now().isoformat(),
        "agents_active": agent_status,
        "tests_performed": [
            "Advisory Agent Questions",
            "Ship Agent API",
            "Documentation Generation",
            "Cross-Agent Query"
        ],
        "collection": "Trip.com",
        "status": "completed"
    }
    
    summary_path = Path("data/generated/trip.com_full_test/test_summary.json")
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    logger.info(f"\n💾 Test summary saved to: {summary_path}")
    logger.info("\n✅ Full integration test completed!")
    
    # List generated files
    output_dir = Path("data/generated/trip.com_full_test")
    if output_dir.exists():
        logger.info("\n📁 Generated Files:")
        for file in output_dir.glob("*"):
            if file.is_file():
                logger.info(f"   - {file.name}")

if __name__ == "__main__":
    asyncio.run(main())