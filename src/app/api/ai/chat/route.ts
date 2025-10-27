import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN } from '@sentry/nextjs';

interface ChatRequest {
  message: string;
  sessionId: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
}

interface TicketArgs {
  subject: string;
  priority?: string;
  category?: string;
}

interface CallbackArgs {
  phone: string;
  preferredTime?: string;
}

interface SynthesisResponse {
  message: string;
  usage: {
    total_tokens: number;
  };
}

interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string;
      tool_calls?: ToolCall[];
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function POST(request: NextRequest) {
  const { message, sessionId, conversationHistory }: ChatRequest = await request.json();

  return await Sentry.startSpan(
    {
      name: 'invoke_agent Customer Support Agent',
      op: 'gen_ai.invoke_agent',
      attributes: {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': 'Customer Support Agent',
        'gen_ai.system': 'custom-llm',
        'gen_ai.request.model': 'custom-model-v2',
        [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: 'manual.ai.custom-llm',
        'conversation.session_id': sessionId,
      },
    },
    async (agentSpan) => {
      try {
        const tools = [
          { name: 'search_knowledge_base', description: 'Search company knowledge base for answers' },
          { name: 'create_ticket', description: 'Create a support ticket for complex issues' },
          { name: 'check_order_status', description: 'Look up customer order information' },
          { name: 'get_account_info', description: 'Retrieve customer account details and membership status' },
          { name: 'process_refund', description: 'Process a refund for an order or transaction' },
          { name: 'check_inventory', description: 'Check product availability and stock levels' },
          { name: 'schedule_callback', description: 'Schedule a callback with support team' }
        ];
        
        agentSpan.setAttribute('gen_ai.request.available_tools', JSON.stringify(tools));
        
        let totalTokens = 0;
        const toolsUsed: string[] = [];
        let finalResponse = '';
        let resolutionStatus = 'in_progress';
        
        // Step 1: Call fake LLM for initial reasoning
        const llmResponse = await Sentry.startSpan(
          {
            name: 'chat custom-model-v2',
            op: 'gen_ai.chat',
            attributes: {
              'gen_ai.operation.name': 'chat',
              'gen_ai.system': 'custom-llm',
              'gen_ai.request.model': 'custom-model-v2',
              'gen_ai.request.messages': JSON.stringify([
                { role: 'system', content: 'You are a customer support agent. Use tools when needed.' },
                ...conversationHistory,
                { role: 'user', content: message }
              ]),
              'gen_ai.request.temperature': 0.7,
              'gen_ai.request.max_tokens': 500,
              [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: 'manual.ai.custom-llm',
            },
          },
          async (llmSpan) => {
            // Simulate LLM API call
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700)); // 300-1000ms delay
            
            const mockLLMResponse: LLMResponse = generateMockLLMResponse(message, conversationHistory);
            
            // Set LLM response attributes
            llmSpan.setAttribute('gen_ai.response.text', mockLLMResponse.choices[0].message.content || '');
            llmSpan.setAttribute('gen_ai.response.id', mockLLMResponse.id);
            llmSpan.setAttribute('gen_ai.response.model', mockLLMResponse.model);
            llmSpan.setAttribute('gen_ai.usage.input_tokens', mockLLMResponse.usage.prompt_tokens);
            llmSpan.setAttribute('gen_ai.usage.output_tokens', mockLLMResponse.usage.completion_tokens);
            llmSpan.setAttribute('gen_ai.usage.total_tokens', mockLLMResponse.usage.total_tokens);
            
            if (mockLLMResponse.choices[0].message.tool_calls) {
              llmSpan.setAttribute('gen_ai.response.tool_calls', JSON.stringify(mockLLMResponse.choices[0].message.tool_calls));
            }
            
            totalTokens += mockLLMResponse.usage.total_tokens;
            return mockLLMResponse;
          }
        );
        
        // Step 2: Execute any tool calls
        if (llmResponse.choices[0].message.tool_calls) {
          for (const toolCall of llmResponse.choices[0].message.tool_calls) {
            // Find tool description from available tools
            const toolDefinition = tools.find(t => t.name === toolCall.function.name);
            
            await Sentry.startSpan(
              {
                name: `execute_tool ${toolCall.function.name}`,
                op: 'gen_ai.execute_tool',
                attributes: {
                  'gen_ai.operation.name': 'execute_tool',
                  'gen_ai.tool.name': toolCall.function.name,
                  'gen_ai.tool.description': toolDefinition?.description || '',
                  'gen_ai.tool.type': 'function',
                  'gen_ai.tool.input': toolCall.function.arguments,
                  'gen_ai.system': 'custom-llm',
                  'gen_ai.request.model': 'custom-model-v2',
                  [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: 'manual.ai.custom-llm',
                },
              },
              async (toolSpan) => {
                let toolOutput = '';
                let toolTokensUsed = 0;
                
                try {
                  // Simulate tool execution delay
                  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400)); // 200-600ms delay
                  
                  // Execute the fake tool
                  switch (toolCall.function.name) {
                    case 'search_knowledge_base':
                      const searchArgs = JSON.parse(toolCall.function.arguments);
                      toolOutput = await searchKnowledgeBase(searchArgs.query);
                      toolTokensUsed = 25 + Math.floor(Math.random() * 15); // 25-40 tokens
                      toolSpan.setAttribute('search.query', searchArgs.query);
                      toolSpan.setAttribute('search.results_count', toolOutput.split('\n').length);
                      break;
                      
                    case 'create_ticket':
                      const ticketArgs = JSON.parse(toolCall.function.arguments);
                      const ticketId = await createSupportTicket(ticketArgs);
                      toolOutput = `Created support ticket #${ticketId}`;
                      toolTokensUsed = 15 + Math.floor(Math.random() * 10); // 15-25 tokens
                      toolSpan.setAttribute('ticket.id', ticketId);
                      toolSpan.setAttribute('ticket.priority', ticketArgs.priority || 'medium');
                      resolutionStatus = 'escalated';
                      break;
                      
                    case 'check_order_status':
                      const orderArgs = JSON.parse(toolCall.function.arguments);
                      toolOutput = await checkOrderStatus(orderArgs.orderId);
                      toolTokensUsed = 20 + Math.floor(Math.random() * 10); // 20-30 tokens
                      toolSpan.setAttribute('order.id', orderArgs.orderId);
                      break;
                      
                    case 'get_account_info':
                      const accountArgs = JSON.parse(toolCall.function.arguments);
                      toolOutput = await getAccountInfo(accountArgs.customerId || accountArgs.email);
                      toolTokensUsed = 30 + Math.floor(Math.random() * 20); // 30-50 tokens
                      toolSpan.setAttribute('account.lookup_type', accountArgs.customerId ? 'customer_id' : 'email');
                      break;
                      
                    case 'process_refund':
                      const refundArgs = JSON.parse(toolCall.function.arguments);
                      toolOutput = await processRefund(refundArgs.orderId, refundArgs.amount);
                      toolTokensUsed = 35 + Math.floor(Math.random() * 15); // 35-50 tokens
                      toolSpan.setAttribute('refund.order_id', refundArgs.orderId);
                      toolSpan.setAttribute('refund.amount', refundArgs.amount);
                      resolutionStatus = 'resolved';
                      break;
                      
                    case 'check_inventory':
                      const inventoryArgs = JSON.parse(toolCall.function.arguments);
                      toolOutput = await checkInventory(inventoryArgs.productId || inventoryArgs.sku);
                      toolTokensUsed = 25 + Math.floor(Math.random() * 15); // 25-40 tokens
                      toolSpan.setAttribute('inventory.product_id', inventoryArgs.productId || inventoryArgs.sku);
                      break;
                      
                    case 'schedule_callback':
                      const callbackArgs = JSON.parse(toolCall.function.arguments);
                      toolOutput = await scheduleCallback(callbackArgs);
                      toolTokensUsed = 20 + Math.floor(Math.random() * 10); // 20-30 tokens
                      toolSpan.setAttribute('callback.scheduled_time', callbackArgs.preferredTime || 'next_available');
                      toolSpan.setAttribute('callback.phone', callbackArgs.phone || 'account_default');
                      break;
                      
                    default:
                      throw new Error(`Unknown tool: ${toolCall.function.name}`);
                  }
                  
                  toolSpan.setAttribute('gen_ai.tool.output', toolOutput);
                  toolSpan.setAttribute('gen_ai.usage.total_tokens', toolTokensUsed);
                  toolsUsed.push(toolCall.function.name);
                  totalTokens += toolTokensUsed;
                  
                } catch (toolError) {
                  toolSpan.setStatus({ code: 2, message: 'tool_execution_failed' });
                  toolSpan.setAttribute('error.type', toolError instanceof Error ? toolError.constructor.name : 'UnknownError');
                  toolSpan.setAttribute('error.message', toolError instanceof Error ? toolError.message : 'Unknown tool error');
                  toolOutput = `Error executing ${toolCall.function.name}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`;
                }
                
                return toolOutput;
              }
            );
          }
        }
        
        // Step 3: Generate final response (if tools were used)
        if (toolsUsed.length > 0) {
          await Sentry.startSpan(
            {
              name: 'chat custom-model-v2',
              op: 'gen_ai.chat',
              attributes: {
                'gen_ai.operation.name': 'chat',
                'gen_ai.system': 'custom-llm',
                'gen_ai.request.model': 'custom-model-v2',
                [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: 'manual.ai.custom-llm',
                'llm.call_type': 'final_synthesis',
              },
            },
            async (finalSpan) => {
              // Simulate final LLM call
              await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
              const synthesisResponse = await synthesizeResponse(llmResponse, toolsUsed);
              
              finalSpan.setAttribute('gen_ai.response.text', synthesisResponse.message);
              finalSpan.setAttribute('gen_ai.usage.total_tokens', synthesisResponse.usage.total_tokens);
              
              totalTokens += synthesisResponse.usage.total_tokens;
              finalResponse = synthesisResponse.message;
              
              return synthesisResponse;
            }
          );
        } else {
          finalResponse = llmResponse.choices[0].message.content;
        }
        
        // Determine resolution status
        if (toolsUsed.includes('create_ticket')) {
          resolutionStatus = 'escalated';
        } else if (finalResponse.toLowerCase().includes('resolved') || finalResponse.toLowerCase().includes('solved')) {
          resolutionStatus = 'resolved';
        } else {
          resolutionStatus = 'answered';
        }
        
        // Set final agent span attributes
        agentSpan.setAttribute('gen_ai.response.text', finalResponse);
        agentSpan.setAttribute('gen_ai.response.model', 'custom-model-v2');
        agentSpan.setAttribute('gen_ai.usage.total_tokens', totalTokens);
        agentSpan.setAttribute('conversation.tools_used_count', toolsUsed.length);
        agentSpan.setAttribute('conversation.tools_used', JSON.stringify(toolsUsed));
        agentSpan.setAttribute('conversation.resolution_status', resolutionStatus);
        agentSpan.setAttribute('conversation.cost_estimate_usd', (totalTokens * 0.0001).toFixed(4));
        
        return NextResponse.json({
          message: finalResponse,
          responseId: `resp_${Date.now()}`,
          totalTokens,
          toolsUsed,
          resolutionStatus,
        });
        
      } catch (error) {
        agentSpan.setStatus({ code: 2, message: 'agent_invocation_failed' });
        agentSpan.setAttribute('error.type', error instanceof Error ? error.constructor.name : 'UnknownError');
        Sentry.captureException(error);
        return NextResponse.json({ error: 'AI agent processing failed' }, { status: 500 });
      }
    }
  );
}

// Helper functions for fake LLM and tools
function generateMockLLMResponse(message: string, _history: Array<{ role: string; content: string }>): LLMResponse {
  const lowerMessage = message.toLowerCase();
  let shouldUseTool = false;
  let toolCalls: ToolCall[] = [];
  let responseText = '';
  
  // Determine if we should use tools based on message content
  // Priority order matters - more specific patterns first
  
  // 1. Process Refund - needs "refund" + action word
  if (lowerMessage.includes('refund') && (
    lowerMessage.includes('process') || 
    lowerMessage.includes('start') || 
    lowerMessage.includes('initiate') ||
    lowerMessage.includes('give me') ||
    lowerMessage.includes('want')
  )) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'process_refund',
        arguments: JSON.stringify({ orderId: 'ORD-12345', amount: 49.99 })
      }
    }];
    responseText = 'I can process that refund for you right away.';
  }
  // 2. Check Inventory
  else if (
    lowerMessage.includes('inventory') ||
    lowerMessage.includes('in stock') ||
    lowerMessage.includes('available') ||
    (lowerMessage.includes('check') && lowerMessage.includes('stock')) ||
    lowerMessage.includes('availability')
  ) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'check_inventory',
        arguments: JSON.stringify({ productId: 'PROD-456', sku: 'SKU-ABC123' })
      }
    }];
    responseText = 'Let me check if that item is in stock.';
  }
  // 3. Schedule Callback
  else if (
    lowerMessage.includes('callback') ||
    lowerMessage.includes('call me back') ||
    lowerMessage.includes('call me') ||
    lowerMessage.includes('schedule') && lowerMessage.includes('call') ||
    (lowerMessage.includes('phone') && !lowerMessage.includes('number'))
  ) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'schedule_callback',
        arguments: JSON.stringify({ phone: '555-0123', preferredTime: 'tomorrow 2pm' })
      }
    }];
    responseText = 'I can schedule a callback for you.';
  }
  // 4. Get Account Info
  else if (
    lowerMessage.includes('account') ||
    lowerMessage.includes('profile') ||
    lowerMessage.includes('membership') ||
    (lowerMessage.includes('my') && lowerMessage.includes('info'))
  ) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'get_account_info',
        arguments: JSON.stringify({ customerId: 'CUST-67890' })
      }
    }];
    responseText = 'Let me pull up your account information.';
  }
  // 5. Check Order Status
  else if (
    (lowerMessage.includes('order') && (
      lowerMessage.includes('status') ||
      lowerMessage.includes('track') ||
      lowerMessage.includes('where') ||
      lowerMessage.includes('check')
    )) ||
    lowerMessage.includes('tracking') ||
    lowerMessage.includes('shipment')
  ) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'check_order_status',
        arguments: JSON.stringify({ orderId: 'ORD-12345' })
      }
    }];
    responseText = 'Let me check your order status for you.';
  }
  // 6. Search Knowledge Base (returns/policy questions)
  else if (
    lowerMessage.includes('return') ||
    lowerMessage.includes('exchange') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('refund policy') ||
    (lowerMessage.includes('how') && lowerMessage.includes('return'))
  ) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'search_knowledge_base',
        arguments: JSON.stringify({ query: 'return policy refund process' })
      }
    }];
    responseText = 'Let me look up our return policy for you.';
  }
  // 7. Create Ticket (escalation)
  else if (
    lowerMessage.includes('escalate') ||
    lowerMessage.includes('manager') ||
    lowerMessage.includes('supervisor') ||
    lowerMessage.includes('speak to') ||
    lowerMessage.includes('ticket') ||
    lowerMessage.includes('complex')
  ) {
    shouldUseTool = true;
    toolCalls = [{
      function: {
        name: 'create_ticket',
        arguments: JSON.stringify({ subject: message, priority: 'high', category: 'escalation' })
      }
    }];
    responseText = 'This seems like a complex issue. Let me create a ticket for you.';
  }
  // Default responses
  else {
    const responses = [
      "I'd be happy to help you with that! Let me provide you with some information.",
      "Thank you for reaching out. Here's what I can tell you about your question.",
      "I understand your concern. Let me help you resolve this issue.",
      "That's a great question! I'll do my best to provide you with a helpful answer.",
    ];
    responseText = responses[Math.floor(Math.random() * responses.length)];
    
    if (lowerMessage.includes('thank')) {
      responseText = "You're very welcome! Is there anything else I can help you with today?";
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      responseText = "Hello! Welcome to customer support. How can I assist you today?";
    }
  }
  
  // Calculate total tokens
  const promptTokens = 50 + Math.floor(Math.random() * 100);
  const completionTokens = 20 + Math.floor(Math.random() * 80);
  
  return {
    id: `chatcmpl_${Date.now()}`,
    model: 'custom-model-v2',
    choices: [{
      message: {
        content: responseText,
        tool_calls: shouldUseTool ? toolCalls : undefined
      }
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}

// Mock tool implementations
async function searchKnowledgeBase(_query: string): Promise<string> {
  const results = [
    "Our return policy allows returns within 30 days of purchase.",
    "Refunds are processed within 5-7 business days after we receive the item.",
    "Items must be in original condition with tags attached.",
    "Free return shipping is provided for defective items."
  ];
  return results.join('\n');
}

async function createSupportTicket(_args: TicketArgs): Promise<string> {
  return `TICKET-${Date.now()}`;
}

async function checkOrderStatus(_orderId: string): Promise<string> {
  const statuses = [
    "Your order is being prepared for shipment.",
    "Your order has been shipped! Tracking number: TRK123456789",
    "Your order was delivered yesterday at 2:30 PM.",
    "Your order is currently in transit and should arrive tomorrow."
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

async function synthesizeResponse(_llmResponse: LLMResponse, toolsUsed: string[]): Promise<SynthesisResponse> {
  const responses = [
    "Based on the information I found, here's what I can tell you:",
    "After checking our systems, I have an update for you:",
    "I've looked into this for you and here's what I found:",
    "Thank you for waiting. I have the information you requested:",
  ];
  
  return {
    message: responses[Math.floor(Math.random() * responses.length)] + " " + generateFollowUpResponse(toolsUsed),
    usage: { total_tokens: 30 + Math.floor(Math.random() * 50) }
  };
}

async function getAccountInfo(identifier: string): Promise<string> {
  const accountTypes = ['Premium', 'Standard', 'Basic'];
  const accountType = accountTypes[Math.floor(Math.random() * accountTypes.length)];
  const memberSince = new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), 1).toLocaleDateString();
  
  return JSON.stringify({
    customerId: identifier,
    accountType: accountType,
    memberSince: memberSince,
    status: 'Active',
    rewardPoints: Math.floor(Math.random() * 5000),
    email: 'customer@example.com'
  });
}

async function processRefund(orderId: string, amount: number): Promise<string> {
  const refundId = `REF-${Date.now()}`;
  const processingDays = 5 + Math.floor(Math.random() * 3);
  
  return JSON.stringify({
    refundId: refundId,
    orderId: orderId,
    amount: amount,
    status: 'Processing',
    estimatedCompletion: `${processingDays}-${processingDays + 2} business days`,
    refundMethod: 'Original payment method'
  });
}

async function checkInventory(productId: string): Promise<string> {
  const inStock = Math.random() > 0.3; // 70% chance of being in stock
  const quantity = inStock ? Math.floor(Math.random() * 50) + 1 : 0;
  
  return JSON.stringify({
    productId: productId,
    inStock: inStock,
    quantity: quantity,
    warehouse: inStock ? ['CA-Warehouse-1', 'NY-Warehouse-2', 'TX-Warehouse-3'][Math.floor(Math.random() * 3)] : 'N/A',
    nextRestockDate: inStock ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
  });
}

async function scheduleCallback(args: CallbackArgs): Promise<string> {
  const confirmationId = `CB-${Date.now()}`;
  
  return JSON.stringify({
    confirmationId: confirmationId,
    scheduledTime: args.preferredTime || 'Next available slot',
    phone: args.phone,
    estimatedCallWindow: '30 minutes',
    status: 'Scheduled',
    agentAssigned: `Agent-${Math.floor(Math.random() * 100)}`
  });
}

function generateFollowUpResponse(toolsUsed: string[]): string {
  if (toolsUsed.includes('check_order_status')) {
    return "Your order is on its way! You should receive it within the next 1-2 business days. Is there anything else I can help you with regarding your order?";
  } else if (toolsUsed.includes('get_account_info')) {
    return "I've retrieved your account information. Your account is in good standing and you have reward points available. Would you like to know more about your benefits?";
  } else if (toolsUsed.includes('process_refund')) {
    return "Your refund has been initiated successfully! You should see it in your account within 5-7 business days. Is there anything else I can help you with?";
  } else if (toolsUsed.includes('check_inventory')) {
    return "I've checked our inventory for that item. We have stock available and can ship it to you right away. Would you like to place an order?";
  } else if (toolsUsed.includes('schedule_callback')) {
    return "Your callback has been scheduled successfully! One of our support specialists will call you at the requested time. Is there anything else I can help you with today?";
  } else if (toolsUsed.includes('search_knowledge_base')) {
    return "I've found the relevant policy information for you. You can return items within 30 days for a full refund. Would you like me to help you start the return process?";
  } else if (toolsUsed.includes('create_ticket')) {
    return "I've created a priority ticket for your issue and our specialist team will reach out to you within 24 hours. Is there anything else I can help you with in the meantime?";
  }
  return "I hope this information helps! Let me know if you have any other questions.";
}
