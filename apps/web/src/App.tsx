import { useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { useChat } from './hooks/useChat';
import { githubAutoTriageAndCreate } from './api';
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

  const testMCPFunction = async () => {
    try {
      const result = await githubAutoTriageAndCreate({
        owner: "samztz",
        repo: "github-issue-assistant", 
        title: "Bug: clicking save throws 500",
        body: "1) open\n2) click save\n3) 500; expected 200"
      });
      sendMessage(`MCP Test Result: ${JSON.stringify(result, null, 2)}`);
    } catch (error: any) {
      sendMessage(`MCP Test Error: ${error.message}`);
    }
  };

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
            <button 
              onClick={testMCPFunction} 
              className="clear-button" 
              style={{
                marginRight: '10px',
                backgroundColor: '#ff6b6b',
                color: 'white',
                fontWeight: 'bold'
              }}
            >
              🧪 Test MCP
            </button>
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
                  <button 
                    onClick={testMCPFunction}
                    className="example-button"
                  >
                    "🧪 Test GitHub MCP Integration"
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