
import React, { useState } from 'react';
import { CiscoQueryResponse } from '../types';

interface ResultCardProps {
  data: CiscoQueryResponse;
}

const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split the text into lines to handle list items properly
  const lines = text.split('\n');

  const renderInline = (input: string) => {
    const parts = input.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-slate-400">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded font-mono text-[0.85em] border border-slate-700">
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
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');

        if (isBullet) {
          return (
            <div key={idx} className="flex gap-3 pl-1">
              <span className="text-blue-500 mt-1.5 text-[8px]">
                <i className="fas fa-circle"></i>
              </span>
              <span className="flex-1 text-slate-300 leading-relaxed">
                {renderInline(trimmed.substring(2))}
              </span>
            </div>
          );
        }

        return line.trim() ? (
          <div key={idx} className="leading-relaxed">{renderInline(line)}</div>
        ) : (
          <div key={idx} className="h-1"></div>
        );
      })}
    </div>
  );
};

const ResultCard: React.FC<ResultCardProps> = ({ data }) => {
  const [showReasoning, setShowReasoning] = useState(false);

  const Section = ({ 
    title, 
    icon, 
    content, 
    color, 
    isCode = false 
  }: { 
    title: string; 
    icon: string; 
    content: string; 
    color: string;
    isCode?: boolean;
  }) => (
    <div className="mb-6 last:mb-0">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <i className={`fas ${icon} text-[10px] opacity-80`}></i>
        <h3 className="font-bold uppercase text-[10px] tracking-widest">{title}</h3>
      </div>
      <div className={`
        p-4 rounded-xl border transition-all duration-300
        ${isCode ? 'bg-black text-emerald-400 font-mono text-sm border-slate-800 shadow-inner' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 shadow-xl'}
      `}>
        {isCode ? (
          <div className="whitespace-pre-wrap leading-relaxed overflow-x-auto">{content}</div>
        ) : (
          <FormattedText text={content} className="text-sm" />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Reasoning Toggle */}
      <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
        <button 
          onClick={() => setShowReasoning(!showReasoning)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-800 transition-colors"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
            <i className="fas fa-brain text-blue-500"></i> AI Logic
          </span>
          <i className={`fas fa-chevron-${showReasoning ? 'up' : 'down'} text-slate-600 text-[10px]`}></i>
        </button>
        {showReasoning && (
          <div className="px-4 py-3 bg-slate-950 border-t border-slate-800">
            <FormattedText text={data.reasoning} className="text-xs text-slate-500 italic" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <div className="col-span-1 md:col-span-2">
          <Section 
            title="Syntax" 
            icon="fa-terminal" 
            content={data.syntax} 
            color="text-blue-400"
            isCode={true}
          />
        </div>
        
        <Section 
          title="Description" 
          icon="fa-info-circle" 
          content={data.description} 
          color="text-indigo-400"
        />
        
        <Section 
          title="Context" 
          icon="fa-layer-group" 
          content={data.usageContext} 
          color="text-teal-400"
        />

        <div className="col-span-1 md:col-span-2">
           <Section 
            title="Options" 
            icon="fa-list-ul" 
            content={data.options} 
            color="text-amber-400"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
           <Section 
            title="Notes" 
            icon="fa-exclamation-triangle" 
            content={data.notes} 
            color="text-rose-400"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
           <Section 
            title="Examples" 
            icon="fa-code" 
            content={data.examples} 
            color="text-emerald-400"
            isCode={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
