#!/usr/bin/env python3
"""
Test document agent integration with Trip.com queries
"""
import requests
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def query_document_agent(query: str, context: str = None):
    """Query the document agent"""
    try:
        payload = {
            "query": query,
            "context": context or "Trip.com API documentation"
        }
        
        response = requests.post(
            "http://localhost:8001/query",
            json=payload,
            timeout=15
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Error response: {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"Failed to query document agent: {e}")
        return None

def main():
    logger.info("=" * 60)
    logger.info("Testing Document Agent Integration for Trip.com")
    logger.info("=" * 60)
    
    # Test queries for Trip.com
    test_queries = [
        {
            "query": "What are the main API endpoints available in the Trip.com collection?",
            "context": "Trip.com Postman collection endpoints"
        },
        {
            "query": "How do I authenticate with the Trip.com API?",
            "context": "Trip.com API authentication and security"
        },
        {
            "query": "What are the payment methods supported by Trip.com?",
            "context": "Trip.com payment processing"
        },
        {
            "query": "What error codes might I encounter with Trip.com API?",
            "context": "Trip.com error handling"
        },
        {
            "query": "What are the rate limits for Trip.com API?",
            "context": "Trip.com API rate limiting and best practices"
        }
    ]
    
    results = []
    
    for i, test in enumerate(test_queries, 1):
        logger.info(f"\n🔍 Query {i}/{len(test_queries)}:")
        logger.info(f"Q: {test['query']}")
        
        response = query_document_agent(test['query'], test['context'])
        
        if response:
            answer = response.get('answer', 'No answer available')
            sources = response.get('sources', [])
            confidence = response.get('confidence', 0)
            
            logger.info(f"✅ Answer (confidence: {confidence:.2f}):")
            logger.info(f"   {answer[:300]}{'...' if len(answer) > 300 else ''}")
            
            if sources:
                logger.info(f"📚 Sources: {len(sources)} documents referenced")
            
            results.append({
                "query": test['query'],
                "status": "success",
                "confidence": confidence,
                "answer_length": len(answer)
            })
        else:
            logger.warning("❌ Failed to get response")
            results.append({
                "query": test['query'],
                "status": "failed"
            })
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Test Summary:")
    logger.info("=" * 60)
    
    successful = sum(1 for r in results if r['status'] == 'success')
    logger.info(f"✅ Successful queries: {successful}/{len(results)}")
    
    if successful > 0:
        avg_confidence = sum(r.get('confidence', 0) for r in results if r['status'] == 'success') / successful
        logger.info(f"📊 Average confidence: {avg_confidence:.2f}")
    
    # Save results
    summary = {
        "timestamp": datetime.now().isoformat(),
        "test": "document_agent_integration",
        "collection": "Trip.com",
        "queries_tested": len(test_queries),
        "successful": successful,
        "results": results
    }
    
    with open("data/generated/trip.com/document_agent_test_results.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    logger.info(f"\n💾 Results saved to: data/generated/trip.com/document_agent_test_results.json")
    
    return summary

if __name__ == "__main__":
    result = main()
    print("\n🎯 Test completed!")