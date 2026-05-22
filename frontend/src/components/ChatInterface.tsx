import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface Citation {
  fileName: string;
  pageNumber: number;
  chunkIndex: number;
  preview: string;
  distance: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatInterfaceProps {
  activeDocumentId: string | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ activeDocumentId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('/api/v1/documents/query', {
        query: input,
        documentIds: activeDocumentId ? [activeDocumentId] : [],
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.answer,
        citations: response.data.citations,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error while trying to connect to the vector store database. Please check your service connections.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel chat-container mt-8">
      <h3 className="panel-title">
        <MessageSquare size={18} /> Conversational RAG Engine 
        {activeDocumentId && <span className="text-xs font-normal text-slate-400 ml-2">(Scoped to active document)</span>}
      </h3>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2">
            <MessageSquare size={36} className="text-slate-700" />
            <p>Ask a question about your uploaded documents.</p>
            <p className="text-xs text-slate-600">Context is automatically retrieved from ChromaDB.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              
              {msg.citations && msg.citations.length > 0 && (
                <div className="citations-list">
                  <p className="text-xs text-slate-400 font-semibold mb-1">Sources Citations:</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.map((citation, cIdx) => (
                      <div 
                        key={cIdx} 
                        className="citation-item group relative"
                        title={citation.preview}
                      >
                        <CheckCircle2 size={12} className="text-blue-400 shrink-0" />
                        <span>
                          {citation.fileName} {citation.pageNumber ? `(Page ${citation.pageNumber})` : ''}
                        </span>
                        
                        {/* Hover Preview Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-950 border border-slate-800 text-slate-300 text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <p className="font-bold mb-1 text-slate-100">{citation.fileName}</p>
                          <p className="line-clamp-4">{citation.preview}</p>
                          <p className="mt-2 text-[10px] text-slate-500">Distance Match: {citation.distance.toFixed(4)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div className="message message-assistant flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeDocumentId ? "Ask a question about this document..." : "Ask a question across all documents..."}
          className="chat-input"
          disabled={loading}
        />
        <button type="submit" className="btn-premium" disabled={loading || !input.trim()}>
          <Send size={16} /> Send
        </button>
      </form>
    </div>
  );
};
