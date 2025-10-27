# AI Agent Tools Demo Guide

This guide shows you how to trigger different tools in the customer support chat demo for Sentry Agent Monitoring.

## Available Tools

The demo includes 7 instrumented tools that follow Sentry's AI agent monitoring conventions:

### 1. **search_knowledge_base**
- **Description**: Search company knowledge base for answers
- **Trigger Keywords**: `return`, `exchange`, `policy`, `how to return`
- **Example Phrases**:
  - *"What's your return policy?"*
  - *"How do I exchange an item?"*
  - *"Tell me about your refund policy"*
- **Instrumentation**: 
  - Includes `gen_ai.tool.description`
  - Tracks search query and results count
  - Token usage: 25-40 tokens
  - Tool type: `function`

### 2. **check_order_status**
- **Description**: Look up customer order information
- **Trigger Keywords**: `order status`, `track`, `tracking`, `shipment`, `where is my order`
- **Example Phrases**:
  - *"Where is my order?"*
  - *"Check order status"*
  - *"Track my shipment"*
- **Instrumentation**:
  - Tracks order ID
  - Token usage: 20-30 tokens
  - Simulates order lookup latency (200-600ms)

### 3. **get_account_info**
- **Description**: Retrieve customer account details and membership status
- **Trigger Keywords**: `account`, `profile`, `membership`, `my info`
- **Example Phrases**:
  - *"Check my account"*
  - *"Show me my profile"*
  - *"What's my membership status?"*
- **Instrumentation**:
  - Returns account type, reward points, member since date
  - Tracks lookup type (customer_id vs email)
  - Token usage: 30-50 tokens

### 4. **process_refund**
- **Description**: Process a refund for an order or transaction
- **Trigger Keywords**: `process refund`, `start refund`, `I want a refund`, `give me a refund`
- **Example Phrases**:
  - *"Process a refund for my order"*
  - *"I want a refund"*
  - *"Start a refund please"*
- **Instrumentation**:
  - Tracks refund amount and order ID
  - Sets resolution status to "resolved"
  - Token usage: 35-50 tokens

### 5. **check_inventory**
- **Description**: Check product availability and stock levels
- **Trigger Keywords**: `inventory`, `in stock`, `available`, `availability`, `check stock`
- **Example Phrases**:
  - *"Is this in stock?"*
  - *"Check inventory"*
  - *"What's the availability?"*
- **Instrumentation**:
  - Returns stock quantity and warehouse location
  - 70% chance of item being in stock
  - Tracks product ID
  - Token usage: 25-40 tokens

### 6. **schedule_callback**
- **Description**: Schedule a callback with support team
- **Trigger Keywords**: `callback`, `call me back`, `call me`, `schedule call`, `phone me`
- **Example Phrases**:
  - *"Can someone call me back?"*
  - *"Schedule a callback"*
  - *"I need a phone call"*
- **Instrumentation**:
  - Tracks scheduled time and phone number
  - Returns confirmation ID
  - Token usage: 20-30 tokens

### 7. **create_ticket**
- **Description**: Create a support ticket for complex issues
- **Trigger Keywords**: `escalate`, `manager`, `supervisor`, `ticket`, `complex`, `speak to`
- **Example Phrases**:
  - *"I need to speak to a manager"*
  - *"This is too complex"*
  - *"Create a ticket"*
  - *"Escalate this please"*
- **Instrumentation**:
  - Creates ticket with priority level
  - Sets resolution status to "escalated"
  - Tracks ticket ID
  - Token usage: 15-25 tokens

## Sentry Instrumentation Details

All tools follow the [Sentry AI Agent Monitoring conventions](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/ai-agents-module/):

### Execute Tool Span Attributes
Each tool execution creates a span with:
- **op**: `gen_ai.execute_tool` (REQUIRED)
- **name**: `execute_tool {tool_name}` (e.g., "execute_tool check_order_status")
- **gen_ai.operation.name**: `execute_tool`
- **gen_ai.tool.name**: Tool name
- **gen_ai.tool.description**: Tool description
- **gen_ai.tool.type**: `function`
- **gen_ai.tool.input**: Stringified input arguments
- **gen_ai.tool.output**: Stringified tool result
- **gen_ai.system**: `custom-llm`
- **gen_ai.request.model**: `custom-model-v2`

### Custom Attributes
Each tool also includes custom attributes specific to its function:
- **search_knowledge_base**: `search.query`, `search.results_count`
- **check_order_status**: `order.id`
- **get_account_info**: `account.lookup_type`
- **process_refund**: `refund.order_id`, `refund.amount`
- **check_inventory**: `inventory.product_id`
- **schedule_callback**: `callback.scheduled_time`, `callback.phone`
- **create_ticket**: `ticket.id`, `ticket.priority`

## Testing the Demo

### Quick Test Phrases

Try these exact phrases to trigger each tool (copy & paste ready):

```
1. "Where is my order?" → check_order_status
2. "What's your return policy?" → search_knowledge_base
3. "Check my account" → get_account_info
4. "Process a refund" → process_refund
5. "Is this in stock?" → check_inventory
6. "Can you call me back?" → schedule_callback
7. "Escalate this issue" → create_ticket
```

### Alternative Trigger Phrases

Each tool has multiple ways to trigger it:

**check_order_status**:
- "Track my order"
- "Order status"
- "Where's my shipment?"

**search_knowledge_base**:
- "Return policy"
- "How do I exchange?"
- "Refund policy"

**get_account_info**:
- "Show my profile"
- "Account details"
- "My membership"

**process_refund**:
- "I want a refund"
- "Start refund"
- "Give me a refund"

**check_inventory**:
- "Check stock"
- "Is it available?"
- "Inventory check"

**schedule_callback**:
- "Call me"
- "Schedule a call"
- "Phone me back"

**create_ticket**:
- "Speak to manager"
- "Create ticket"
- "This is complex"

### Viewing in Sentry

After triggering tools, check your Sentry dashboard:

1. **AI Insights**: View agent performance, tool usage, and token consumption
2. **Traces**: See the full span hierarchy:
   - `gen_ai.invoke_agent` (root span)
     - `gen_ai.chat` (LLM call)
     - `gen_ai.execute_tool` (tool executions)
     - `gen_ai.chat` (synthesis call)
3. **Performance**: Track tool execution latency (200-600ms simulated)
4. **Errors**: Tool execution errors are properly instrumented with error attributes

## Architecture

### Flow
1. User sends message → Frontend
2. Frontend creates `gen_ai.invoke_agent` span
3. Backend receives request, creates another `gen_ai.invoke_agent` span
4. Backend calls fake LLM (`gen_ai.chat`)
5. If tools needed, execute each with `gen_ai.execute_tool` span
6. Final synthesis call (`gen_ai.chat`)
7. Response returned with metadata

### Tool Execution
Each tool simulates realistic behavior:
- **Latency**: 200-600ms random delay
- **Data**: Realistic mock responses
- **Error handling**: Proper error instrumentation
- **Status tracking**: Resolution status updates

## Key Features for Demo

✅ **Standard Conventions**: All tools follow Sentry's OpenTelemetry-based conventions  
✅ **Rich Attributes**: Each tool includes both required and custom attributes  
✅ **Error Tracking**: Failed tool executions are properly instrumented  
✅ **Realistic Simulation**: Includes delays, randomization, and varied responses  
✅ **Complete Coverage**: Demonstrates full agent workflow from invocation to synthesis  
✅ **Token Tracking**: Accurate token counting across all LLM calls  
✅ **Resolution Status**: Tracks conversation outcome (answered, resolved, escalated)

## Next Steps

- View traces in Sentry to see the instrumentation
- Modify tool implementations for your specific use case
- Add more tools following the same pattern
- Integrate with real LLM APIs (OpenAI, Anthropic, etc.)
- Connect to actual backend services

---

**For Questions**: Refer to [Sentry AI Agent Monitoring Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/ai-agents-module/)

