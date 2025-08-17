export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  loading?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}