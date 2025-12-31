import React, { useState, useRef, useEffect } from 'react';
import { getCiscoCommandInfo, getDynamicSuggestions } from './services/geminiService';
import ResultCard from './components/ResultCard';
import { ChatMessage } from './types';

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Complex Reasoning & Search' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Speed Synthesis' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Ultra-Low Latency' }
];

const STORAGE_KEY = 'cisco_cli_history';
const SUGGESTIONS_KEY = 'cisco_cli_suggestions';

const DEFAULT_SUGGESTIONS = [
  'BGP neighbor configuration', 
  'OSPF areas on IOS XR', 
  'VLAN interface setup', 
  'Show spanning-tree details'
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [view, setView] = useState(() => (messages.length === 0 ? 'home' : 'chat'));
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SUGGESTIONS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SUGGESTIONS;
    } catch (e) {
      return DEFAULT_SUGGESTIONS;
    }
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio?.hasSelectedApiKey) {
        try {
          const selected = await aiStudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } catch (e) {
          console.warn("Key selection check unavailable", e);
        }
      } else {
        // Fallback to checking the environment variable shim
        const key = process.env.API_KEY;
        setHasApiKey(!!key && key !== '');
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio?.openSelectKey) {
      await aiStudio.openSelectKey();
      setHasApiKey(true);
    } else {
      alert("API Configuration Needed: Please ensure the API_KEY environment variable is set in your Vercel deployment settings (Settings > Environment Variables) and then re-deploy.");
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    if (view === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, view]);

  useEffect(() => {
    const updateSuggestions = async () => {
      const userQueries = messages
        .filter(m => m.role === 'user' && m.content !== "Image Analysis Request")
        .map(m => m.content)
        .slice(-3);
      
      if (userQueries.length > 0) {
        try {
          const newSuggestions = await getDynamicSuggestions(userQueries);
          if (Array.isArray(newSuggestions)) {
            setDynamicSuggestions(newSuggestions);
            localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(newSuggestions));
          }
        } catch (e) {
          console.error("Failed to update suggestions", e);
        }
      }
    };
    const timeout = setTimeout(updateSuggestions, 3000);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedValue = inputValue.trim();
    if ((!trimmedValue && !attachedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedValue || "Image Analysis Request",
      timestamp: Date.now(),
      image: attachedImage || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedImage(null);
    setIsLoading(true);
    setView('chat');

    try {
      const result = await getCiscoCommandInfo(userMsg.content, userMsg.image, selectedModel.id);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Cisco Intelligence Synthesis`,
        timestamp: Date.now(),
        metadata: result,
      }]);
    } catch (error: any) {
      console.error("API Diagnostic:", error);
      let errorMsg = "System Fault: Unable to reach Cisco CLI Synthesis node. This may be due to a network timeout or an invalid API key.";
      
      const errorMessage = error.message || "";

      if (errorMessage.includes("Requested entity was not found")) {
        errorMsg = "API Configuration Error: The requested model is not available for this project. Try switching to Gemini 3 Flash.";
        setHasApiKey(false);
      } else if (errorMessage.includes("API_KEY") || errorMessage.includes("apiKey") || !process.env.API_KEY) {
        errorMsg = "Security Fault: API Key is missing or invalid. Please check your Vercel Environment Variables.";
        setHasApiKey(false);
      } else if (errorMessage.includes("fetch")) {
        errorMsg = "Connectivity Fault: Network request failed. Check your internet connection and CORS settings.";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const themeClasses = isDark ? { 
    bg: 'bg-slate-950 text-slate-100', 
    header: 'bg-black border-slate-800', 
    input: 'bg-slate-900 border-slate-800 text-slate-100', 
    util: 'bg-slate-900 border-slate-800 text-slate-400',
    emptyCard: 'bg-slate-900 border-slate-800',
    suggestion: 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800'
  } : { 
    bg: 'bg-slate-50 text-slate-900', 
    header: 'bg-white border-slate-200', 
    input: 'bg-slate-100 border-slate-200 text-slate-900', 
    util: 'bg-slate-100 border-slate-200 text-slate-600',
    emptyCard: 'bg-white border-slate-200 shadow-sm',
    suggestion: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
  };

  if (!hasApiKey && !isCheckingKey) {
    return (
      <div className={`flex flex-col h-screen items-center justify-center p-6 text-center ${themeClasses.bg}`}>
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl animate-pulse">
          <i className="fas fa-shield-alt text-2xl text-white"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2">Service Initialization Required</h2>
        <p className={`max-w-md mb-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          The Cisco Intelligence Node (cisco.ios.ai) requires an active Gemini API key to process CLI queries.
        </p>
        <button onClick={handleOpenKeySelection} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-xl transition-all active:scale-95 mb-4">
          Configure Access
        </button>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener" className="text-xs text-blue-500 hover:underline">Documentation & Quota Policy</a>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${themeClasses.bg}`}>
      <header className={`border-b p-4 flex items-center justify-between z-10 ${themeClasses.header}`}>
        <button onClick={() => setView('home')} className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg"><i className="fas fa-network-wired text-white"></i></div>
          <div className="hidden xs:block text-left">
            <h1 className="font-bold text-sm leading-tight">Cisco Expert</h1>
            <p className="text-[9px] opacity-40 font-mono tracking-tighter uppercase">cisco.ios.ai</p>
          </div>
        </button>
        
        <div className="flex items-center gap-2">
          {deferredPrompt && (
            <button onClick={handleInstallClick} className="hidden md:flex items-center gap-2 px-3 h-10 rounded-xl bg-blue-600 text-white text-xs font-bold animate-bounce-subtle">
              <i className="fas fa-download"></i> Install
            </button>
          )}
          <button onClick={() => setIsDark(!isDark)} className={`w-10 h-10 rounded-xl border flex items-center justify-center ${themeClasses.util}`}>
            <i className={`fas ${isDark ? 'fa-sun text-amber-400' : 'fa-moon'}`}></i>
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`hidden sm:flex items-center gap-3 px-4 h-10 rounded-xl border ${themeClasses.util}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold">{selectedModel.name}</span>
            </button>
            {isMenuOpen && (
              <div className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl z-50 p-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => { setSelectedModel(m); setIsMenuOpen(false); }} className={`w-full text-left p-3 rounded-lg text-xs font-bold ${selectedModel.id === m.id ? 'bg-blue-600 text-white' : 'hover:bg-blue-500/10'}`}>{m.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col max-w-5xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {view === 'home' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl ${themeClasses.emptyCard}`}>
                <i className="fas fa-terminal text-3xl text-blue-500"></i>
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tight">Cisco Intelligence Node</h2>
              <p className="text-xs opacity-50 mb-10 max-w-xs leading-relaxed">
                Expert knowledge for IOS, IOS XE, and IOS XR. <br/>Deployed at <span className="font-mono text-blue-500">cisco.ios.ai</span>
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-12">
                {dynamicSuggestions.map((s, i) => (
                  <button key={i} onClick={() => { setInputValue(s); }} className={`p-4 rounded-2xl border text-left text-xs font-bold transition-all transform hover:scale-[1.02] active:scale-95 ${themeClasses.suggestion}`}>
                    <i className="fas fa-chevron-right mr-2 opacity-30"></i>{s}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center gap-4">
                <button onClick={() => setShowPrivacy(true)} className="text-[10px] uppercase font-bold tracking-widest opacity-30 hover:opacity-100 transition-opacity">
                  Legal & Privacy Information
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-20">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                  <div className={`${msg.role === 'user' ? 'max-w-[85%] bg-blue-600 text-white rounded-3xl p-5 shadow-xl' : 'w-full'}`}>
                    {msg.image && <img src={msg.image} className="max-w-xs rounded-2xl mb-4 border border-white/20 shadow-2xl" alt="Upload Preview" />}
                    {msg.metadata ? (
                      <>
                        {msg.metadata.sources && msg.metadata.sources.length > 0 && <div className="text-[10px] uppercase tracking-widest font-black text-blue-400 mb-3 flex items-center gap-2"><i className="fas fa-globe"></i> Grounding Verification Active</div>}
                        <ResultCard data={msg.metadata} isDark={isDark} />
                      </>
                    ) : <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                    <div className={`text-[9px] mt-2 opacity-30 font-mono ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isLoading && (
            <div className="flex flex-col gap-3 items-start p-6 animate-pulse">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">Analyzing Topology...</span>
            </div>
          )}
        </div>

        <div className={`p-4 border-t sticky bottom-0 z-20 ${isDark ? 'bg-slate-950/80 backdrop-blur-xl border-slate-800' : 'bg-white/80 backdrop-blur-xl border-slate-200'}`}>
          <form onSubmit={(e) => handleSubmit(e)} className="flex gap-3 max-w-4xl mx-auto items-center">
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-4 rounded-2xl border transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 ${themeClasses.util}`}>
              <i className="fas fa-camera"></i>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Query CLI, verify syntax, or describe goal..."
                className={`w-full px-6 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm shadow-inner transition-all ${themeClasses.input}`}
              />
            </div>
            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-7 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-500 hover:shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-95">
              {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Execute'}
            </button>
          </form>
          {attachedImage && (
            <div className="mt-3 flex items-center gap-3 px-2">
              <div className="relative group">
                <img src={attachedImage} className="w-12 h-12 rounded-xl border-2 border-blue-500 object-cover shadow-lg" alt="Selected" />
                <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">×</button>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Image Loaded</span>
                <span className="text-[8px] opacity-40 uppercase">Ready for visual analysis</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className={`max-w-xl w-full max-h-[80vh] overflow-y-auto rounded-3xl p-8 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black tracking-tight">Privacy & Terms</h2>
              <button onClick={() => setShowPrivacy(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <div className="prose prose-invert text-xs space-y-4 opacity-80 leading-relaxed">
              <p><strong>Deployment:</strong> cisco.ios.ai is a specialized AI interface for network engineering.</p>
              <p><strong>Data Usage:</strong> This application processes your queries using Google Gemini Models. Camera data is used exclusively for OCR and visual CLI analysis and is not stored permanently on any server by this interface.</p>
              <p><strong>Compliance:</strong> For Play Store requirements, users are advised that network topology photos may contain sensitive local IP information. Handle with appropriate professional discretion.</p>
              <p><strong>Affiliation:</strong> This is an independent tool and is not officially affiliated with Cisco Systems, Inc. All trademarks are the property of their respective owners.</p>
            </div>
            <button onClick={() => setShowPrivacy(false)} className="w-full mt-8 bg-blue-600 py-4 rounded-2xl font-bold text-white shadow-xl">Understood</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .animate-bounce-subtle { animation: bounce-subtle 2s infinite; }
      `}</style>
    </div>
  );
}