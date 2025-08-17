import { useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { useChat } from './hooks/useChat';
import './App.css';

export default function App() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 AI Assistant</h1>
          <p>Powered by Cloudflare Workers + GraphQL + GPT</p>
          <div className="header-actions">
            <span className="api-info">
              API: {import.meta.env.VITE_API_BASE || '/graphql (relative)'}
            </span>
            <button onClick={clearChat} className="clear-button">
              🗑️ Clear Chat
            </button>
          </div>
        </div>
      </header>

      <main className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="welcome-message">
              <div className="welcome-content">
                <h2>👋 Welcome!</h2>
                <p>I'm your AI assistant. Ask me anything or request a summary!</p>
                <div className="example-prompts">
                  <p>Try these examples:</p>
                  <button 
                    onClick={() => sendMessage("Explain how React hooks work")}
                    className="example-button"
                  >
                    "Explain how React hooks work"
                  </button>
                  <button 
                    onClick={() => sendMessage("What is the difference between REST and GraphQL?")}
                    className="example-button"
                  >
                    "What is the difference between REST and GraphQL?"
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={isLoading ? "AI is thinking..." : "Ask me anything..."}
        />
      </main>
    </div>
  );
}