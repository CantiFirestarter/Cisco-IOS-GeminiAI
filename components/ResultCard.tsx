
import React, { useState, useRef } from 'react';
import { synthesizeSpeech } from '../services/geminiService';

const FormattedText = ({ text, isDark, className = "" }) => {
  if (!text) return null;
  const lines = text.split('\n');
  const renderInline = (input) => {
    const parts = input.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className={`italic opacity-90 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className={`px-1.5 py-0.5 rounded font-mono text-[0.85em] border transition-colors shadow-sm ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-slate-100 text-blue-600 border-slate-200'}`}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className={`${className} flex flex-col gap-1`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
          const isNumberBullet = /^\d+\.\s/.test(trimmed);
          const bulletContent = isNumberBullet ? trimmed.replace(/^\d+\.\s/, '') : trimmed.substring(2);
          const bulletPrefix = isNumberBullet ? trimmed.match(/^\d+\.\s/)[0] : '';

          return (
            <div key={idx} className="flex gap-2 pl-1 mb-0.5">
              <span className={`text-[10px] mt-1 shrink-0 font-bold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {isNumberBullet ? bulletPrefix : <i className="fas fa-circle text-[6px] text-blue-500/60"></i>}
              </span>
              <span className={`flex-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{renderInline(bulletContent)}</span>
            </div>
          );
        }
        return trimmed ? <div key={idx} className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{renderInline(line)}</div> : <div key={idx} className="h-1"></div>;
      })}
    </div>
  );
};

const Section = ({ title, icon, content, color, isDark, isCode = false }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6 last:mb-0 relative group">
      <div className={`flex items-center justify-between mb-2`}>
        <div className={`flex items-center gap-2 ${color}`}>
          <i className={`fas ${icon} text-[10px] opacity-80`}></i>
          <h3 className="font-bold uppercase text-[10px] tracking-widest">{title}</h3>
        </div>
        {isCode && (
          <button onClick={handleCopy} className={`text-[10px] flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
            <i className={`fas ${copied ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <div className={`p-4 rounded-xl border transition-all duration-300 ${isCode ? 'bg-black text-emerald-400 font-mono text-sm border-slate-800' : `${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} text-slate-300`}`}>
        {isCode ? <div className="whitespace-pre-wrap leading-relaxed overflow-x-auto">{content}</div> : <FormattedText text={content} isDark={isDark} className="text-sm" />}
      </div>
    </div>
  );
};

export default function ResultCard({ data, isDark }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const audioSourceRef = useRef(null);

  const toggleSpeech = async () => {
    if (isSpeaking) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    try {
      setIsSynthesizing(true);
      const textToSpeak = `Cisco command analysis. Command: ${data.syntax}. Category: ${data.deviceCategory}. Mode: ${data.commandMode}. Description: ${data.description.replace(/`/g, '')}`;
      const { audioBuffer, audioCtx } = await synthesizeSpeech(textToSpeak);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setIsSpeaking(false);
        audioSourceRef.current = null;
      };
      
      source.start(0);
      audioSourceRef.current = source;
      setIsSpeaking(true);
    } catch (err) {
      console.error("Speech Synthesis Error:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const getStyle = (type, val) => {
    const isConfig = val?.toLowerCase().includes('config');
    if (type === 'cat') {
      if (val === 'Switch') return { bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-500/20', icon: 'fa-server' };
      if (val === 'Router') return { bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-500/20', icon: 'fa-route' };
      return { bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', text: 'text-emerald-500', border: 'border-emerald-500/20', icon: 'fa-globe' };
    }
    return isConfig 
      ? { bg: isDark ? 'bg-rose-500/10' : 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-500/20', icon: 'fa-wrench' }
      : { bg: isDark ? 'bg-sky-500/10' : 'bg-sky-50', text: 'text-sky-500', border: 'border-sky-500/20', icon: 'fa-terminal' };
  };

  const catS = getStyle('cat', data.deviceCategory);
  const modeS = getStyle('mode', data.commandMode);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {data.correction && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border animate-bounce-subtle ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <i className="fas fa-magic text-xs"></i>
          <div className="text-xs font-semibold"><span className="opacity-70">Correction:</span> {data.correction}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase ${catS.bg} ${catS.text} ${catS.border}`}>
          <i className={`fas ${catS.icon}`}></i>{data.deviceCategory}
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase ${modeS.bg} ${modeS.text} ${modeS.border}`}>
          <i className={`fas ${modeS.icon}`}></i>{data.commandMode}
        </div>
        <div className="flex-1 flex justify-end gap-2">
          <button 
            onClick={toggleSpeech} 
            disabled={isSynthesizing}
            className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${
              isSpeaking ? 'bg-blue-600 border-blue-500 text-white animate-pulse' : 
              isDark ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isSynthesizing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className={`fas ${isSpeaking ? 'fa-stop' : 'fa-volume-up'}`}></i>}
            {isSpeaking ? 'Stop' : 'Listen'}
          </button>
          
          <button onClick={() => setShowReasoning(!showReasoning)} className={`px-4 py-1.5 rounded-xl border text-[10px] font-bold uppercase flex items-center gap-2 transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'}`}>
            <i className="fas fa-brain text-blue-500"></i> Logic {showReasoning ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {showReasoning && (
        <div className={`px-4 py-3 rounded-xl border animate-menuIn ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          <FormattedText text={data.reasoning} isDark={isDark} className="text-xs italic opacity-70" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <div className="col-span-1 md:col-span-2"><Section title="Syntax" icon="fa-terminal" content={data.syntax} color="text-blue-500" isDark={isDark} isCode={true} /></div>
        <Section title="Description" icon="fa-info-circle" content={data.description} color="text-indigo-500" isDark={isDark} />
        <Section title="Context" icon="fa-layer-group" content={data.usageContext} color="text-teal-500" isDark={isDark} />
        <div className="col-span-1 md:col-span-2"><Section title="Configuration Checklist" icon="fa-tasks" content={data.checklist} color="text-cyan-400" isDark={isDark} /></div>
        
        {/* Changed Options to Sky Blue to separate it from Security/Notes */}
        <div className="col-span-1 md:col-span-2"><Section title="Options" icon="fa-list-ul" content={data.options} color="text-sky-400" isDark={isDark} /></div>
        
        <div className="col-span-1 md:col-span-2"><Section title="Troubleshooting & Verification" icon="fa-tools" content={data.troubleshooting} color="text-fuchsia-500" isDark={isDark} /></div>
        
        {/* Security stands out more as the primary 'Orange' section */}
        <div className="col-span-1 md:col-span-2">
            <Section title="Security Considerations" icon="fa-shield-halved" content={data.security} color="text-orange-500" isDark={isDark} />
        </div>
        
        <div className="col-span-1 md:col-span-2"><Section title="Notes" icon="fa-exclamation-triangle" content={data.notes} color="text-rose-500" isDark={isDark} /></div>
        <div className="col-span-1 md:col-span-2"><Section title="Examples" icon="fa-code" content={data.examples} color="text-emerald-500" isDark={isDark} isCode={true} /></div>
      </div>

      {data.sources && data.sources.length > 0 && (
        <div className="mt-2 pt-4 border-t border-slate-800/50">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Live References</div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((s, i) => (
              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-blue-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-blue-600 hover:bg-slate-100'}`}>
                <i className="fas fa-external-link-alt text-[10px]"></i>{s.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
