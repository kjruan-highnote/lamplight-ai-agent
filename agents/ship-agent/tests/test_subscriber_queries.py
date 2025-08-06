#!/usr/bin/env python3
"""
Test the enhanced ship-agent with subscriber implementation queries
"""
import requests
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SHIP_AGENT_URL = "http://localhost:8003"

def test_implementation_patterns():
    """Test listing available implementation patterns"""
    logger.info("\n" + "=" * 60)
    logger.info("Test 1: List Implementation Patterns")
    logger.info("=" * 60)
    
    try:
        response = requests.get(f"{SHIP_AGENT_URL}/implementation/patterns", timeout=5)
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Found {data['count']} implementation patterns:")
            for pattern in data['patterns']:
                logger.info(f"  - {pattern['name']} ({pattern['program_type']})")
                logger.info(f"    Phases: {', '.join(pattern['phases'][:3])}...")
        else:
            logger.error(f"❌ Failed: {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Error: {e}")

def test_implementation_guide(program_type: str):
    """Test getting implementation guide"""
    logger.info("\n" + "=" * 60)
    logger.info(f"Test 2: Get Implementation Guide for {program_type}")
    logger.info("=" * 60)
    
    try:
        payload = {
            "program_type": program_type,
            "specific_area": "card_issuance"
        }
        
        response = requests.post(
            f"{SHIP_AGENT_URL}/implementation/guide",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            guide = data['guide']
            logger.info(f"✅ Implementation Guide for {guide.get('program_name', program_type)}:")
            logger.info(f"  Key Features: {len(guide.get('key_features', []))} features")
            logger.info(f"  Phases: {len(guide.get('implementation_phases', []))} phases")
            logger.info(f"  Sections: {len(guide.get('sections', []))} sections")
            
            # Show first section
            if guide.get('sections'):
                first_section = guide['sections'][0]
                logger.info(f"\n  📄 {first_section['title']}:")
                content = str(first_section.get('content', ''))[:300]
                logger.info(f"  {content}...")
        else:
            logger.error(f"❌ Failed: {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Error: {e}")

def test_implementation_queries():
    """Test answering implementation questions"""
    logger.info("\n" + "=" * 60)
    logger.info("Test 3: Answer Implementation Questions")
    logger.info("=" * 60)
    
    queries = [
        {
            "question": "How do I implement authentication for Trip.com API?",
            "program_type": "trip.com"
        },
        {
            "question": "What are the required operations for issuing virtual cards?",
            "program_type": "trip.com",
            "specific_area": "card_issuance"
        },
        {
            "question": "How to handle multi-currency transactions in Trip.com?",
            "program_type": "trip.com"
        },
        {
            "question": "What are the best practices for error handling?",
            "program_type": None
        }
    ]
    
    for i, query in enumerate(queries, 1):
        logger.info(f"\n  Query {i}: {query['question']}")
        
        try:
            response = requests.post(
                f"{SHIP_AGENT_URL}/implementation/query",
                json=query,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('response', {})
                
                logger.info(f"  ✅ Answer received:")
                if result.get('answer'):
                    logger.info(f"     {result['answer'][:200]}...")
                if result.get('source'):
                    logger.info(f"     Source: {result['source']}")
                if result.get('confidence'):
                    logger.info(f"     Confidence: {result['confidence']:.2f}")
            else:
                logger.error(f"  ❌ Failed: {response.status_code}")
        except Exception as e:
            logger.error(f"  ❌ Error: {e}")

def test_best_practices():
    """Test getting best practices"""
    logger.info("\n" + "=" * 60)
    logger.info("Test 4: Get Best Practices")
    logger.info("=" * 60)
    
    try:
        response = requests.get(
            f"{SHIP_AGENT_URL}/implementation/best-practices/trip.com",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            practices = data.get('best_practices', {})
            
            logger.info(f"✅ Best Practices for {data['program_type']}:")
            for category, items in practices.items():
                logger.info(f"\n  📋 {category.replace('_', ' ').title()}:")
                for item in items[:3]:
                    logger.info(f"    • {item}")
        else:
            logger.error(f"❌ Failed: {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Error: {e}")

def test_trip_com_specific():
    """Test Trip.com specific implementation details"""
    logger.info("\n" + "=" * 60)
    logger.info("Test 5: Trip.com Specific Implementation")
    logger.info("=" * 60)
    
    # Get Trip.com program info
    try:
        response = requests.get(f"{SHIP_AGENT_URL}/programs/trip.com", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Trip.com Program Info:")
            logger.info(f"  Total Operations: {data['total_operations']}")
            logger.info(f"  Categories: {len(data.get('categories', {}))}")
            
            # Show top categories
            categories = data.get('categories', {})
            logger.info("\n  Top Categories:")
            for cat, ops in list(categories.items())[:5]:
                logger.info(f"    • {cat}: {len(ops)} operations")
        else:
            logger.error(f"❌ Failed to get program info: {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Error: {e}")

def main():
    logger.info("🚀 Testing Enhanced Ship-Agent with Subscriber Implementation Queries")
    logger.info("=" * 70)
    
    # Check if ship-agent is running
    try:
        response = requests.get(f"{SHIP_AGENT_URL}/health", timeout=2)
        if response.status_code == 200:
            logger.info("✅ Ship-agent is running")
        else:
            logger.error("❌ Ship-agent not responding properly")
            return
    except:
        logger.error("❌ Ship-agent is not running. Please start it first.")
        return
    
    # Run tests
    test_implementation_patterns()
    test_implementation_guide("trip.com")
    test_implementation_queries()
    test_best_practices()
    test_trip_com_specific()
    
    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("✅ Enhanced Ship-Agent Testing Complete!")
    logger.info("=" * 70)
    logger.info("\nThe ship-agent can now:")
    logger.info("  1. Answer specific implementation questions")
    logger.info("  2. Provide detailed implementation guides")
    logger.info("  3. Share best practices for each program")
    logger.info("  4. Guide through implementation phases")
    logger.info("  5. Provide program-specific recommendations")

if __name__ == "__main__":
    main()