import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Mic, Square, Volume2, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// FastAPI Cloud héberge le service canonique texte et voix. La variable permet
// de changer d'environnement sans nouvelle modification du code.
const AI_API_URL = (
  import.meta.env.VITE_AI_API_URL ||
  'https://lotisec-ai.fastapicloud.dev'
).replace(/\/$/, '');

export function Assistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis l\'Assistant IA LOTISEC. Je suis là pour répondre à toutes vos questions sur le code de la route et la sécurité routière au Togo. Comment puis-je vous aider ?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string, autoSpeak = false) => {
    if (!text.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${AI_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LOTISEC-Channel': 'web' },
        body: JSON.stringify({ question: text, history: messages.slice(-5) })
      });
      
      if (!response.ok) throw new Error('Erreur API');
      const data = await response.json();
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.response };
      setMessages([...newMessages, assistantMsg]);
      
      if (autoSpeak) await playTTS(data.response);
      
    } catch (e) {
      toast.error('Erreur lors de la communication avec l\'assistant');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (e) {
      toast.error('Accès au microphone refusé ou non supporté');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleAudioUpload = async (blob: Blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      // On the backend we expect a file that can be converted to .wav.
      // SpeechRecognition handles webm decently via ffmpeg if installed, or we can send as is.
      // It's a best effort for the MVP
      formData.append('file', blob, 'audio.webm');
      
      const response = await fetch(`${AI_API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        headers: { 'X-LOTISEC-Channel': 'web' }
      });
      
      if (!response.ok) throw new Error('Erreur Transcription');
      const data = await response.json();
      
      if (data.text) {
        sendMessage(data.text, true);
      } else {
        toast.error('Aucune parole détectée');
      }
    } catch (e) {
      toast.error('Erreur de reconnaissance vocale');
    } finally {
      setLoading(false);
    }
  };

  const playTTS = async (text: string) => {
    try {
      const response = await fetch(`${AI_API_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LOTISEC-Channel': 'web' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error('TTS Error');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play();
      }
    } catch (e) {
      console.error('Erreur lecture audio', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--color-background)' }}>
      <div className="top-header" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 40, height: 40, backgroundColor: 'white', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20 }}>🤖</span>
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Assistant IA LOTISEC</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>En ligne</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            backgroundColor: msg.role === 'user' ? 'var(--color-primary-light)' : 'var(--color-surface)',
            color: 'var(--color-text)',
            padding: '12px 16px',
            borderRadius: '16px',
            borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
            borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>{msg.content}</div>
            {msg.role === 'assistant' && (
              <button 
                onClick={() => playTTS(msg.content)} 
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', marginTop: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: 0 }}
              >
                <Volume2 size={16} /> Écouter
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', backgroundColor: 'var(--color-surface)', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: 4, boxShadow: 'var(--shadow-sm)' }}>
            <Loader2 size={20} className="animate-spin" color="var(--color-primary)" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px', backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
          placeholder="Tapez votre message..."
          style={{ flex: 1, padding: '12px 20px', borderRadius: '24px', border: 'none', outline: 'none', fontSize: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          disabled={loading || recording}
        />
        
        {input.trim() ? (
          <button 
            onClick={() => sendMessage(input)}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Send size={20} style={{ marginLeft: 2 }} />
          </button>
        ) : (
          <button 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: recording ? 'var(--color-danger)' : 'var(--color-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.2s' }}
          >
            {recording ? <Square size={20} fill="white" /> : <Mic size={20} />}
          </button>
        )}
      </div>

      {/* Hidden audio element for TTS */}
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />
    </div>
  );
}
