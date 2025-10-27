# Sentry AI Agent Monitoring - Manual Instrumentation Example

![Sentry AI Agent Monitoring](./public/custom-llm-monitoring.png)

<div align="center">

**A complete reference implementation demonstrating manual instrumentation of AI agents using Sentry's AI Monitoring capabilities.**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![Sentry](https://img.shields.io/badge/Sentry-AI%20Monitoring-purple?logo=sentry)](https://sentry.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)

[Live Demo](#getting-started) • [Documentation](#documentation) • [Architecture](#architecture)

</div>

---

## 🎯 What This Application Demonstrates

This example application showcases **production-ready manual instrumentation** for AI agents that don't use auto-instrumented libraries (OpenAI, Anthropic, etc.). Perfect for teams building with:

- Custom LLM APIs
- Proprietary AI models  
- In-house agent frameworks
- Non-standard AI tooling

### Key Features Demonstrated

✅ **Complete AI Agent Tracing Pipeline**
- Frontend → Backend distributed tracing
- LLM call instrumentation with token tracking
- Tool execution monitoring with performance metrics
- Multi-step agent reasoning flows

✅ **7 Fully-Instrumented Tools**
- Knowledge base search
- Order status lookup
- Account information retrieval
- Refund processing
- Inventory checks
- Callback scheduling
- Ticket creation

✅ **Production-Grade Monitoring**
- Per-tool token consumption tracking
- Cost analysis per agent invocation
- Tool usage patterns and performance
- Conversation quality metrics
- Error tracking across the AI pipeline

✅ **Follows Official Sentry Conventions**
- [AI Agent span standards](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/ai-agents-module/)
- Proper attribute naming and types
- Correct span operations and hierarchies
- Best practices for distributed tracing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- A Sentry account (optional for local testing)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure Sentry (optional)
# Create .env.local and add your Sentry DSN
echo "NEXT_PUBLIC_SENTRY_DSN=your-dsn-here" > .env.local

# 3. Start the development server
npm run dev

# 4. Open http://localhost:3000
```

### Testing the Demo

The application includes an in-app guide showing example phrases. Try these to trigger different tools:

```
"Where is my order?"          → check_order_status tool
"Check my account"            → get_account_info tool  
"Process a refund"            → process_refund tool
"Is this in stock?"           → check_inventory tool
"What's your return policy?"  → search_knowledge_base tool
"Can you call me back?"       → schedule_callback tool
"Escalate this issue"         → create_ticket tool
```

Each phrase triggers tool execution spans with complete instrumentation visible in Sentry.

## 📊 How It Works

### Architecture Overview

This application demonstrates a **distributed AI agent architecture** with complete observability:

```
┌─────────────────────────────────────────────────────────┐
│                    User Interaction                      │
│                  (Types: "Check my order")               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            FRONTEND (React Component)                    │
│  📊 Span: gen_ai.invoke_agent                           │
│  ├─ Attributes:                                         │
│  │  • gen_ai.agent.name: "Customer Support Agent"      │
│  │  • conversation.session_id: "session_xxx"           │
│  │  • conversation.turn: 1                             │
│  └─ Captures user-perceived latency                     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP POST /api/ai/chat
                         ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (Next.js API Route)                 │
│  📊 Span: gen_ai.invoke_agent                           │
│  ├─ Available Tools: [7 tools with descriptions]        │
│  │                                                       │
│  ├─ Step 1: Initial LLM Call                           │
│  │  📊 Span: gen_ai.chat                               │
│  │  ├─ Attributes:                                     │
│  │  │  • gen_ai.request.model: "custom-model-v2"      │
│  │  │  • gen_ai.request.messages: [...]               │
│  │  │  • gen_ai.usage.total_tokens: 150               │
│  │  └─ Response: "Let me check your order status"     │
│  │                                                       │
│  ├─ Step 2: Execute Tools (if needed)                  │
│  │  📊 Span: gen_ai.execute_tool                       │
│  │  ├─ Attributes:                                     │
│  │  │  • gen_ai.tool.name: "check_order_status"       │
│  │  │  • gen_ai.tool.description: "Look up orders"    │
│  │  │  • gen_ai.tool.input: '{"orderId":"ORD-123"}'   │
│  │  │  • gen_ai.tool.output: "Order shipped..."       │
│  │  │  • gen_ai.usage.total_tokens: 25                │
│  │  └─ Custom: order.id, tool duration                │
│  │                                                       │
│  └─ Step 3: Final Synthesis LLM Call                   │
│     📊 Span: gen_ai.chat                               │
│     ├─ Synthesizes tool results into response          │
│     └─ Tracks additional tokens: 45                    │
│                                                         │
│  Final Response:                                        │
│  ├─ Total Tokens: 220 (150 + 25 + 45)                 │
│  ├─ Tools Used: ["check_order_status"]                │
│  ├─ Resolution Status: "answered"                      │
│  └─ Cost Estimate: $0.0220                            │
└─────────────────────────────────────────────────────────┘
```

### Instrumentation Flow

#### 1. **Frontend Instrumentation** (`src/app/page.tsx`)

```typescript
// User sends a message
await Sentry.startSpan({
  name: 'invoke_agent Customer Support Agent',
  op: 'gen_ai.invoke_agent',
  attributes: {
    'gen_ai.operation.name': 'invoke_agent',
    'gen_ai.agent.name': 'Customer Support Agent',
    'gen_ai.system': 'custom-llm',
    'conversation.session_id': sessionId,
    'conversation.turn': conversationHistory.length + 1
  }
}, async (agentSpan) => {
  // Call backend
  const response = await fetch('/api/ai/chat', { ... });
  
  // Set response attributes
  agentSpan.setAttribute('gen_ai.response.text', response.message);
  agentSpan.setAttribute('gen_ai.usage.total_tokens', response.totalTokens);
  agentSpan.setAttribute('conversation.tools_used', response.toolsUsed.length);
});
```

**Why this matters:** Captures the complete user experience including network time, providing true end-to-end visibility.

#### 2. **Backend Agent Orchestration** (`src/app/api/ai/chat/route.ts`)

```typescript
// Backend receives request and starts agent span
await Sentry.startSpan({
  name: 'invoke_agent Customer Support Agent',
  op: 'gen_ai.invoke_agent',
  attributes: {
    'gen_ai.request.available_tools': JSON.stringify(tools),
    'conversation.session_id': sessionId
  }
}, async (agentSpan) => {
  // ... orchestrate LLM calls and tool executions
  
  // Set final attributes
  agentSpan.setAttribute('gen_ai.usage.total_tokens', totalTokens);
  agentSpan.setAttribute('conversation.tools_used', JSON.stringify(toolsUsed));
  agentSpan.setAttribute('conversation.resolution_status', resolutionStatus);
  agentSpan.setAttribute('conversation.cost_estimate_usd', costEstimate);
});
```

**Why this matters:** Central coordination point that aggregates all downstream metrics (tokens, tools, cost).

#### 3. **LLM Call Instrumentation**

```typescript
// Each LLM API call gets its own span
await Sentry.startSpan({
  name: 'chat custom-model-v2',
  op: 'gen_ai.chat',
  attributes: {
    'gen_ai.operation.name': 'chat',
    'gen_ai.request.model': 'custom-model-v2',
    'gen_ai.request.messages': JSON.stringify(messages),
    'gen_ai.request.temperature': 0.7,
    'gen_ai.request.max_tokens': 500
  }
}, async (llmSpan) => {
  const response = await callCustomLLM(...);
  
  // Track token usage
  llmSpan.setAttribute('gen_ai.usage.input_tokens', response.usage.prompt_tokens);
  llmSpan.setAttribute('gen_ai.usage.output_tokens', response.usage.completion_tokens);
  llmSpan.setAttribute('gen_ai.usage.total_tokens', response.usage.total_tokens);
  llmSpan.setAttribute('gen_ai.response.text', response.message);
});
```

**Why this matters:** Enables monitoring of LLM performance, cost per call, and response quality.

#### 4. **Tool Execution Instrumentation**

```typescript
// Each tool gets a dedicated span
await Sentry.startSpan({
  name: `execute_tool ${toolName}`,
  op: 'gen_ai.execute_tool',
  attributes: {
    'gen_ai.operation.name': 'execute_tool',
    'gen_ai.tool.name': toolName,
    'gen_ai.tool.description': toolDescription,
    'gen_ai.tool.type': 'function',
    'gen_ai.tool.input': JSON.stringify(args)
  }
}, async (toolSpan) => {
  const result = await executeTool(toolName, args);
  
  // Track tool-specific metrics
  toolSpan.setAttribute('gen_ai.tool.output', result);
  toolSpan.setAttribute('gen_ai.usage.total_tokens', toolTokens);
  
  // Custom business metrics
  toolSpan.setAttribute('order.id', orderId);
  toolSpan.setAttribute('search.results_count', resultCount);
});
```

**Why this matters:** Identifies slow or failing tools, tracks per-tool costs, enables optimization of agent workflows.

## 📈 What You Can Monitor

Once instrumented, this application enables powerful monitoring capabilities in Sentry:

### Agent Performance Metrics

**Cost Analysis**
- Total token consumption per conversation
- Average cost per agent invocation
- Token usage breakdown by LLM call vs. tool execution
- Per-tool token consumption patterns

**Performance Tracking**
- p50/p95/p99 latency of agent invocations
- LLM response time distribution
- Tool execution duration by tool type
- Conversation turn latency

**Quality Metrics**
- Resolution status distribution (answered, resolved, escalated)
- Tool usage patterns and frequency
- Conversations requiring escalation
- Average tools used per conversation

### Tool-Specific Insights

Each tool can be monitored independently:

```
check_order_status:
  - Average execution time
  - Success/failure rate
  - Token consumption
  - Custom: Order lookup patterns

search_knowledge_base:
  - Search result relevance (results_count)
  - Query patterns
  - Knowledge gaps (low result counts)

process_refund:
  - Refund amounts processed
  - Success rates
  - Processing time

get_account_info:
  - Lookup type distribution (email vs ID)
  - Cache hit rates (if implemented)
  - Data retrieval performance
```

### Example Sentry Queries

**Find expensive conversations:**
```
op:gen_ai.invoke_agent
WHERE gen_ai.usage.total_tokens > 500
GROUP BY conversation.session_id
```

**Identify slow tools:**
```
op:gen_ai.execute_tool
WHERE span.duration > 1s
GROUP BY gen_ai.tool.name
```

**Track escalation reasons:**
```
op:gen_ai.invoke_agent
WHERE conversation.resolution_status:escalated
```

**Monitor token costs by model:**
```
op:gen_ai.chat
SUM(gen_ai.usage.total_tokens)
GROUP BY gen_ai.request.model
```

## 🛠️ Technology Stack

- **Framework:** Next.js 16.0 (App Router)
- **Language:** TypeScript 5.x
- **Monitoring:** Sentry JavaScript SDK v10+
- **Styling:** Tailwind CSS
- **Runtime:** Node.js 18+

## 📁 Project Structure

```
llm-tracing-test/
├── src/
│   └── app/
│       ├── page.tsx                    # Frontend chat interface
│       │                               # - Agent span creation
│       │                               # - Session management
│       │                               # - User interaction tracking
│       │
│       └── api/ai/chat/
│           └── route.ts                # Backend agent orchestration
│                                       # - Agent invocation span
│                                       # - LLM call instrumentation
│                                       # - Tool execution spans
│                                       # - Token aggregation
│
├── sentry.client.config.ts            # Sentry frontend config
├── sentry.server.config.ts            # Sentry backend config
├── instrumentation.ts                 # Sentry initialization
│
├── TOOLS_DEMO_GUIDE.md                # Comprehensive tool documentation
├── CHANGELOG.md                       # Version history
└── README.md                          # This file
```

## 🔍 Key Implementation Details

### Following Sentry Standards

This implementation strictly follows [Sentry's AI Agent Monitoring conventions](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/ai-agents-module/):

**Required Attributes (Always Included)**
- `gen_ai.system`: Identifies the AI system (e.g., "custom-llm")
- `gen_ai.request.model`: Model identifier (e.g., "custom-model-v2")
- `gen_ai.operation.name`: Operation type (invoke_agent, chat, execute_tool)
- `SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN`: Set to 'manual.ai.custom-llm'

**Span Naming Conventions**
- Agent spans: `invoke_agent {agent_name}`
- Chat spans: `chat {model_name}`
- Tool spans: `execute_tool {tool_name}`

**Token Tracking**
- `gen_ai.usage.input_tokens`: Prompt tokens
- `gen_ai.usage.output_tokens`: Completion tokens
- `gen_ai.usage.total_tokens`: Sum of input + output
- Tool token usage tracked separately and aggregated

### Simulated LLM Behavior

The application includes a realistic LLM simulator:

```typescript
// Simulates API latency (300-1000ms)
await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

// Returns structured responses with:
// - Realistic token counts
// - Tool calls based on message content
// - Proper error handling
// - OpenAI-compatible response format
```

**Why simulate instead of real LLM?**
- Demonstrates pure instrumentation patterns
- No API keys required for testing
- Consistent, reproducible behavior
- Focuses on monitoring, not AI implementation

### The 7 Production-Ready Tools

Each tool demonstrates different monitoring patterns:

| Tool | Demonstrates | Custom Attributes |
|------|-------------|-------------------|
| `search_knowledge_base` | Search operations, result tracking | `search.query`, `search.results_count` |
| `check_order_status` | Database lookups, status tracking | `order.id` |
| `get_account_info` | CRM integration, data retrieval | `account.lookup_type` |
| `process_refund` | Transaction processing, amounts | `refund.order_id`, `refund.amount` |
| `check_inventory` | Stock checking, availability | `inventory.product_id` |
| `schedule_callback` | Scheduling operations, time tracking | `callback.scheduled_time`, `callback.phone` |
| `create_ticket` | Escalation, priority handling | `ticket.id`, `ticket.priority` |

All tools include:
- ✅ Description attribute for AI Insights dashboard
- ✅ Input/output serialization
- ✅ Token usage tracking (15-50 tokens per tool)
- ✅ Error instrumentation with error.type
- ✅ Custom business metrics
- ✅ Realistic execution latency (200-600ms)

📖 **[TOOLS_DEMO_GUIDE.md](./TOOLS_DEMO_GUIDE.md) - Complete tool documentation with trigger phrases and instrumentation details**

## 🎓 Learning Resources

### For Developers Implementing Similar Systems

**This example teaches:**
1. How to instrument custom AI agents without auto-instrumentation
2. Proper span hierarchy for distributed AI systems
3. Token tracking and cost attribution
4. Tool execution monitoring patterns
5. Error handling in AI pipelines
6. Custom business metric capture

**Adapt this for your use case:**
- Replace simulated LLM with your API calls
- Add your actual tools and keep the instrumentation patterns
- Customize attributes for your business metrics
- Add authentication and real data sources
- Deploy to production with confidence

### Documentation References

- [Sentry AI Agent Monitoring](https://docs.sentry.io/product/insights/ai/agents/dashboard/)
- [Manual LLM Instrumentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/ai-agents-module/)
- [Span Attributes Guide](https://docs.sentry.io/platforms/javascript/tracing/instrumentation/custom-instrumentation/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)

## 🤝 Contributing

This is an example repository demonstrating instrumentation patterns. Feel free to:

- Open issues for clarification questions
- Submit PRs for improved examples
- Suggest additional tool patterns
- Share your own implementations

## 📄 License

This example is provided as-is for educational purposes.

## 💬 Support

- **Issues:** Open a GitHub issue
- **Documentation:** [Sentry Docs](https://docs.sentry.io)
- **Community:** [Sentry Discord](https://discord.gg/sentry)

---

<div align="center">

**Built with ❤️ to demonstrate Sentry's AI Agent Monitoring**

[Sentry.io](https://sentry.io) | [Documentation](https://docs.sentry.io) | [GitHub](https://github.com/getsentry)

</div>