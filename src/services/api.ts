import axios from 'axios';
import type { SourceCitation } from '../types/index.ts';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (memoryToken) {
    config.headers.Authorization = `Bearer ${memoryToken}`;
  }
  return config;
});

export interface StreamChatCallbacks {
  onMeta?: (data: { conversationId: number; userMessageId: number | null; sources: SourceCitation[] }) => void;
  onToken: (token: string) => void;
  onDone: (data: { conversationId: number; assistantMessageId: number; sources: SourceCitation[] }) => void;
  onError: (message: string) => void;
}

export async function streamChatRequest(
  payload: {
    message?: string;
    conversationId?: number | null;
    department?: string;
    regenerate?: boolean;
    mode?: 'all' | 'campus' | 'study' | 'career';
  },
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    callbacks.onError('Network error while connecting to the assistant.');
    return;
  }

  if (!response.ok) {
    let errText = 'Failed to send message.';
    try {
      const json = await response.json();
      if (json?.error) errText = json.error;
    } catch {
      // ignore parse failure
    }
    callbacks.onError(errText);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('Streaming response unavailable in this browser.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const processBlock = (block: string) => {
    const lines = block.split('\n');
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) return;
    const rawData = dataLines.join('\n');

    try {
      const parsed = JSON.parse(rawData);
      if (eventName === 'meta') {
        callbacks.onMeta?.(parsed);
      } else if (eventName === 'token') {
        callbacks.onToken(parsed.token ?? '');
      } else if (eventName === 'done') {
        callbacks.onDone(parsed);
      } else if (eventName === 'error') {
        callbacks.onError(parsed.error ?? 'Unexpected AI response error.');
      }
    } catch {
      // ignore malformed chunk
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        if (block.trim()) {
          processBlock(block);
        }
      }
    }

    if (buffer.trim()) {
      processBlock(buffer);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    callbacks.onError('Stream interrupted. Please try again.');
  }
}
