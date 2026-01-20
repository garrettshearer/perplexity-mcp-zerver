# Tool Schema Contracts: Model Switching

**Feature**: 001-model-switching  
**Date**: 2026-01-20

## Schema Updates

### chat_perplexity Tool

**Location**: `src/schema/toolSchemas.ts` → `chat_perplexity.inputSchema.properties`

**Add Property**:
```json
{
  "model": {
    "type": "string",
    "description": "Optional: AI model to use for this query. Case-insensitive matching. If not provided, uses the currently-selected model in Perplexity.",
    "examples": ["Claude 3.5 Sonnet", "GPT-4o", "Sonar"]
  }
}
```

**Full Updated Schema**:
```typescript
{
  name: "chat_perplexity",
  description: "Automatically call this tool for interactive, conversational queries...",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to send to Perplexity AI for web search",
        examples: ["Explain quantum computing", "Continue our previous discussion about AI safety"],
      },
      chat_id: {
        type: "string",
        description: "Optional: ID of an existing chat to continue...",
        examples: ["123e4567-e89b-12d3-a456-426614174000"],
      },
      chat_url: {
        type: "string",
        description: "Optional: Full Perplexity chat URL to continue an existing conversation...",
        examples: ["https://www.perplexity.ai/search/abc123-def456"],
      },
      space_id: {
        type: "string",
        description: "Optional: ID of a Perplexity Space to use for new conversations...",
        examples: ["abc123-def456"],
      },
      // NEW
      model: {
        type: "string",
        description: "Optional: AI model to use for this query. Case-insensitive matching. If not provided, uses the currently-selected model in Perplexity.",
        examples: ["Claude 3.5 Sonnet", "GPT-4o", "Sonar"],
      },
    },
    required: ["message"],
  },
  // ... rest unchanged
}
```

---

### search Tool

**Location**: `src/schema/toolSchemas.ts` → `search.inputSchema.properties`

**Add Property**:
```json
{
  "model": {
    "type": "string",
    "description": "Optional: AI model to use for this search. Case-insensitive matching. If not provided, uses the currently-selected model in Perplexity.",
    "examples": ["Claude 3.5 Sonnet", "GPT-4o", "Sonar"]
  }
}
```

**Full Updated Schema**:
```typescript
{
  name: "search",
  description: "Performs a web search using Perplexity AI...",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query or question to ask Perplexity.",
        examples: ["What is the capital of France?", "Explain black holes"],
      },
      detail_level: {
        type: "string",
        description: "Optional: Controls the level of detail in the response (default: normal).",
        enum: ["brief", "normal", "detailed"],
        examples: ["brief", "detailed"],
      },
      stream: {
        type: "boolean",
        description: "Optional: Enable streaming response (default: false).",
        examples: [true, false],
      },
      space_id: {
        type: "string",
        description: "Optional: ID of a Perplexity Space to search within...",
        examples: ["abc123-def456"],
      },
      // NEW
      model: {
        type: "string",
        description: "Optional: AI model to use for this search. Case-insensitive matching. If not provided, uses the currently-selected model in Perplexity.",
        examples: ["Claude 3.5 Sonnet", "GPT-4o", "Sonar"],
      },
    },
    required: ["query"],
  },
  // ... rest unchanged
}
```

---

## Backward Compatibility

- `model` property is **optional** (not in `required` array)
- Existing calls without `model` continue to work unchanged
- Empty string `""` is treated as undefined (no model switch)

## Validation Rules

| Rule | Validation |
|------|------------|
| Type | Must be `string` if provided |
| Empty handling | Empty/whitespace-only strings skip model switching |
| Length | No maximum length (model names vary) |
| Characters | Any characters allowed (model names may contain spaces, dots, numbers) |

## MCP Protocol Notes

- Schema exposed via `tools/list` response
- `examples` array helps clients suggest valid values
- No breaking changes to existing tool signatures
