
import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  LayoutDashboard,
  History,
  StickyNote,
  Music,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ExternalLink,
  X,
  Globe,
  PlayCircle
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { analyzeAudioContent, chatWithAssistant } from './services/geminiService';
import { Visualizer } from './components/Visualizer';
import { AppView, AudioAnalysis, Note, Language } from './types';

// --- Translations ---
const TRANSLATIONS = {
  en: {
    nav_listen: "Listen",
    nav_stats: "Vibe Stats",
    nav_history: "History",
    nav_notes: "Notes",
    ai_assistant: "AI Assistant",
    title_analyzer: "Sonic Analyzer",
    title_dashboard: "Vibe Intelligence",
    title_history: "Sonic Archives",
    title_notes: "Session Notes",
    desc_analyzer: "Capture audio to decompose rhythm, flow, and context.",
    desc_dashboard: "Visualizing your musical journey and patterns.",
    desc_history: "All your previous analyses in one place.",
    desc_notes: "Your thoughts on tracks, production, and vibes.",
    system_ok: "System Operational",
    input_source: "Input Source",
    status_recording: "RECORDING LIVE",
    status_ready: "READY",
    btn_analyze: "Analyzing Vibe...",
    btn_start: "Start Listening",
    btn_stop: "Stop & Analyze",
    label_bpm: "BPM Est.",
    label_fingerprint: "Sonic Fingerprint",
    label_vibe_analysis: "Vibe Analysis",
    label_matches: "Vibe Matches",
    empty_analysis: "Record audio to generate deep-learning vibe recommendations.",
    match_score: "Match",
    btn_add_note: "Add Note",
    btn_listen_yt: "Listen on YouTube",
    no_data: "No data collected yet.",
    no_data_sub: "Start analyzing music to build your dashboard.",
    top_genres: "Top Detected Genres",
    mood_spectrum: "Mood Spectrum",
    stat_scans: "Total Scans",
    stat_latest: "Latest Vibe",
    stat_freq_mood: "Top Mood",
    no_history: "No history found.",
    note_new: "New Note",
    note_placeholder: "Write your thoughts about a vibe, style, or track...",
    note_save: "Save Note",
    note_empty: "No notes yet. Capture your ideas!",
    chat_placeholder: "Ask about genres, tempo...",
    chat_intro: "Hey! I'm VibeBot. Record some music and I'll help you find similar tracks!",
    chat_error: "Sorry, I spaced out. Try again?",
    chat_title: "Vibe Assistant"
  },
  es: {
    nav_listen: "Escuchar",
    nav_stats: "Estadísticas",
    nav_history: "Historial",
    nav_notes: "Notas",
    ai_assistant: "Asistente IA",
    title_analyzer: "Analizador Sónico",
    title_dashboard: "Inteligencia Vibe",
    title_history: "Archivos Sónicos",
    title_notes: "Notas de Sesión",
    desc_analyzer: "Captura audio para descomponer ritmo, flow y contexto.",
    desc_dashboard: "Visualizando tu viaje musical y patrones.",
    desc_history: "Todos tus análisis anteriores en un solo lugar.",
    desc_notes: "Tus pensamientos sobre pistas, producción y vibras.",
    system_ok: "Sistema Operativo",
    input_source: "Fuente de Audio",
    status_recording: "GRABANDO EN VIVO",
    status_ready: "LISTO",
    btn_analyze: "Analizando Vibe...",
    btn_start: "Escuchar Ahora",
    btn_stop: "Parar y Analizar",
    label_bpm: "BPM Est.",
    label_fingerprint: "Huella Sonora",
    label_vibe_analysis: "Análisis de Vibe",
    label_matches: "Coincidencias",
    empty_analysis: "Graba audio para generar recomendaciones profundas.",
    match_score: "Coincidencia",
    btn_add_note: "Añadir Nota",
    btn_listen_yt: "Escuchar en YouTube",
    no_data: "Sin datos recolectados.",
    no_data_sub: "Empieza a analizar música para construir tu tablero.",
    top_genres: "Géneros Detectados Top",
    mood_spectrum: "Espectro Emocional",
    stat_scans: "Escaneos Totales",
    stat_latest: "Último Vibe",
    stat_freq_mood: "Mood Top",
    no_history: "No se encontró historial.",
    note_new: "Nueva Nota",
    note_placeholder: "Escribe tus ideas sobre un estilo, vibra o pista...",
    note_save: "Guardar Nota",
    note_empty: "Sin notas aún. ¡Captura tus ideas!",
    chat_placeholder: "Pregunta sobre géneros, tempo...",
    chat_intro: "¡Hola! Soy VibeBot. Graba música y te ayudaré a encontrar pistas similares.",
    chat_error: "¿Perdón? Me distraje. ¿Intentamos de nuevo?",
    chat_title: "Asistente Vibe"
  }
};

// --- Utility Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const getYoutubeLink = (artist: string, title: string) => {
  const query = encodeURIComponent(`${artist} ${title} official audio`);
  return `https://www.youtube.com/results?search_query=${query}`;
};

export default function App() {
  // --- State ---
  const [language, setLanguage] = useState<Language>('es'); // Default to Spanish per request
  const [activeView, setActiveView] = useState<AppView>(AppView.ANALYZER);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AudioAnalysis[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<AudioAnalysis | null>(null);

  // Assistant State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Translation Helper
  const t = TRANSLATIONS[language];

  // Recorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- Lifecycle & Persistence ---
  // --- Lifecycle & Persistence ---
  useEffect(() => {
    // Load data from API
    fetch('http://localhost:3005/api/history')
      .then(res => res.json())
      .then(data => setHistory(data))
      .catch(err => console.error("Failed to load history", err));

    fetch('http://localhost:3005/api/notes')
      .then(res => res.json())
      .then(data => setNotes(data))
      .catch(err => console.error("Failed to load notes", err));

    // Set initial chat message based on language
    setChatMessages([{ role: 'model', content: TRANSLATIONS[language].chat_intro }]);
  }, []);

  // Update chat intro when language changes if chat is empty or only has intro
  useEffect(() => {
    if (chatMessages.length <= 1) {
      setChatMessages([{ role: 'model', content: t.chat_intro }]);
    }
  }, [language]);

  const saveAnalysis = async (analysis: AudioAnalysis) => {
    try {
      await fetch('http://localhost:3005/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysis)
      });
      setHistory(prev => [analysis, ...prev]);
    } catch (err) {
      console.error("Failed to save analysis", err);
    }
  };

  const saveNote = async (note: Note) => {
    try {
      await fetch('http://localhost:3005/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
      });
      setNotes(prev => [note, ...prev]);
    } catch (err) {
      console.error("Failed to save note", err);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await fetch(`http://localhost:3005/api/notes/${id}`, {
        method: 'DELETE'
      });
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  // --- Audio Handling ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        await handleAnalysis(audioBlob);

        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Please allow microphone access to use VibeSync.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalysis = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      // Pass language to analysis service
      const result = await analyzeAudioContent(base64Audio, language);

      const newAnalysis: AudioAnalysis = {
        ...result,
        id: Date.now().toString(),
        timestamp: Date.now()
      };

      setCurrentAnalysis(newAnalysis);
      saveAnalysis(newAnalysis);
      setActiveView(AppView.ANALYZER);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Could not analyze audio. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Assistant Logic ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const newMsg = { role: 'user', content: chatInput };
    const updatedHistory = [...chatMessages, newMsg];
    setChatMessages(updatedHistory);
    setChatInput("");

    try {
      // Pass language to chat service
      const reply = await chatWithAssistant(updatedHistory, chatInput, language);
      if (reply) {
        setChatMessages(prev => [...prev, { role: 'model', content: reply }]);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'model', content: t.chat_error }]);
    }
  };

  // --- Notes Logic ---
  const addNote = (content: string, analysisId?: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      content,
      relatedAnalysisId: analysisId
    };
    saveNote(newNote);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'es' ? 'en' : 'es');
  };

  // --- Navigation Items ---
  const navItems = [
    { id: AppView.ANALYZER, icon: Mic, label: t.nav_listen },
    { id: AppView.DASHBOARD, icon: LayoutDashboard, label: t.nav_stats },
    { id: AppView.HISTORY, icon: History, label: t.nav_history },
    { id: AppView.NOTES, icon: StickyNote, label: t.nav_notes },
  ];

  return (
    <div className="flex min-h-screen font-sans text-white bg-deep-bg selection:bg-neon-purple selection:text-white">

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-[#0f0f1a] border-r border-white/5 flex flex-col items-center lg:items-start py-8 z-50 transition-all">
        <div className="px-6 mb-12 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-neon-purple to-neon-blue flex items-center justify-center shadow-[0_0_20px_rgba(176,38,255,0.5)]">
            <Music size={20} className="text-white" />
          </div>
          <span className="hidden lg:block text-2xl font-bold tracking-tight">VibeSync</span>
        </div>

        <nav className="w-full flex flex-col gap-2 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group ${activeView === item.id
                ? 'bg-white/10 text-neon-blue shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <item.icon size={24} className={activeView === item.id ? 'animate-pulse' : ''} />
              <span className="hidden lg:block font-medium">{item.label}</span>
              {activeView === item.id && (
                <div className="ml-auto hidden lg:block w-1.5 h-1.5 rounded-full bg-neon-blue shadow-[0_0_10px_#00f0ff]" />
              )}
            </button>
          ))}
        </nav>

        {/* Language Toggle */}
        <div className="w-full px-3 mt-4">
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-300 group border border-white/5 hover:border-white/20"
          >
            <Globe size={24} className="text-neon-green group-hover:rotate-180 transition-transform duration-500" />
            <span className="hidden lg:block font-medium">
              {language === 'es' ? 'Español' : 'English'}
            </span>
            <span className="ml-auto hidden lg:block text-xs font-mono bg-white/10 px-2 py-0.5 rounded">
              {language.toUpperCase()}
            </span>
          </button>
        </div>

        <div className="mt-auto w-full px-3">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-full flex items-center justify-center lg:justify-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-neon-purple/20 to-neon-blue/20 border border-white/10 hover:border-white/30 transition-all group"
          >
            <Sparkles size={24} className="text-neon-purple group-hover:rotate-12 transition-transform" />
            <span className="hidden lg:block font-medium bg-gradient-to-r from-neon-purple to-neon-blue bg-clip-text text-transparent">
              {t.ai_assistant}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-20 lg:ml-64 p-6 lg:p-10 relative max-w-7xl mx-auto">

        {/* Dynamic Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {activeView === AppView.ANALYZER && t.title_analyzer}
              {activeView === AppView.DASHBOARD && t.title_dashboard}
              {activeView === AppView.HISTORY && t.title_history}
              {activeView === AppView.NOTES && t.title_notes}
            </h1>
            <p className="text-gray-400">
              {activeView === AppView.ANALYZER && t.desc_analyzer}
              {activeView === AppView.DASHBOARD && t.desc_dashboard}
              {activeView === AppView.HISTORY && t.desc_history}
              {activeView === AppView.NOTES && t.desc_notes}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-white/5 px-4 py-2 rounded-full border border-white/5">
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></div>
            {t.system_ok}
          </div>
        </header>

        {/* Views */}
        <div className="w-full animate-fade-in">

          {/* --- ANALYZER VIEW --- */}
          {activeView === AppView.ANALYZER && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

              {/* Left Column: Recorder & Current Analysis */}
              <div className="xl:col-span-2 space-y-6">

                {/* Recording Card */}
                <div className="glass-card rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-neon-purple/30 transition-all duration-1000"></div>

                  <div className="relative z-10 flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Mic className="text-neon-purple" />
                        {t.input_source}
                      </h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-mono border ${isRecording ? 'border-red-500 text-red-500' : 'border-gray-600 text-gray-400'}`}>
                        {isRecording ? t.status_recording : t.status_ready}
                      </span>
                    </div>

                    <Visualizer stream={audioStream} isRecording={isRecording} />

                    <div className="flex gap-4">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          disabled={isAnalyzing}
                          className="flex-1 bg-white text-black hover:bg-neon-green hover:scale-[1.02] transition-all font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        >
                          {isAnalyzing ? (
                            <>
                              <Sparkles className="animate-spin" /> {t.btn_analyze}
                            </>
                          ) : (
                            <>
                              <div className="w-4 h-4 rounded-full bg-red-500"></div> {t.btn_start}
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg animate-pulse"
                        >
                          <div className="w-4 h-4 bg-white rounded-sm"></div> {t.btn_stop}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Analysis Results */}
                {currentAnalysis && (
                  <div className="glass-card rounded-[2rem] p-8 animate-float border-l-4 border-neon-blue">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-3xl font-bold text-white mb-1">{currentAnalysis.mood}</h3>
                        <p className="text-neon-blue font-mono text-lg">{currentAnalysis.detectedGenre}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-gray-200 font-mono">{currentAnalysis.tempo}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest">{t.label_bpm}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-black/20 rounded-2xl p-5">
                        <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">{t.label_fingerprint}</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentAnalysis.keyElements.map((el, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm hover:border-neon-purple/50 transition-colors cursor-default">
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-black/20 rounded-2xl p-5">
                        <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">{t.label_vibe_analysis}</h4>
                        <p className="text-gray-300 leading-relaxed">
                          {currentAnalysis.vibeDescription}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: Recommendations */}
              <div className="xl:col-span-1 flex flex-col gap-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="text-neon-green" />
                  {t.label_matches}
                </h2>

                {!currentAnalysis ? (
                  <div className="flex-1 glass-card rounded-3xl p-8 flex flex-col items-center justify-center text-center text-gray-500 border-dashed border-2 border-white/10">
                    <Music size={48} className="mb-4 opacity-20" />
                    <p>{t.empty_analysis}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {currentAnalysis.recommendations.map((track, idx) => (
                      <div key={idx} className="glass-card p-5 rounded-2xl relative overflow-hidden group hover:bg-white/10 transition-all hover:-translate-y-1">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-neon-blue to-neon-purple opacity-0 group-hover:opacity-100 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-lg text-white group-hover:text-neon-blue transition-colors">{track.title}</h4>
                            <p className="text-sm text-gray-400">{track.artist}</p>
                          </div>
                          <div className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-neon-green">
                            {track.similarityScore}% {t.match_score}
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-2 mb-4 line-clamp-2 group-hover:text-gray-300 transition-colors">
                          {track.reason}
                        </p>

                        <div className="flex items-center justify-between border-t border-white/5 pt-3">
                          <button
                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-neon-purple transition-colors"
                            onClick={() => addNote(`Must check out ${track.title} by ${track.artist}. Vibe: ${track.reason}`, currentAnalysis.id)}
                          >
                            <StickyNote size={14} /> {t.btn_add_note}
                          </button>

                          <a
                            href={getYoutubeLink(track.artist, track.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold transition-all border border-red-500/20 hover:border-red-500/50"
                          >
                            <PlayCircle size={14} fill="currentColor" className="opacity-50" /> {t.btn_listen_yt}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- DASHBOARD VIEW --- */}
          {activeView === AppView.DASHBOARD && (
            <DashboardView history={history} t={t} />
          )}

          {/* --- HISTORY VIEW --- */}
          {activeView === AppView.HISTORY && (
            <HistoryView
              history={history}
              t={t}
              onSelect={(analysis) => {
                setCurrentAnalysis(analysis);
                setActiveView(AppView.ANALYZER);
              }}
            />
          )}

          {/* --- NOTES VIEW --- */}
          {activeView === AppView.NOTES && (
            <NotesView
              notes={notes}
              history={history}
              t={t}
              onAddNote={addNote}
              onDeleteNote={deleteNote}
            />
          )}

        </div>
      </main>

      {/* Floating Chat Assistant */}
      <div className={`fixed right-6 bottom-6 w-96 transition-all duration-500 transform z-50 ${isChatOpen ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[500px] overflow-hidden">
          <div className="bg-gradient-to-r from-neon-purple to-neon-blue p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="text-white" size={18} />
              <h3 className="font-bold text-white">{t.chat_title}</h3>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a12]">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user'
                  ? 'bg-white/10 text-white rounded-br-none'
                  : 'bg-gradient-to-br from-neon-purple/20 to-blue-500/20 border border-white/5 text-gray-200 rounded-bl-none'
                  }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-[#1a1a24] border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={t.chat_placeholder}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-blue"
              />
              <button onClick={handleSendMessage} className="bg-white/10 hover:bg-neon-blue hover:text-black p-2 rounded-lg transition-colors">
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// --- Sub-Components ---

const DashboardView = ({ history, t }: { history: AudioAnalysis[], t: any }) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <Radar size={64} className="mb-4 opacity-20" />
        <p className="text-xl">{t.no_data}</p>
        <p className="text-sm">{t.no_data_sub}</p>
      </div>
    )
  }

  const genreCounts = history.reduce((acc, curr) => {
    acc[curr.detectedGenre] = (acc[curr.detectedGenre] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const genreData = Object.keys(genreCounts).map(key => ({
    name: key,
    value: genreCounts[key]
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  const moodCounts = history.reduce((acc, curr) => {
    acc[curr.mood] = (acc[curr.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const moodData = Object.keys(moodCounts).map(key => ({
    subject: key,
    A: moodCounts[key],
    fullMark: Math.max(...Object.values(moodCounts)) + 2
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Top Genres Bar Chart */}
      <div className="glass-card p-8 rounded-3xl">
        <h3 className="text-xl font-bold mb-6 text-neon-blue">{t.top_genres}</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={genreData}>
              <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #333', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {genreData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#b026ff', '#00ff9d', '#00f0ff', '#ff0055', '#fff'][index % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mood Radar */}
      <div className="glass-card p-8 rounded-3xl">
        <h3 className="text-xl font-bold mb-6 text-neon-green">{t.mood_spectrum}</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={moodData}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
              <Radar name="Mood" dataKey="A" stroke="#00ff9d" fill="#00ff9d" fillOpacity={0.3} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #333' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 rounded-2xl border-l-4 border-neon-purple">
          <p className="text-gray-400 text-sm">{t.stat_scans}</p>
          <p className="text-4xl font-bold mt-1">{history.length}</p>
        </div>
        <div className="glass-card p-6 rounded-2xl border-l-4 border-neon-blue">
          <p className="text-gray-400 text-sm">{t.stat_latest}</p>
          <p className="text-xl font-bold mt-1 truncate">{history[0]?.detectedGenre || "N/A"}</p>
        </div>
        <div className="glass-card p-6 rounded-2xl border-l-4 border-neon-green">
          <p className="text-gray-400 text-sm">{t.stat_freq_mood}</p>
          <p className="text-xl font-bold mt-1 truncate">
            {moodData.sort((a, b) => b.A - a.A)[0]?.subject || "N/A"}
          </p>
        </div>
      </div>
    </div>
  )
};

const HistoryView = ({ history, t, onSelect }: { history: AudioAnalysis[], t: any, onSelect: (a: AudioAnalysis) => void }) => {
  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div
          key={item.id}
          onClick={() => onSelect(item)}
          className="glass-card p-6 rounded-xl flex items-center justify-between hover:bg-white/5 cursor-pointer group transition-all"
        >
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neon-purple group-hover:scale-110 transition-transform">
              <Music size={20} />
            </div>
            <div>
              <h4 className="font-bold text-lg">{item.detectedGenre}</h4>
              <p className="text-sm text-gray-400">{new Date(item.timestamp).toLocaleString()} • {item.mood}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right mr-4">
              <p className="text-xs text-gray-500">BPM</p>
              <p className="font-mono">{item.tempo}</p>
            </div>
            <ArrowRight className="text-gray-600 group-hover:text-white transition-colors" />
          </div>
        </div>
      ))}
      {history.length === 0 && (
        <div className="text-center text-gray-500 py-20">{t.no_history}</div>
      )}
    </div>
  );
}

const NotesView = ({ notes, history, t, onAddNote, onDeleteNote }: {
  notes: Note[],
  history: AudioAnalysis[],
  t: any,
  onAddNote: (c: string) => void,
  onDeleteNote: (id: string) => void
}) => {
  const [newNote, setNewNote] = useState("");

  const getRelatedInfo = (id?: string) => {
    if (!id) return null;
    const analysis = history.find(h => h.id === id);
    return analysis ? `${analysis.detectedGenre} - ${analysis.mood}` : null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="glass-card p-6 rounded-2xl h-fit">
        <h3 className="font-bold text-lg mb-4">{t.note_new}</h3>
        <textarea
          className="w-full h-40 bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-neon-purple resize-none"
          placeholder={t.note_placeholder}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        ></textarea>
        <button
          disabled={!newNote.trim()}
          onClick={() => {
            onAddNote(newNote);
            setNewNote("");
          }}
          className="w-full mt-4 bg-neon-purple/20 hover:bg-neon-purple text-neon-purple hover:text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.note_save}
        </button>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {notes.map(note => (
          <div key={note.id} className="glass-card p-6 rounded-2xl relative group">
            <button
              onClick={() => onDeleteNote(note.id)}
              className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <X size={16} />
            </button>
            <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{note.content}</p>
            <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 border-t border-white/5 pt-3">
              <span>{new Date(note.timestamp).toLocaleDateString()}</span>
              {note.relatedAnalysisId && (
                <span className="flex items-center gap-1 text-neon-blue bg-neon-blue/10 px-2 py-0.5 rounded">
                  <Music size={10} /> {getRelatedInfo(note.relatedAnalysisId)}
                </span>
              )}
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center text-gray-500 py-20">{t.note_empty}</div>
        )}
      </div>
    </div>
  );
}
