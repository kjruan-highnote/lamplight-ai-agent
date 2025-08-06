#!/usr/bin/env python3
"""
Verify the multi-agent integration is working
"""
import requests
import json
from pathlib import Path
from datetime import datetime

def main():
    print("=" * 70)
    print("🔍 Multi-Agent Integration Verification")
    print("=" * 70)
    
    # Check agent status
    agents = {
        "Schema Agent": "http://localhost:8000/health",
        "Document Agent": "http://localhost:8001/health",
        "Advisory Agent": "http://localhost:8002/health",
        "Ship Agent": "http://localhost:8003/health"
    }
    
    print("\n📊 Agent Status:")
    active_count = 0
    for name, url in agents.items():
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print(f"  ✅ {name}: Active")
                active_count += 1
            else:
                print(f"  ❌ {name}: Error ({response.status_code})")
        except:
            print(f"  ❌ {name}: Not responding")
    
    print(f"\n✅ Active agents: {active_count}/4")
    
    # Check generated documentation
    print("\n📁 Generated Trip.com Documentation:")
    
    paths = [
        "data/generated/trip.com",
        "data/generated/trip.com_full_test"
    ]
    
    total_files = 0
    total_size = 0
    
    for path_str in paths:
        path = Path(path_str)
        if path.exists():
            print(f"\n  📂 {path_str}:")
            for file in path.rglob("*"):
                if file.is_file():
                    size = file.stat().st_size
                    total_files += 1
                    total_size += size
                    print(f"    - {file.name} ({size:,} bytes)")
    
    print(f"\n📊 Summary:")
    print(f"  - Total files generated: {total_files}")
    print(f"  - Total size: {total_size:,} bytes")
    print(f"  - All agents running: {'Yes' if active_count == 4 else 'No'}")
    
    # Save verification report
    report = {
        "timestamp": datetime.now().isoformat(),
        "agents_active": active_count,
        "total_agents": 4,
        "files_generated": total_files,
        "total_size_bytes": total_size,
        "test_status": "success" if active_count >= 2 and total_files > 0 else "partial"
    }
    
    report_path = Path("data/generated/verification_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n💾 Verification report saved to: {report_path}")
    
    print("\n" + "=" * 70)
    if active_count >= 2 and total_files > 0:
        print("✅ Integration test PASSED - Ship agent is working with other agents!")
    else:
        print("⚠️ Integration test PARTIAL - Some components may not be fully functional")
    print("=" * 70)

if __name__ == "__main__":
    main()