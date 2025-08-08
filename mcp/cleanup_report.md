# Cleanup Report - Agents and MCP

## Executive Summary
Identified redundant and unused implementations across agents and MCP servers that can be safely removed.

## 1. MCP Server Cleanup

### Files to KEEP (Production):
- `src/data_server.py` - Fast data access server (production)
- `src/solutions_mcp_server_v2.py` - Solutions server using Postman as source (production)
- `src/postman_sync.py` - Utility for syncing Postman to operations

### Files to REMOVE (Redundant/Old):
- `src/solutions_mcp_server.py` - Old version, replaced by V2
- `test_data_server.py` - Test file in root (should be in tests/)
- `test_solutions_server.py` - Test file in root (should be in tests/)

### Unused Test Files to REMOVE:
- `tests/direct_test.py`
- `tests/test_components.py`
- `tests/test_mcp_client.py`
- `tests/test_minimal_server.py`
- `tests/test_server.py`

## 2. Agent Cleanup

### Advisory Agent
**Files to KEEP:**
- `src/api.py` - Main API implementation
- `src/agent_router.py` - Current routing logic
- `src/query_classifier.py` - Query classification

**Files to REMOVE:**
- `src/agent_router_enhanced.py` - Duplicate/experimental version

### Document Agent
**Status:** All files appear to be in use
- Web scraper, chunker, embedder, FAISS retriever, LLM agent, API

### Schema Agent
**Status:** All files appear to be in use
- Chunker, embedder, retriever, LLM agent, pattern generator, etc.

### Ship Agent
**Files to REVIEW:**
- `test_multi_agent_enhanced.py` - Test file in root (should be in tests/)
- `src/implementation_llm_agent.py` - Check if still used

## 3. Root Directory Cleanup

### Files Generated During Testing (TO REMOVE):
- `trip_com_solution.md` - Generated solution doc
- `trip_com_solution_enhanced.md` - Generated solution doc
- `trip_com_solution_comparison.md` - Comparison doc

## 4. Configuration Cleanup

### Keep:
- `claude_config.json` - Active Claude configuration
- `pyproject.toml` - Project configuration

### Review:
- `config/server_config.json` - Check if still needed
- `embeddings/` - Large index files, check if needed

## 5. Documentation Cleanup

### Keep:
- `README.md` - Main documentation
- `README_DATA_SERVER.md` - Data server docs

### Consider Consolidating:
- Multiple README files could be consolidated into one comprehensive guide

## Recommended Actions

### Phase 1: Remove Obvious Duplicates
```bash
# Remove old MCP server version
rm mcp/src/solutions_mcp_server.py

# Remove test files from root
rm mcp/test_data_server.py
rm mcp/test_solutions_server.py

# Remove unused test directory
rm -rf mcp/tests/

# Remove experimental advisory agent file
rm agents/advisory-agent/src/agent_router_enhanced.py

# Remove test file from ship-agent root
rm agents/ship-agent/test_multi_agent_enhanced.py
```

### Phase 2: Clean Generated Files
```bash
# Remove generated solution documents
rm mcp/trip_com_solution*.md
```

### Phase 3: Reorganize Tests
- Move any valuable tests to proper test directories
- Consolidate test utilities

## Impact Assessment

### Low Risk Removals:
- Old MCP server versions
- Test files in wrong locations
- Generated documentation

### Medium Risk:
- Unused test directories
- Experimental implementations

### High Risk (Need Review):
- Any file that might be imported by other modules
- Configuration files

## Storage Savings
Estimated space saved: ~5-10 MB (excluding embeddings)

## Final Recommendations

1. **Immediate:** Remove duplicate/old MCP implementations
2. **Short-term:** Clean up test files and organize properly
3. **Long-term:** Consider consolidating agent implementations where there's overlap
4. **Documentation:** Update README to reflect current architecture

## Post-Cleanup Structure

```
mcp/
├── src/
│   ├── data_server.py          # Fast data access
│   ├── solutions_mcp_server_v2.py  # Solutions with Postman
│   └── postman_sync.py         # Sync utility
├── claude_config.json
├── launch.sh
├── launch_solutions.sh
└── README.md

agents/
├── advisory-agent/
│   └── src/
│       ├── api.py
│       ├── agent_router.py
│       └── query_classifier.py
├── document-agent/  # (unchanged)
├── schema-agent/    # (unchanged)
└── ship-agent/      # (review implementation_llm_agent.py)
```