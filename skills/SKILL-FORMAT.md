# AI Agent Skill Format Specification

## Overview
This document defines the standardized format for AI agent skills that can be used by any AI system.

## Skill File Structure

Each skill is a JSON file with the following structure:

```json
{
  "name": "agent-name",
  "displayName": "Agent Display Name",
  "version": "1.0.0",
  "category": "category-name",
  "description": "One-line description of what this agent does",
  "longDescription": "Detailed description of capabilities and use cases",
  "pricing": "free|oss|saas|enterprise",
  "url": "https://agent-website.com",
  "documentation": "https://docs.agent-website.com",
  "installCommand": "npm install agent-name",
  "pipInstall": "pip install agent-name",
  "dockerImage": "agent-name:latest",
  "mcpServers": [],
  "tools": [],
  "capabilities": [],
  "useCases": [],
  "integrations": [],
  "requirements": {
    "node": ">=18.0.0",
    "python": ">=3.8",
    "docker": false
  },
  "examples": [],
  "relatedAgents": []
}
```

## Field Definitions

### Required Fields
- `name`: Unique identifier (lowercase, hyphenated)
- `displayName`: Human-readable name
- `version`: Semantic version
- `category`: Category from the list below
- `description`: One-line description
- `pricing`: Pricing tier

### Optional Fields
- `longDescription`: Extended description
- `url`: Official website
- `documentation`: Documentation URL
- `installCommand`: npm/yarn install command
- `pipInstall`: pip install command
- `dockerImage`: Docker image reference
- `mcpServers`: Array of MCP server configurations
- `tools`: Array of tool definitions
- `capabilities`: Array of capability strings
- `useCases`: Array of use case objects
- `integrations`: Array of integration names
- `requirements`: System requirements
- `examples`: Array of example configurations
- `relatedAgents`: Array of related agent names

## Categories
- coding-agents
- multi-agent-frameworks
- browser-web-agents
- voice-ai
- data-analytics
- rag-memory
- vertical-agents
- dev-tools-mcp
- agent-orchestration
- enterprise-platforms
- creative-ai
- task-workflow
- customer-support
- local-selfhosted
- protocols-standards
- observability-eval
- open-source-models
- ai-safety
- ai-governance
- cybersecurity

## MCP Server Configuration

```json
{
  "mcpServers": [
    {
      "name": "server-name",
      "command": "npx",
      "args": ["-y", "mcp-server-name"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  ]
}
```

## Tool Definition

```json
{
  "tools": [
    {
      "name": "tool-name",
      "description": "What the tool does",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  ]
}
```

## Use Case Definition

```json
{
  "useCases": [
    {
      "name": "Use case name",
      "description": "Description of the use case",
      "impact": "Expected impact or benefit",
      "complexity": "low|medium|high"
    }
  ]
}
```
