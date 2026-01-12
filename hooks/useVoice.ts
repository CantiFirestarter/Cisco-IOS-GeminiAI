
import { useState, useRef } from 'react';

export function useVoice(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) onTranscript(transcript);
      };
      recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setIsListening(false); recognitionRef.current = null; };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  return { isListening, toggleListening };
}
