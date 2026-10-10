import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  Database,
  ShieldCheck,
  Zap,
  Info,
  User as UserIcon,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { aiApi } from '../services/api';
import { ChatMessage, AIHealthStatus } from '../types';

export const AIAssistantPage: React.FC = () => {
  const { selectedDataset } = useDataset();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [healthStatus, setHealthStatus] = useState<AIHealthStatus | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const promptSuggestions = [
    'Explain my Data Quality score and top health issues.',
    'Summarize key statistical findings from this dataset.',
    'What features show significant correlation, and what does it mean?',
    'What data cleaning operations do you recommend for modeling?',
    'Explain the machine learning results and model trade-offs.',
  ];

  const fetchHealthAndHistory = async () => {
    try {
      const health = await aiApi.getHealth();
      setHealthStatus(health);
    } catch (e) {
      setHealthStatus({
        status: 'error',
        connected: false,
        model: 'gemini-3.5-flash-lite',
        message: 'Could not fetch AI service health status.',
      });
    }

    if (!selectedDataset) return;
    setIsLoadingHistory(true);
    try {
      const hist = await aiApi.getHistory(selectedDataset.id);
      setMessages(hist);
    } catch (e) {
      console.error('Failed to load chat history', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHealthAndHistory();
  }, [selectedDataset?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (text?: string) => {
    const query = (text || inputPrompt).trim();
    if (!query || !selectedDataset || isSending) return;

    setLastError(null);
    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputPrompt('');
    setIsSending(true);

    try {
      const res = await aiApi.chat(selectedDataset.id, query);
      setMessages((prev) => [...prev, res]);
    } catch (err: any) {
      const errorText = err.response?.data?.detail || err.message || 'Failed to generate response.';
      setLastError(errorText);
      const errMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `### DataPilot AI Notice\n\n${errorText}\n\nYou can click **Retry** below or check your network/API key settings.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedDataset) return;
    if (!window.confirm('Clear AI conversation history for this dataset?')) return;
    try {
      await aiApi.clearHistory(selectedDataset.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  if (!selectedDataset) {
    return (
      <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-[70vh] space-y-3">
        <Database className="w-12 h-12 text-slate-600 animate-pulse" />
        <p className="text-sm font-semibold text-slate-300">No Dataset Selected</p>
        <p className="text-xs text-slate-500">Please select or upload a dataset to converse with the AI Co-Pilot.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-5xl mx-auto h-[calc(100vh-5rem)] flex flex-col">
      {/* Header with Health Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 shrink-0">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center space-x-2">
              <Bot className="w-5 h-5 text-teal-400" />
              <span>Google Gemini AI Co-Pilot</span>
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
              {selectedDataset.name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Context-grounded assistant providing statistical reasoning, anomaly alerts, and ML guidance.
          </p>
        </div>

        {/* AI Service Status Pill */}
        <div className="flex items-center space-x-3">
          {healthStatus && (
            <div
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                healthStatus.connected
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : healthStatus.status === 'missing_key'
                  ? 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                  : healthStatus.status === 'invalid_key'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
              }`}
              title={healthStatus.message}
            >
              {healthStatus.connected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Gemini Online ({healthStatus.model})</span>
                </>
              ) : healthStatus.status === 'missing_key' ? (
                <>
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>Offline Statistical Mode</span>
                </>
              ) : healthStatus.status === 'invalid_key' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Invalid API Key</span>
                </>
              ) : healthStatus.status === 'quota_exceeded' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quota Exceeded (Using Offline Mode)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Offline ({healthStatus.status})</span>
                </>
              )}
            </div>
          )}

          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
              title="Clear Chat History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="py-12 text-center max-w-lg mx-auto space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-indigo-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto shadow-lg">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">How can DataPilot AI assist you today?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ask questions regarding your dataset distributions, quality warnings, correlation findings, or machine learning recommendations.
              </p>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-2 text-left">
              {promptSuggestions.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group shadow-sm"
                >
                  <span>{prompt}</span>
                  <Zap className="w-3.5 h-3.5 text-indigo-400 group-hover:text-teal-400 shrink-0 ml-2 transition" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 text-xs ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl p-4 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm shadow-sm'
                }`}
              >
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-start space-x-3 text-xs">
            <div className="w-7 h-7 rounded-lg bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-400 shrink-0 mt-0.5 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-400 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce delay-100"></div>
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce delay-200"></div>
              <span className="text-[11px] ml-1">Grounding response in real computed dataset statistics...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar with Retry */}
      <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="shrink-0 space-y-2">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Ask about ${selectedDataset.name} (e.g. "What data cleaning steps should I apply?")...`}
            className="w-full pl-4 pr-12 py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-lg"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isSending}
            className="absolute right-2.5 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
