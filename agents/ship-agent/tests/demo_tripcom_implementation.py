#!/usr/bin/env python3
"""
Demo: Trip.com Implementation Assistant using Enhanced Ship-Agent
"""
import requests
import json
from datetime import datetime

SHIP_AGENT_URL = "http://localhost:8003"

def demo_tripcom_implementation():
    print("=" * 70)
    print("🚀 Trip.com Implementation Assistant Demo")
    print("=" * 70)
    
    # Example implementation questions for Trip.com
    questions = [
        {
            "title": "Initial Setup",
            "query": {
                "question": "What are the first steps to integrate Trip.com with Highnote?",
                "program_type": "trip.com",
                "specific_area": "authentication"
            }
        },
        {
            "title": "Virtual Card Issuance",
            "query": {
                "question": "How do I issue virtual cards for Trip.com bookings?",
                "program_type": "trip.com",
                "specific_area": "card_issuance"
            }
        },
        {
            "title": "Multi-Currency Support",
            "query": {
                "question": "What operations handle multi-currency transactions for Trip.com?",
                "program_type": "trip.com"
            }
        },
        {
            "title": "Webhook Integration",
            "query": {
                "question": "How to handle booking status webhooks from Trip.com?",
                "program_type": "trip.com"
            }
        },
        {
            "title": "Error Handling",
            "query": {
                "question": "What are common errors in Trip.com integration and how to handle them?",
                "program_type": "trip.com"
            }
        }
    ]
    
    print("\n📚 Trip.com Implementation Q&A:\n")
    
    for item in questions:
        print(f"\n{'=' * 60}")
        print(f"📌 {item['title']}")
        print(f"{'=' * 60}")
        print(f"❓ Question: {item['query']['question']}\n")
        
        try:
            # Query the ship-agent
            response = requests.post(
                f"{SHIP_AGENT_URL}/implementation/query",
                json=item['query'],
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('response', {})
                
                # Display the answer
                if result.get('answer'):
                    print("💡 Answer:")
                    print(f"{result['answer']}")
                
                # Show implementation guide if available
                if result.get('implementation_guide'):
                    guide = result['implementation_guide']
                    if guide.get('sections'):
                        print("\n📋 Implementation Steps:")
                        for section in guide['sections'][:2]:  # Show first 2 sections
                            print(f"\n### {section['title']}")
                            content = section.get('content')
                            if isinstance(content, dict):
                                for key, value in list(content.items())[:3]:
                                    print(f"  • {key}: {value}")
                            elif isinstance(content, str):
                                print(f"  {content[:200]}...")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Get comprehensive guide
    print("\n" + "=" * 70)
    print("📖 Complete Trip.com Implementation Guide")
    print("=" * 70)
    
    try:
        response = requests.post(
            f"{SHIP_AGENT_URL}/implementation/guide",
            json={"program_type": "trip.com"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            guide = data['guide']
            
            print(f"\n✅ {guide.get('program_name', 'Trip.com')}")
            print(f"\n🎯 Key Features:")
            for feature in guide.get('key_features', []):
                print(f"  • {feature}")
            
            print(f"\n📅 Implementation Phases:")
            for i, phase in enumerate(guide.get('implementation_phases', []), 1):
                print(f"  {i}. {phase}")
            
            print(f"\n📊 Available Sections:")
            for section in guide.get('sections', []):
                print(f"  • {section['title']}")
    
    except Exception as e:
        print(f"❌ Error getting guide: {e}")
    
    # Get best practices
    print("\n" + "=" * 70)
    print("✨ Trip.com Best Practices")
    print("=" * 70)
    
    try:
        response = requests.get(
            f"{SHIP_AGENT_URL}/implementation/best-practices/trip.com",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            practices = data.get('best_practices', {})
            
            # Show Trip.com specific practices
            if 'booking_flow' in practices:
                print("\n🎫 Booking Flow Best Practices:")
                for practice in practices['booking_flow']:
                    print(f"  • {practice}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 70)
    print("✅ Demo Complete!")
    print("=" * 70)
    print("\n💡 The enhanced ship-agent can now provide:")
    print("  • Specific implementation guidance for Trip.com")
    print("  • Step-by-step integration instructions")
    print("  • Best practices and common patterns")
    print("  • Operation-specific recommendations")
    print("  • Error handling strategies")

if __name__ == "__main__":
    demo_tripcom_implementation()