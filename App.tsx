
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getCiscoCommandInfo, getDynamicSuggestions } from './services/geminiService';
import ResultCard from './components/ResultCard';
// Import ChatMessage to ensure strict typing for state and memo results
import { ChatMessage } from './types';

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Complex Reasoning & Search' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Speed Synthesis' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Ultra-Low Latency' }
];

const STORAGE_KEY = 'cisco_cli_history';
const SUGGESTIONS_KEY = 'cisco_cli_suggestions';
const SYNC_FILE_NAME = 'cisco_expert_sync.json';

const DEFAULT_SUGGESTIONS = [
  'BGP neighbor configuration',
  'OSPF areas on IOS XR',
  'VLAN interface setup',
  'Show spanning-tree details'
];

export default function App() {
  // Explicitly type the messages state to prevent 'unknown' inference from JSON.parse results
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history:", e);
      return [];
    }
  });

  const [view, setView] = useState(() => (messages.length === 0 ? 'home' : 'chat'));
  const [hasApiKey, setHasApiKey] = useState(true); 
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [isAiStudioEnv, setIsAiStudioEnv] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [dynamicSuggestions, setDynamicSuggestions] = useState(() => {
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
  
  const [uploadMode, setUploadMode] = useState<'image' | 'file'>('image');
  const [attachedFile, setAttachedFile] = useState<{ data: string, mimeType: string, name: string } | null>(null);

  const [clearConfirmState, setClearConfirmState] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isResearchMode, setIsResearchMode] = useState(false);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draftValue, setDraftValue] = useState('');

  const clearTimerRef = useRef(null);
  const scrollRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const tokenClientRef = useRef<any>(null);

  // --- Google Drive Sync Logic ---
  useEffect(() => {
    const initGapi = () => {
      const gapi = (window as any).gapi;
      if (!gapi) return;
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
        } catch (e) {
          console.error("GAPI Init Error:", e);
        }
      });
    };

    const initGsi = () => {
      const google = (window as any).google;
      // Client ID is injected from vite.config.ts define block
      const clientId = process.env.GOOGLE_CLIENT_ID || '678219377220-6v70o81vicrobq6scmpnr9p4v3nt9mdl.apps.googleusercontent.com';
      
      if (!google) return;
      try {
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.appdata',
          callback: async (resp: any) => {
            if (resp.error) {
              console.error("GSI Auth Error:", resp.error);
              return;
            }
            if ((window as any).gapi?.client) {
              (window as any).gapi.client.setToken(resp);
            }
            setGoogleUser(resp);
            await loadFromDrive();
          },
        });
      } catch (e) {
        console.error("GSI Init Error:", e);
      }
    };

    const checkScripts = setInterval(() => {
      if ((window as any).gapi && (window as any).google) {
        initGapi();
        initGsi();
        clearInterval(checkScripts);
      }
    }, 1000);
    return () => clearInterval(checkScripts);
  }, []);

  const handleGoogleAuth = () => {
    if (googleUser) {
      setGoogleUser(null);
      if ((window as any).gapi?.client) {
        (window as any).gapi.client.setToken(null);
      }
      return;
    }
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else {
      console.warn("Auth client not ready.");
    }
  };

  const loadFromDrive = async () => {
    setIsSyncing(true);
    try {
      const gapi = (window as any).gapi;
      if (!gapi?.client?.drive) return;

      const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
        q: `name = '${SYNC_FILE_NAME}'`,
      });
      
      const files = response.result.files;
      if (files && files.length > 0) {
        const fileId = files[0].id;
        const res = await gapi.client.drive.files.get({
          fileId: fileId,
          alt: 'media',
        });
        
        const cloudData = typeof res.body === 'string' ? JSON.parse(res.body) : res.result;
        if (cloudData.messages) setMessages(cloudData.messages);
        if (cloudData.suggestions) setDynamicSuggestions(cloudData.suggestions);
      }
    } catch (err) {
      console.error("Drive Load Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveToDrive = async () => {
    if (!googleUser) return;
    setIsSyncing(true);
    try {
      const gapi = (window as any).gapi;
      if (!gapi?.client?.drive) return;

      const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
        q: `name = '${SYNC_FILE_NAME}'`,
      });
      
      const files = response.result.files;
      const content = JSON.stringify({ messages, suggestions: dynamicSuggestions });
      
      if (files && files.length > 0) {
        const fileId = files[0].id;
        await gapi.client.request({
          path: `/upload/drive/v3/files/${fileId}`,
          method: 'PATCH',
          params: { uploadType: 'media' },
          body: content
        });
      } else {
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        const metadata = {
          name: SYNC_FILE_NAME,
          mimeType: 'application/json',
          parents: ['appDataFolder'],
        };

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          content +
          close_delim;

        await gapi.client.request({
          path: '/upload/drive/v3/files',
          method: 'POST',
          params: { uploadType: 'multipart' },
          headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
          body: multipartRequestBody
        });
      }
    } catch (err) {
      console.error("Drive Save Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (googleUser) saveToDrive();
    }, 5000);
    return () => clearTimeout(timer);
  }, [messages, dynamicSuggestions, googleUser]);
  // --- End Google Drive Sync Logic ---

  // Explicitly type the userPromptHistory memo to ensure its elements are recognized as strings, avoiding assignment errors
  const userPromptHistory = useMemo<string[]>(() => {
    const prompts = messages
      .filter(m => m.role === 'user' && !m.content.startsWith('Analyze attached'))
      .map(m => m.content);
    return Array.from(new Set(prompts)).reverse();
  }, [messages]);

  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => setViewportHeight(`${window.visualViewport.height}px`);
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { setIsListening(false); }
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
      };
      recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setIsListening(false); recognitionRef.current = null; };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      const isStudio = !!(window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function');
      setIsAiStudioEnv(isStudio);
      if (isStudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if (isAiStudioEnv) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); 
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    if (view === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, view]);

  const isPredictive = useMemo(() => {
    return JSON.stringify(dynamicSuggestions) !== JSON.stringify(DEFAULT_SUGGESTIONS);
  }, [dynamicSuggestions]);

  useEffect(() => {
    const updateSuggestions = async () => {
      const userQueries = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        const nextMsg = messages[i + 1];
        if (msg.role === 'user' && msg.content !== "Analyze attached resource" && nextMsg?.role === 'assistant' && nextMsg.metadata && !nextMsg.metadata.isOutOfScope) {
          userQueries.push(msg.content);
        }
      }
      const recentQueries = userQueries.slice(-5);
      if (recentQueries.length > 0) {
        const newSuggestions = await getDynamicSuggestions(recentQueries);
        setDynamicSuggestions(newSuggestions);
        localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(newSuggestions));
      } else {
        setDynamicSuggestions(DEFAULT_SUGGESTIONS);
      }
    };
    const timeout = setTimeout(updateSuggestions, 1500);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({ data: reader.result as string, mimeType: file.type || 'application/octet-stream', name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleUploadMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadMode(prev => prev === 'image' ? 'file' : 'image');
    setAttachedFile(null);
  };

  const goHome = () => setView('home');

  const hardReset = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SUGGESTIONS_KEY);
    setDynamicSuggestions(DEFAULT_SUGGESTIONS);
    setClearConfirmState(false);
    setView('home');
    setHistoryIndex(-1);
    setDraftValue('');
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  };

  const handleClearHistory = () => {
    if (!clearConfirmState) {
      setClearConfirmState(true);
      clearTimerRef.current = setTimeout(() => setClearConfirmState(false), 3000);
    } else {
      hardReset();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (userPromptHistory.length === 0) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = historyIndex + 1;
      if (nextIndex < userPromptHistory.length) {
        if (historyIndex === -1) setDraftValue(inputValue);
        setHistoryIndex(nextIndex);
        setInputValue(userPromptHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInputValue(userPromptHistory[nextIndex]);
      } else if (nextIndex === -1) {
        setHistoryIndex(-1);
        setInputValue(draftValue);
      }
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedValue = inputValue.trim();
    if ((!trimmedValue && !attachedFile) || isLoading) return;
    
    // Using any for userMsg to allow dynamic attachment properties not present in the simplified ChatMessage interface
    const userMsg: any = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedValue || `Analyze attached ${uploadMode}`,
      timestamp: Date.now(),
      image: attachedFile?.mimeType.startsWith('image/') ? attachedFile.data : undefined,
      file: !attachedFile?.mimeType.startsWith('image/') ? attachedFile : undefined
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setHistoryIndex(-1);
    setDraftValue('');
    setAttachedFile(null);
    setIsLoading(true);
    setView('chat');
    try {
      const modelToUse = isResearchMode ? 'gemini-3-pro-preview' : selectedModel.id;
      const result = await getCiscoCommandInfo(userMsg.content, userMsg.image ? { data: userMsg.image, mimeType: 'image/jpeg' } : (userMsg.file ? { data: userMsg.file.data, mimeType: userMsg.file.mimeType } : undefined), modelToUse, isResearchMode);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Analysis complete.`, timestamp: Date.now(), metadata: result }]);
    } catch (error) {
      if (error.message?.includes("Requested entity was not found") && isAiStudioEnv) setHasApiKey(false);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "Synthesis failure.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const themeClasses = isDark ? {
    bg: 'bg-slate-950 text-slate-100',
    header: 'bg-slate-950/80 backdrop-blur-lg border-slate-800/60',
    input: 'bg-slate-900 border-slate-800 text-slate-100',
    util: 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800',
    emptyCard: 'bg-slate-900 border-slate-800',
    suggestion: 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800'
  } : {
    bg: 'bg-slate-50 text-slate-900',
    header: 'bg-white/80 backdrop-blur-lg border-slate-200/60',
    input: 'bg-slate-100 border-slate-200 text-slate-900',
    util: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm',
    emptyCard: 'bg-white border-slate-200 shadow-sm',
    suggestion: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
  };

  if (!hasApiKey && !isCheckingKey && isAiStudioEnv) {
    return (
      <div style={{ height: viewportHeight }} className={`flex flex-col items-center justify-center p-6 text-center ${themeClasses.bg}`}>
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl"><i className="fas fa-key text-2xl text-white"></i></div>
        <h2 className="text-2xl font-bold mb-2">Activation Required</h2>
        <button onClick={handleOpenKeySelection} className="py-3 px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg transition-all">Select API Key</button>
      </div>
    );
  }

  return (
    <div style={{ height: viewportHeight }} className={`flex flex-col transition-colors duration-300 overflow-hidden ${themeClasses.bg} ${isDark ? 'dark-mode' : 'light-mode'}`}>
      <header className={`border-b p-3 sm:p-4 pb-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10 shrink-0 ${themeClasses.header}`}>
        <button onClick={goHome} className="flex items-center gap-2 sm:gap-3 group overflow-hidden">
          <div className="bg-blue-600 p-1.5 sm:p-2 rounded-lg shadow-lg group-hover:bg-blue-500 transition-colors shrink-0"><i className="fas fa-network-wired text-base sm:text-xl text-white"></i></div>
          <div className="flex flex-col overflow-hidden">
            <h1 className="font-bold text-sm sm:text-lg leading-tight tracking-tight group-hover:text-blue-500 transition-colors truncate">Cisco CLI Expert</h1>
            <p className={`text-[7px] sm:text-[10px] uppercase tracking-[0.1em] font-bold block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isDark ? 'DARK INTELLIGENCE OPS' : 'ENTERPRISE LIGHT PROTOCOL'}</p>
          </div>
        </button>
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={handleClearHistory} className={`px-2 sm:px-3 h-8 sm:h-10 rounded-xl border transition-all flex items-center gap-2 ${clearConfirmState ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : `${themeClasses.util} hover:text-rose-500`}`}>
            <i className={`fas ${clearConfirmState ? 'fa-exclamation-triangle' : 'fa-trash-alt'} text-xs sm:text-sm`}></i>
          </button>
          
          <button onClick={() => setIsDark(!isDark)} className={`p-1.5 sm:p-2 rounded-xl border w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center ${themeClasses.util}`}><i className={`fas ${isDark ? 'fa-sun text-amber-400' : 'fa-moon'} text-xs sm:text-sm`}></i></button>

          <button onClick={handleGoogleAuth} className={`p-1.5 sm:p-2 rounded-xl border w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center transition-all ${themeClasses.util} ${googleUser ? 'border-emerald-500/50' : ''}`} title={googleUser ? "Syncing with Cloud" : "Sign in to Sync with Google Drive"}>
            <i className={`fab fa-google text-xs sm:text-sm ${googleUser ? 'text-emerald-500' : ''} ${isSyncing ? 'animate-spin' : ''}`}></i>
          </button>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 h-8 sm:h-10 rounded-xl border transition-all ${themeClasses.util}`}>
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isResearchMode ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[10px] sm:text-xs font-bold sm:font-semibold truncate max-w-[50px] sm:max-w-none">{(isResearchMode ? 'Research' : selectedModel.name.split(' ').slice(1).join(' '))}</span>
              <i className="fas fa-chevron-down text-[8px] sm:text-[10px] opacity-40 ml-0.5"></i>
            </button>
            {isMenuOpen && (
              <div className={`absolute right-0 mt-2 w-56 sm:w-64 rounded-xl border shadow-2xl z-50 animate-menuIn ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="p-2 space-y-1">
                  {MODELS.map((m) => (
                    <button key={m.id} onClick={() => { setSelectedModel(m); setIsMenuOpen(false); setIsResearchMode(false); }} className={`w-full text-left p-2.5 sm:p-3 rounded-lg transition-colors ${selectedModel.id === m.id && !isResearchMode ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-opacity-10 hover:bg-slate-500 text-slate-400'}`}>
                      <div className="text-[11px] sm:text-xs font-bold">{m.name}</div>
                      <div className="text-[9px] sm:text-[10px] opacity-60 line-clamp-1">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col max-w-5xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-8">
          {view === 'home' ? (
            <div className="min-h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 animate-fadeIn">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-colors ${themeClasses.emptyCard}`}>
                <i className="fas fa-terminal text-2xl sm:text-3xl text-blue-500"></i>
              </div>
              <h2 className={`text-xl sm:text-2xl font-bold mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Cisco Terminal Intelligence</h2>
              <p className={`max-w-md mx-auto mb-1 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Real-time command synthesis for IOS, IOS XE, and IOS XR environments.
              </p>

              <div className="flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold mt-8 mb-4 transition-all duration-500 text-blue-400">
                {isPredictive && <i className="fas fa-microchip animate-pulse"></i>}
                {isPredictive ? 'Predictive Intelligence Active' : 'Standard Protocols'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-8 mt-4">
                {dynamicSuggestions.map((suggestion, idx) => (
                  <button key={`${suggestion}-${idx}`} onClick={() => handleSuggestionClick(suggestion)} className={`p-3 border rounded-xl text-left text-xs sm:text-sm transition-all flex items-center justify-between group animate-fadeIn ${themeClasses.suggestion}`}><span className="truncate pr-2">{suggestion}</span><i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors text-[10px] shrink-0"></i></button>
                ))}
              </div>

              <div className={`w-full max-w-2xl mb-10 p-4 sm:p-6 rounded-2xl border transition-all ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/50 border-blue-100 shadow-sm'}`}>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
                    <i className="fas fa-search text-white text-xs"></i>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-500">Deep Research Protocol</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                      <i className="fas fa-question-circle text-blue-500/60"></i> Why use it?
                    </div>
                    <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Standard AI knowledge has a "<strong>cutoff</strong>." Deep Research connects Gemini to <strong>live Cisco documentation</strong> via <strong>Google Search</strong>.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                      <i className="fas fa-lightbulb text-blue-500/60"></i> When to use it?
                    </div>
                    <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <strong>Critical</strong> for <strong>niche commands</strong>, <strong>high-stakes changes</strong>, or verifying syntax for the <strong>latest IOS software trains</strong>.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                      <i className="fas fa-check-double text-blue-500/60"></i> How to use it?
                    </div>
                    <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Toggle the <strong>Search Icon</strong> inside the command bar. The interface will <strong>glow blue</strong> when <strong>live verification</strong> is active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn w-full`}>
                  <div className={`${msg.role === 'user' ? 'max-w-[90%] sm:max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-none p-3 sm:p-4 shadow-md' : 'w-full'}`}>
                    {msg.image && <img src={msg.image} className="max-w-full sm:max-w-sm rounded-lg mb-3 border border-white/20 shadow-lg" alt="User upload" />}
                    {msg.role === 'assistant' ? (msg.metadata ? <ResultCard data={msg.metadata} isDark={isDark} /> : <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>{msg.content}</div>) : <p className="text-sm font-medium break-words">{msg.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {isLoading && <div className="flex justify-start animate-pulse p-4 w-full"><div className={`border p-6 rounded-xl shadow-xl w-full flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}><div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.5s]"></div></div><span className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-1">Synthesizing Network Intelligence...</span></div></div>}
        </div>
        <div className={`p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t shrink-0 ${isDark ? 'bg-slate-950/90 border-slate-800 backdrop-blur-md' : 'bg-white/90 border-slate-200 backdrop-blur-md'}`}>
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <button type="button" onClick={() => fileInputRef.current.click()} className={`p-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 ${themeClasses.util} transition-all shadow-sm relative`}><i className={`fas ${uploadMode === 'image' ? 'fa-camera' : 'fa-paperclip'} text-sm sm:text-base`}></i><div onClick={toggleUploadMode} className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center text-[8px] transition-all hover:scale-110 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}><i className="fas fa-sync-alt"></i></div></button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept={uploadMode === 'image' ? "image/*" : ".txt,.cfg,.log,.pdf,.ios,.cisco,application/pdf,text/plain"} className="hidden" />
              <div className="relative flex-1 group">
                <button type="button" onClick={() => setIsResearchMode(!isResearchMode)} className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isResearchMode ? 'bg-blue-600 text-white' : `${isDark ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-slate-200/50'}`}`}><i className={`fas fa-search ${isResearchMode ? 'animate-pulse' : ''} text-[10px] sm:text-xs`}></i></button>
                {attachedFile && <div className="absolute left-12 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 bg-blue-600/10 border border-blue-500/30 px-1.5 py-1 rounded-lg"><div className="w-6 h-6 flex items-center justify-center bg-blue-500/20 rounded border border-blue-500/50"><i className="fas fa-file-alt text-[10px] text-blue-500"></i></div><span className="text-[8px] font-bold truncate text-blue-500 max-w-[60px]">{attachedFile.name}</span><button onClick={() => setAttachedFile(null)} className="text-rose-500 p-0.5"><i className="fas fa-times text-[9px]"></i></button></div>}
                <input type="text" value={inputValue} onChange={(e) => { setInputValue(e.target.value); setHistoryIndex(-1); }} onKeyDown={handleKeyDown} placeholder={attachedFile ? `Analysing ${attachedFile.name}...` : "Enter CLI Command..."} className={`w-full py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs sm:text-sm transition-all ${themeClasses.input} ${attachedFile ? 'pl-32 sm:pl-44' : 'pl-12'}`} />
              </div>
              <button type="button" onClick={toggleListening} className={`p-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all ${isListening ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : themeClasses.util}`}><i className="fas fa-microphone text-sm sm:text-base"></i></button>
              <button type="submit" disabled={(!inputValue.trim() && !attachedFile) || isLoading} className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 shadow-lg flex items-center justify-center shrink-0 transition-all active:scale-95"><i className="fas fa-arrow-right text-base sm:text-lg"></i></button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
