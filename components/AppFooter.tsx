
import React from 'react';

export default function AppFooter({ 
  handleSubmit, 
  inputValue, 
  setInputValue, 
  handleKeyDown, 
  attachedFile, 
  setAttachedFile, 
  uploadMode, 
  toggleUploadMode, 
  fileInputRef, 
  handleFileUpload, 
  isResearchMode, 
  setIsResearchMode, 
  isListening, 
  toggleListening, 
  isLoading, 
  isDark, 
  themeClasses 
}: any) {
  return (
    <div className={`p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t shrink-0 ${isDark ? 'bg-slate-950/90 border-slate-800 backdrop-blur-md' : 'bg-white/90 border-slate-200 backdrop-blur-md'}`}>
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <button type="button" onClick={() => fileInputRef.current.click()} className={`p-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 ${themeClasses.util} transition-all shadow-sm relative`}><i className={`fas ${uploadMode === 'image' ? 'fa-camera' : 'fa-paperclip'} text-sm sm:text-base`}></i><div onClick={toggleUploadMode} className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center text-[8px] transition-all hover:scale-110 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}><i className="fas fa-sync-alt"></i></div></button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept={uploadMode === 'image' ? "image/*" : ".txt,.cfg,.log,.pdf,.ios,.cisco,application/pdf,text/plain"} className="hidden" />
          
          <div className="relative flex-1 group">
            <button type="button" onClick={() => setIsResearchMode(!isResearchMode)} className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isResearchMode ? 'bg-blue-600 text-white' : `${isDark ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-slate-200/50'}`}`}><i className={`fas fa-search ${isResearchMode ? 'animate-pulse' : ''} text-[10px] sm:text-xs`}></i></button>
            
            {attachedFile && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 bg-blue-600/10 border border-blue-500/30 px-1.5 py-1 rounded-lg">
                <div className="w-6 h-6 flex items-center justify-center bg-blue-500/20 rounded border border-blue-500/50"><i className="fas fa-file-alt text-[10px] text-blue-500"></i></div>
                <span className="text-[8px] font-bold truncate text-blue-500 max-w-[60px]">{attachedFile.name}</span>
                <button type="button" onClick={() => setAttachedFile(null)} className="text-rose-500 p-0.5"><i className="fas fa-times text-[9px]"></i></button>
              </div>
            )}
            
            <input 
              type="text" 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder={attachedFile ? `Analysing ${attachedFile.name}...` : "Enter CLI or Q&A..."} 
              className={`w-full py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs sm:text-sm transition-all ${themeClasses.input} ${attachedFile ? 'pl-32 sm:pl-44' : 'pl-12'}`} 
            />
          </div>
          
          <button type="button" onClick={toggleListening} className={`p-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all ${isListening ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : themeClasses.util}`}><i className="fas fa-microphone text-sm sm:text-base"></i></button>
          <button type="submit" disabled={(!inputValue.trim() && !attachedFile) || isLoading} className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 shadow-lg flex items-center justify-center shrink-0 transition-all active:scale-95"><i className="fas fa-arrow-right text-base sm:text-lg"></i></button>
        </form>
      </div>
    </div>
  );
}
