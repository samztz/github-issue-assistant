import { useState, useCallback } from 'react';
import { ChatMessage, ChatState } from '../types';
import { queryLLM } from '../api';

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  });

  const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const addMessage = useCallback((content: string, role: ChatMessage['role'], loading = false): ChatMessage => {
    const message: ChatMessage = {
      id: generateId(),
      content,
      role,
      timestamp: new Date(),
      loading,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));

    return message;
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    }));
  }, []);

  const sendMessage = useCallback(async (userInput: string) => {
    // Add user message
    addMessage(userInput, 'user');

    // Add loading assistant message
    const assistantMessage = addMessage('', 'assistant', true);

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await queryLLM(userInput);
      updateMessage(assistantMessage.id, {
        content: response,
        loading: false,
      });
    } catch (error: any) {
      updateMessage(assistantMessage.id, {
        content: `Error: ${error.message || error}`,
        loading: false,
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [addMessage, updateMessage]);

  const clearChat = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
    });
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    sendMessage,
    clearChat,
  };
}