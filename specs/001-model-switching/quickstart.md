# Quickstart: Model Switching

**Feature**: 001-model-switching  
**Date**: 2026-01-20

## Overview

The Model Switching feature allows you to specify which AI model to use when calling `search` or `chat_perplexity` tools. When a `model` parameter is provided, the system automatically selects that model from the Perplexity dropdown before executing your query.

## Basic Usage

### Search with Model Selection

```json
{
  "tool": "search",
  "arguments": {
    "query": "What are the latest developments in quantum computing?",
    "model": "Claude 3.5 Sonnet"
  }
}
```

### Chat with Model Selection

```json
{
  "tool": "chat_perplexity",
  "arguments": {
    "message": "Explain the implications of Moore's Law ending",
    "model": "GPT-4o"
  }
}
```

## Available Models

| Model | Best For |
|-------|----------|
| `Claude 3.5 Sonnet` | Complex reasoning, analysis |
| `GPT-4o` | General-purpose tasks |
| `Sonar` | Search-focused queries |
| `Sonar Large` | More detailed search results |

> **Note**: Available models may vary based on your Perplexity subscription.

## Case-Insensitive Matching

Model names are matched case-insensitively:

```json
// All of these work:
{ "model": "Claude 3.5 Sonnet" }
{ "model": "claude 3.5 sonnet" }
{ "model": "CLAUDE 3.5 SONNET" }
```

## Partial Matching

You can use partial names (first match wins):

```json
// Matches "Claude 3.5 Sonnet"
{ "model": "Claude" }

// Matches "GPT-4o"
{ "model": "GPT" }
```

## Default Behavior

When `model` is omitted, the currently-selected model in Perplexity is used:

```json
{
  "tool": "search",
  "arguments": {
    "query": "What is the capital of France?"
    // No model specified - uses current selection
  }
}
```

## Error Handling

### Model Not Found

If you request a model that doesn't exist:

```json
{
  "error": "Model \"NonExistent-Model\" not found in dropdown options. Available models: Claude 3.5 Sonnet, GPT-4o, Sonar, Sonar Large"
}
```

### Dropdown Not Accessible

If the model selector cannot be accessed:

```json
{
  "error": "Could not open model selector dropdown. Please ensure you are logged into Perplexity and the page has loaded."
}
```

## Combining with Other Features

### Model + Space

```json
{
  "tool": "search",
  "arguments": {
    "query": "Review this codebase",
    "model": "Claude 3.5 Sonnet",
    "space_id": "my-project-space"
  }
}
```

### Model + Chat Continuation

```json
{
  "tool": "chat_perplexity",
  "arguments": {
    "message": "Can you elaborate on that?",
    "chat_id": "existing-chat-uuid",
    "model": "GPT-4o"
  }
}
```

## Performance

- Model switching completes in under 3 seconds
- If the requested model is already selected, no switch occurs (instant)
- The first query after switching may take slightly longer as the model initializes

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Model selector not found" | Ensure you're logged into Perplexity Pro |
| Timeout errors | Check your internet connection |
| Wrong model selected | Use more specific model name |

---

## Code Examples (MCP Client)

### TypeScript/JavaScript

```typescript
const result = await mcpClient.callTool("search", {
  query: "Explain quantum entanglement",
  model: "Claude 3.5 Sonnet",
  detail_level: "detailed"
});
```

### Python

```python
result = mcp_client.call_tool("search", {
    "query": "Explain quantum entanglement",
    "model": "Claude 3.5 Sonnet",
    "detail_level": "detailed"
})
```
