import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { useChat } from './hooks/useChat';
import { runAgent } from './api';
import './App.css';

export default function App() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // GitHub Agent 状态
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentInput, setAgentInput] = useState("请在 samztz/test-repo 新建一个 issue：标题：登录页面报错，正文：用户点击登录按钮时出现500错误，先做 AI triage");
  const [agentOutput, setAgentOutput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const runGitHubAgent = async () => {
    if (!agentInput.trim()) return;
    
    setAgentLoading(true);
    setAgentOutput("🤖 AI 正在处理您的请求...");
    
    try {
      const result = await runAgent(agentInput.trim());
      setAgentOutput(JSON.stringify(result, null, 2));
    } catch (error: any) {
      setAgentOutput(`❌ 错误: ${error.message || error}`);
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 {isAgentMode ? 'GitHub Agent' : 'AI Assistant'}</h1>
          <p>{isAgentMode ? 'Natural Language GitHub Operations' : 'Powered by Cloudflare Workers + GraphQL + GPT'}</p>
          <div className="header-actions">
            <span className="api-info">
              API: {import.meta.env.VITE_API_BASE || '/graphql (relative)'}
            </span>
            <button 
              onClick={() => setIsAgentMode(!isAgentMode)} 
              className="clear-button" 
              style={{
                marginRight: '10px',
                backgroundColor: isAgentMode ? '#4facfe' : '#28a745',
                color: 'white',
                fontWeight: 'bold'
              }}
            >
              {isAgentMode ? '💬 Chat Mode' : '🐙 GitHub Agent'}
            </button>
            <button onClick={clearChat} className="clear-button">
              🗑️ Clear Chat
            </button>
          </div>
        </div>
      </header>

      <main className="chat-container">
        {isAgentMode ? (
          // GitHub Agent 模式
          <div className="agent-container">
            <div className="agent-input-section">
              <h3>🐙 GitHub 自然语言操作</h3>
              <p>用自然语言描述您想要执行的 GitHub 操作，AI 将自动解析并执行。</p>
              
              <div className="agent-examples">
                <p><strong>示例操作：</strong></p>
                <div className="example-tags">
                  <span 
                    className="example-tag" 
                    onClick={() => setAgentInput("列出 microsoft/vscode 里所有开放的 issues")}
                  >
                    📋 列出 Issues
                  </span>
                  <span 
                    className="example-tag"
                    onClick={() => setAgentInput("在 owner/repo 创建一个关于登录 bug 的 issue，加上 bug 和 urgent 标签")}
                  >
                    ➕ 创建 Issue
                  </span>
                  <span 
                    className="example-tag"
                    onClick={() => setAgentInput("给 owner/repo 的 issue #123 添加 needs-review 标签")}
                  >
                    🏷️ 添加标签
                  </span>
                  <span 
                    className="example-tag"
                    onClick={() => setAgentInput("在 owner/repo 新建 issue：前端崩溃，先用 AI 分析优先级再创建")}
                  >
                    🤖 AI 自动分析
                  </span>
                </div>
              </div>

              <textarea
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                placeholder="描述您想要执行的 GitHub 操作..."
                className="agent-textarea"
                rows={4}
                disabled={agentLoading}
              />
              
              <button
                onClick={runGitHubAgent}
                disabled={agentLoading || !agentInput.trim()}
                className="agent-run-button"
              >
                {agentLoading ? '🤖 AI 处理中...' : '🚀 执行操作'}
              </button>
            </div>

            <div className="agent-output-section">
              <h3>📊 执行结果</h3>
              <pre className="agent-output">
                {agentOutput || '点击"执行操作"查看结果...'}
              </pre>
            </div>
          </div>
        ) : (
          // 原有聊天模式
          <>
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
          </>
        )}
      </main>
    </div>
  );
}