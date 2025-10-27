'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN } from '@sentry/nextjs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  message: string;
  responseId: string;
  totalTokens: number;
  toolsUsed: string[];
  resolutionStatus: string;
}

export default function CustomerSupportChat() {
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Generate sessionId on client-side only to avoid hydration mismatch
  useEffect(() => {
    setSessionId(`session_${Date.now()}`);
  }, []);

  const handleSendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    await Sentry.startSpan(
      {
        name: 'invoke_agent Customer Support Agent',
        op: 'gen_ai.invoke_agent',
        attributes: {
          'gen_ai.operation.name': 'invoke_agent',
          'gen_ai.agent.name': 'Customer Support Agent',
          'gen_ai.system': 'custom-llm',
          'gen_ai.request.model': 'custom-model-v2',
          'gen_ai.request.messages': JSON.stringify([
            { role: 'system', content: 'You are a helpful customer support agent.' },
            ...conversationHistory,
            { role: 'user', content: userMessage }
          ]),
          [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: 'manual.ai.custom-llm',
          'conversation.turn': conversationHistory.length + 1,
          'conversation.session_id': sessionId,
        },
      },
      async (agentSpan) => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Add user message immediately
          setConversationHistory(prev => [...prev, { role: 'user', content: userMessage }]);
          
          // Call backend AI agent endpoint
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userMessage,
              sessionId: sessionId,
              conversationHistory: conversationHistory
            })
          });

          if (!response.ok) {
            throw new Error(`AI request failed: ${response.status}`);
          }

          const aiResponse: AIResponse = await response.json();
          
          // Set response attributes
          agentSpan.setAttribute('gen_ai.response.text', aiResponse.message);
          agentSpan.setAttribute('gen_ai.response.id', aiResponse.responseId);
          agentSpan.setAttribute('gen_ai.response.model', 'custom-model-v2');
          agentSpan.setAttribute('gen_ai.usage.total_tokens', aiResponse.totalTokens);
          agentSpan.setAttribute('conversation.tools_used', aiResponse.toolsUsed?.length || 0);
          agentSpan.setAttribute('conversation.resolution_status', aiResponse.resolutionStatus);
          
          // Add assistant response
          setConversationHistory(prev => [
            ...prev,
            { role: 'assistant', content: aiResponse.message }
          ]);
          
          Sentry.logger.info(Sentry.logger.fmt`AI agent completed conversation turn ${conversationHistory.length + 1}`);
          
        } catch (error) {
          agentSpan.setStatus({ code: 2, message: 'internal_error' });
          agentSpan.setAttribute('error.type', error instanceof Error ? error.constructor.name : 'UnknownError');
          setError('Failed to get AI response. Please try again.');
          Sentry.logger.error(Sentry.logger.fmt`AI agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentMessage.trim() && !isLoading) {
      handleSendMessage(currentMessage);
      setCurrentMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Customer Support Chat</h1>
            <p className="text-sm text-gray-600 mt-1">
              Session ID: {sessionId} | Manual LLM Instrumentation Demo
            </p>
          </div>

          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto px-6 py-4 space-y-4">
            {conversationHistory.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p>👋 Welcome to Customer Support!</p>
                <p className="text-sm mt-2">Ask me anything about orders, returns, or general questions.</p>
              </div>
            )}
            
            {conversationHistory.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm font-medium mb-1">
                    {message.role === 'user' ? 'You' : 'Support Agent'}
                  </p>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                  <p className="text-sm font-medium mb-1">Support Agent</p>
                  <div className="flex items-center">
                    <span className="animate-pulse">Thinking...</span>
                    <div className="ml-2 flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-6 py-2">
              <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="border-t border-gray-200 px-6 py-4">
            <form onSubmit={handleSubmit} className="flex space-x-4">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={isLoading || !currentMessage.trim()}
                className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-4 bg-gray-100 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">🔧 Tracing Debug Info</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Frontend spans: gen_ai.invoke_agent</p>
            <p>• Backend spans: gen_ai.invoke_agent → gen_ai.chat → gen_ai.execute_tool</p>
            <p>• Session tracking: {sessionId}</p>
            <p>• Messages sent: {Math.floor(conversationHistory.length / 2)}</p>
          </div>
        </div>

        {/* Tool Trigger Guide */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💡 Try These Phrases to Test Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div>
              <strong>📦 Order Status:</strong> "Where is my order?"
            </div>
            <div>
              <strong>👤 Account Info:</strong> "Check my account"
            </div>
            <div>
              <strong>💰 Process Refund:</strong> "Process a refund"
            </div>
            <div>
              <strong>📚 KB Search:</strong> "What's your return policy?"
            </div>
            <div>
              <strong>📦 Inventory:</strong> "Is this in stock?"
            </div>
            <div>
              <strong>📞 Callback:</strong> "Can you call me back?"
            </div>
            <div>
              <strong>🎫 Create Ticket:</strong> "Escalate this issue"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}