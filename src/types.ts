export interface Provider {
  id: string;
  name: string;
  prefix: string;
}

export interface CustomToken {
  name: string;
  value: string;
}

export interface ModelConfig {
  provider: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  systemPrompt: string;
  defaultPrompt: string;
}

export interface SystemSettings {
  autoSave: boolean;
  theme: 'dark' | 'light';
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: number;
  name: string;
  messages: ChatMessage[];
}

export interface LogEntry {
  time: string;
  message: string;
}

export interface AppState {
  tokens: Record<string, any>;
  config: ModelConfig;
  settings: SystemSettings;
  chat: ChatSession[];
  activeChatId: number | null;
  logs: LogEntry[];
}
