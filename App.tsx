
import React, { useState, useRef, useEffect } from 'react';
import { getCiscoCommandInfo } from './services/geminiService';
import { ChatMessage, CiscoQueryResponse } from './types';
import ResultCard from './components/ResultCard';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userQuery = inputValue;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuery,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await getCiscoCommandInfo(userQuery);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Details for: ${userQuery}`,
        timestamp: Date.now(),
        metadata: result
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-black border-b border-slate-800 text-white p-4 shadow-xl flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
            <i className="fas fa-network-wired text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Cisco CLI Expert</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Dark Intelligence Ops</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Gemini 3 Pro
          </span>
          <span className="text-slate-700">|</span>
          <span>v2.0.0</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col max-w-5xl mx-auto w-full">
        
        {/* Messages List */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
                <i className="fas fa-terminal text-3xl text-blue-500"></i>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Cisco Terminal Intelligence</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm">
                Real-time command synthesis for IOS, IOS XE, and IOS XR platforms.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                {[
                  'BGP neighbor configuration', 
                  'OSPF areas on IOS XR', 
                  'VLAN interface setup', 
                  'Show spanning-tree details'
                ].map(suggestion => (
                  <button 
                    key={suggestion}
                    onClick={() => setInputValue(suggestion)}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left text-sm hover:border-blue-500 hover:bg-slate-800 transition-all text-slate-400 flex items-center justify-between group"
                  >
                    {suggestion}
                    <i className="fas fa-chevron-right text-slate-700 group-hover:text-blue-500 transition-colors text-[10px]"></i>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div className={`max-w-[95%] sm:max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none shadow-lg shadow-blue-900/20' : 'w-full'} p-4`}>
                {msg.role === 'assistant' ? (
                   <div className="space-y-4">
                      {msg.metadata ? (
                        <ResultCard data={msg.metadata} />
                      ) : (
                        <p className="text-slate-300 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl">{msg.content}</p>
                      )}
                   </div>
                ) : (
                  <p className="text-sm font-medium">{msg.content}</p>
                )}
                <div className={`mt-2 text-[10px] ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-600'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl w-full h-40 flex flex-col items-center justify-center gap-4">
                <i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Synthesizing CLI Output...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/50">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Query command or task..."
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm text-slate-100 placeholder-slate-600"
              />
              <i className="fas fa-terminal absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs"></i>
            </div>
            <button 
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 border border-blue-500/50"
            >
              <i className="fas fa-bolt"></i>
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;
