#!/usr/bin/env python3
"""
Simple test to generate Trip.com collection
"""
import asyncio
import json
from pathlib import Path
import sys
sys.path.append('src')

from enhanced_ship_agent import EnhancedShipAgent, DocumentationLinkProvider


async def main():
    print("Testing Trip.com collection generation...")
    
    # Initialize agent
    agent = EnhancedShipAgent(cache_dir="cache")
    
    # Check if operations are loaded
    if 'trip.com' in agent.operations_cache:
        print(f"✓ Found {len(agent.operations_cache['trip.com'])} Trip.com operations")
        
        # Get operation details
        ops = agent.operations_cache['trip.com']
        categories = set()
        for op in ops.values():
            cat = op.get('metadata', {}).get('category', '')
            if cat:
                categories.add(cat)
        
        print(f"✓ Categories available: {sorted(categories)}")
    else:
        print("❌ No Trip.com operations found")
        return
    
    # Generate collection WITHOUT category filtering
    print("\nGenerating collection without filtering...")
    result = await agent.generate_enhanced_collection(
        program_type="trip.com",
        dimensions={
            "customer": "Trip.com",
            "environment": "production"
        },
        options={}  # No filtering
    )
    
    print(f"✓ Generated {len(result['operations'])} operations")
    
    # Save simple output
    output_dir = Path("data/generated/trip.com")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / "trip.com_all_operations.json"
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"✓ Saved to {output_file}")
    
    # Show first few operations
    print("\nFirst 5 operations:")
    for op in result['operations'][:5]:
        print(f"  - {op['name']} ({op.get('metadata', {}).get('category', 'no-category')})")
    
    # Generate documentation links
    op_names = [op['name'] for op in result['operations']]
    doc_links = DocumentationLinkProvider.get_relevant_links(op_names)
    
    print(f"\n✓ Documentation categories identified: {list(doc_links['categories'].keys())}")
    
    # Test with category filtering
    print("\nTesting with category filtering...")
    result_filtered = await agent.generate_enhanced_collection(
        program_type="trip.com",
        dimensions={
            "customer": "Trip.com",
            "environment": "production"
        },
        options={
            "categories": ["api_keys", "payment_cards", "transactions"]
        }
    )
    
    print(f"✓ Filtered result: {len(result_filtered['operations'])} operations")
    
    if result_filtered['operations']:
        print("First 3 filtered operations:")
        for op in result_filtered['operations'][:3]:
            print(f"  - {op['name']} ({op.get('metadata', {}).get('category', 'no-category')})")


if __name__ == "__main__":
    asyncio.run(main())