import { useState, useRef, useEffect } from 'react';
import { 
  Question, 
  SelectionMode, 
  ClassSelectionConfig, 
  StudentItem, 
  ClassData,
  SavedSession
} from '../types';
import { 
  Upload, 
  File, 
  Loader2, 
  Play, 
  Type, 
  Sparkles, 
  CheckCircle2, 
  Users, 
  Volume2, 
  RotateCcw,
  BookOpen,
  BookmarkPlus,
  FolderOpen,
  Save,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Wand2,
  Trash2,
  PlusCircle,
  CheckCircle,
  FileEdit,
  Cloud,
  CloudUpload,
  CloudDownload,
  LogOut,
  LogIn
} from 'lucide-react';
import SchoolBanner from './SchoolBanner';
import SavedSessionsModal from './SavedSessionsModal';
import SaveSessionDialog from './SaveSessionDialog';
import AIQuestionNormalizer from './AIQuestionNormalizer';
import { 
  getSavedSessions, 
  saveOrUpdateSession,
  pushSessionsToCloud,
  pullSessionsFromCloud
} from '../utils/sessionStorage';
import { parseFlexibleQuestions, formatQuestionsToManualText } from '../utils/questionParser';
import { VoiceGenderPreference, speakQuestion, stopSpeaking, prefetchSpeech, buildMCQuestionScript } from '../utils/speechHelper';
import { playWinnerFanfare, playTick, playCorrectAnswerSound } from '../utils/soundFx';
import { auth, signOutUser } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

interface SetupScreenProps {
  onStart: (
    questions: Question[],
    selectionMode: SelectionMode,
    classConfig: ClassSelectionConfig,
    customStudents: StudentItem[],
    classesList: ClassData[],
    voicePref: VoiceGenderPreference
  ) => void;
}

const SAMPLE_STUDENTS_TEXT = `Nguyễn Hoàng Nam - 10A1
Trần Thị Mai Anh - 10A3
Lê Minh Khang - 10A7
Phạm Gia Bảo - 11A2
Đặng Thu Thảo - 11A5
Bùi Quang Huy - 11A9
Võ Thị Kim Ngân - 12A1
Ngô Quốc Anh - 12A4
Dương Thùy Linh - 12A8
Trịnh Khánh Toàn - 12A12`;

export default function SetupScreen({ onStart }: SetupScreenProps) {
  // Saved Sessions state
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => getSavedSessions());
  const [activeSession, setActiveSession] = useState<SavedSession | null>(() => {
    const list = getSavedSessions();
    return list.length > 0 ? list[0] : null;
  });
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isSaveNewModalOpen, setIsSaveNewModalOpen] = useState(false);
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);

  // Listen to Google Auth state and automatically pull cloud sessions
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (u) {
        try {
          const res = await pullSessionsFromCloud();
          if (res.success && res.sessions.length > 0) {
            setSavedSessions(res.sessions);
            setActiveSession((curr) => curr || res.sessions[0]);
          }
        } catch (err) {
          console.warn('Auto cloud sync notice:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleLogout = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setSessionToast('Đã đăng xuất tài khoản.');
      setTimeout(() => setSessionToast(null), 3000);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Fullscreen state & listener for SetupScreen
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle:', err);
    }
  };

  // AI Voice speech toggle - Default TRUE so questions are automatically read with energetic MC voice
  const [enableAiVoice, setEnableAiVoice] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vts_auto_speak_ai') !== 'false';
    }
    return true;
  });

  // Auto-pull from Cloud when loading app so sessions created on other computers are available immediately
  useEffect(() => {
    pullSessionsFromCloud().then((res) => {
      if (res.success && res.sessions.length > 0) {
        setSavedSessions(res.sessions);
        setActiveSession((current) => {
          if (!current) {
            const first = res.sessions[0];
            if (first.questions?.length > 0) {
              setQuestions(first.questions);
              setManualText(formatQuestionsToManualText(first.questions));
            }
            return first;
          }
          return current;
        });
      }
    }).catch((e) => {
      console.warn('Initial cloud sync notice:', e);
    });
  }, []);

  // Tab for Questions: Normalize (AI) vs Manual vs AI Prompt
  const [isQuestionsExpanded, setIsQuestionsExpanded] = useState(true);
  const [qTab, setQTab] = useState<'normalize' | 'manual' | 'ai'>('manual');
  const [manualText, setManualText] = useState(() => {
    const list = getSavedSessions();
    if (list.length > 0 && list[0].questions?.length > 0) {
      return formatQuestionsToManualText(list[0].questions);
    }
    return '';
  });
  const [questions, setQuestions] = useState<Question[]>(() => {
    const list = getSavedSessions();
    if (list.length > 0 && list[0].questions?.length > 0) {
      return list[0].questions;
    }
    return [];
  });

  // Handle questions produced by AI Question Normalizer
  const handleApplyNormalizedQuestions = (formattedText: string, questionsList: Question[]) => {
    setManualText(formattedText);
    setQuestions(questionsList);
    setSessionToast(`Đã chuẩn hóa và nạp thành công ${questionsList.length} câu hỏi vào hệ thống!`);
    setTimeout(() => setSessionToast(null), 4000);
    // Prefetch only the opening question audio for 0ms simultaneous playback without exhausting API quotas
    if (questionsList.length > 0) {
      const script = buildMCQuestionScript(0, questionsList[0].question, questionsList[0].options);
      prefetchSpeech(script, { genderPreference: voicePref, questionIndex: 0 });
    }
  };

  // AI Generation State
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection Mode: Class+STT vs Named Students
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('class_stt');

  // Class Selection Config (Grade 10, 11, 12 checkboxes + max STT)
  const [grade10, setGrade10] = useState(true);
  const [grade11, setGrade11] = useState(true);
  const [grade12, setGrade12] = useState(true);
  const [maxSTT, setMaxSTT] = useState(40);

  // Named Students state
  const [namedStudentsText, setNamedStudentsText] = useState(SAMPLE_STUDENTS_TEXT);

  // AI Voice preference - Persisted in localStorage so preferred MC voice is consistent everywhere
  const [voicePref, setVoicePref] = useState<VoiceGenderPreference>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vts_voice_preference');
      if (stored) return stored as VoiceGenderPreference;
    }
    return 'aoede';
  });

  const handleSelectVoice = (pref: VoiceGenderPreference) => {
    setVoicePref(pref);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vts_voice_preference', pref);
    }
    if (questions && questions.length > 0) {
      const fullScript = buildMCQuestionScript(0, questions[0].question, questions[0].options);
      prefetchSpeech(fullScript, { genderPreference: pref, questionIndex: 0 });
    }
  };

  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Fullscreen preference for presentation
  const [startInFullScreen, setStartInFullScreen] = useState(true);

  // Auto pre-fetch first question audio in background for 0ms simultaneous voice playback
  useEffect(() => {
    if (questions && questions.length > 0) {
      const fullScript = buildMCQuestionScript(0, questions[0].question, questions[0].options);
      prefetchSpeech(fullScript, { genderPreference: voicePref, questionIndex: 0 });
    }
  }, [questions, voicePref]);

  // Load a saved thematic session
  const loadSession = (session: SavedSession) => {
    setActiveSession(session);
    setQuestions(session.questions);
    setManualText(formatQuestionsToManualText(session.questions));
    setSelectionMode(session.selectionMode || 'class_stt');
    if (session.classConfig) {
      setGrade10(session.classConfig.grade10 ?? true);
      setGrade11(session.classConfig.grade11 ?? true);
      setGrade12(session.classConfig.grade12 ?? true);
      setMaxSTT(session.classConfig.maxSTT || 40);
    }
    if (session.voicePref) {
      setVoicePref(session.voicePref as VoiceGenderPreference);
    }
    setSessionToast(`Đã nạp chuyên đề: "${session.title}" (${session.questions.length} câu hỏi)`);
    setTimeout(() => setSessionToast(null), 3500);
    setIsSessionModalOpen(false);
  };

  // Helper to parse questions safely from text
  const parseQuestionsFromText = (text: string): Question[] => {
    const { questions: parsed } = parseFlexibleQuestions(text);
    return parsed;
  };

  // Create a brand new session from scratch
  const handleCreateNewSession = () => {
    setActiveSession(null);
    setQuestions([]);
    setManualText('');
    setIsQuestionsExpanded(true);
    setQTab('manual');
    setIsSaveNewModalOpen(true);
  };

  // Save current questions and settings as a new thematic session
  const handleSaveCurrentAsNew = (title: string, description: string) => {
    let curQs = questions;
    if (curQs.length === 0 && manualText.trim()) {
      curQs = parseQuestionsFromText(manualText);
      if (curQs.length > 0) setQuestions(curQs);
    }

    if (curQs.length === 0) {
      alert('Vui lòng chuẩn bị ít nhất 1 câu hỏi hợp lệ trước khi lưu chuyên đề.');
      return;
    }

    const newSess: SavedSession = {
      id: 'sess_' + Date.now(),
      title,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      questions: curQs,
      selectionMode,
      classConfig: { grade10, grade11, grade12, maxSTT },
      voicePref,
    };

    const updated = saveOrUpdateSession(newSess);
    setSavedSessions(updated);
    setActiveSession(newSess);
    setSessionToast(`Đã lưu thành công chuyên đề: "${title}" (Đang đồng bộ đám mây...)`);
    pushSessionsToCloud(updated).then(() => {
      setSessionToast(`Đã lưu & đồng bộ chuyên đề "${title}" lên đám mây thành công!`);
    }).catch(() => {});
    setTimeout(() => setSessionToast(null), 3500);
  };

  // Update existing active session
  const handleUpdateCurrentSession = () => {
    if (!activeSession) {
      setIsSaveNewModalOpen(true);
      return;
    }

    let curQs = questions;
    if (curQs.length === 0 && manualText.trim()) {
      curQs = parseQuestionsFromText(manualText);
      if (curQs.length > 0) setQuestions(curQs);
    }

    const updatedSession: SavedSession = {
      ...activeSession,
      questions: curQs.length > 0 ? curQs : activeSession.questions,
      selectionMode,
      classConfig: { grade10, grade11, grade12, maxSTT },
      voicePref,
      updatedAt: Date.now(),
    };

    const updated = saveOrUpdateSession(updatedSession);
    setSavedSessions(updated);
    setActiveSession(updatedSession);
    setSessionToast(`Đã cập nhật chuyên đề: "${activeSession.title}" (Đang đồng bộ đám mây...)`);
    pushSessionsToCloud(updated).then(() => {
      setSessionToast(`Đã lưu thay đổi & đồng bộ chuyên đề "${activeSession.title}" lên đám mây!`);
    }).catch(() => {});
    setTimeout(() => setSessionToast(null), 3500);
  };

  // Quick manual trigger for cloud sync: Bi-directional synchronization
  const handleQuickCloudSync = async () => {
    setIsCloudSyncing(true);
    setSessionToast('Đang kết nối đám mây để đồng bộ dữ liệu...');
    try {
      const currentList = getSavedSessions();
      // If we have local sessions, push them first so cloud always has latest local data
      if (currentList.length > 0) {
        await pushSessionsToCloud(currentList).catch(() => {});
      }

      // Then pull all merged sessions from cloud (Firestore or Server)
      const res = await pullSessionsFromCloud();
      if (res.success && res.sessions.length > 0) {
        setSavedSessions(res.sessions);
        setSessionToast(res.message);
        if (!activeSession) {
          loadSession(res.sessions[0]);
        }
      } else if (currentList.length > 0) {
        const pushRes = await pushSessionsToCloud(currentList);
        setSessionToast(pushRes.message);
      } else {
        setSessionToast(res.message);
      }
    } catch (e: any) {
      setSessionToast(`Lỗi đồng bộ: ${e.message || e}`);
    } finally {
      setIsCloudSyncing(false);
      setTimeout(() => setSessionToast(null), 4500);
    }
  };

  // Parse questions from manual textarea with instant visual feedback and audio prefetch
  const handleConfirmManualQuestions = () => {
    if (!manualText.trim()) {
      alert('Vui lòng dán hoặc nhập nội dung câu hỏi vào khung bên dưới.');
      return;
    }

    const { questions: parsed } = parseFlexibleQuestions(manualText);
    if (parsed.length === 0) {
      alert(
        'Không thể nhận diện câu hỏi từ văn bản vừa dán. Thầy cô vui lòng kiểm tra:\n' +
        '• Mỗi câu có số thứ tự (Câu 1: hoặc 1.)\n' +
        '• Có các phương án A, B, C, D\n' +
        '• Có dòng "Đáp án: [A/B/C/D]"\n\n' +
        'Hoặc bấm tab "⚡ AI Chuẩn Hóa (.doc, PDF, Ảnh)" để AI tự động cấu trúc lại đề!'
      );
      return;
    }

    setQuestions(parsed);
    setManualText(formatQuestionsToManualText(parsed));
    setSessionToast(`✅ Đã phân tích & nạp thành công ${parsed.length} câu hỏi vào hệ thống!`);
    setTimeout(() => setSessionToast(null), 4000);

    // Prefetch only the opening question to conserve quota
    if (parsed.length > 0) {
      const script = buildMCQuestionScript(0, parsed[0].question, parsed[0].options);
      prefetchSpeech(script, { genderPreference: voicePref, questionIndex: 0 });
    }
  };

  // Load 2 sample test questions
  const handleLoadSampleQuestions = () => {
    const sample = `Câu 1: Nữ anh hùng lực lượng vũ trang nhân dân Võ Thị Sáu sinh năm bao nhiêu?
A. 1930
B. 1933
C. 1935
D. 1940
Đáp án: B

Câu 2: Đất Đỏ - quê hương của nữ anh hùng Võ Thị Sáu thuộc tỉnh nào ngày nay?
A. Đồng Nai
B. Bình Dương
C. Bà Rịa - Vũng Tàu
D. Tây Ninh
Đáp án: C`;

    setManualText(sample);
    const { questions: parsed } = parseFlexibleQuestions(sample);
    setQuestions(parsed);
    setSessionToast('Đã nạp mẫu 2 câu trắc nghiệm chuẩn!');
    setTimeout(() => setSessionToast(null), 3000);
  };

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      const formData = new FormData();
      if (prompt) formData.append('prompt', prompt);
      if (file) formData.append('file', file);

      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setQuestions(data);
    } catch (e) {
      alert('Có lỗi khi tạo câu hỏi qua AI. Bạn có thể sử dụng tab Dán Câu Hỏi (Nhanh) bên cạnh.');
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate class list based on selected grades
  const buildClasses = (): ClassData[] => {
    const list: ClassData[] = [];
    let id = 1;

    // Grade 10: 10A1 -> 10A11
    if (grade10) {
      for (let i = 1; i <= 11; i++) {
        list.push({
          id: String(id++),
          name: `10A${i}`,
          participants: Array.from({ length: maxSTT }, (_, idx) => `STT ${idx + 1}`),
        });
      }
    }

    // Grade 11: 11A1 -> 11A11
    if (grade11) {
      for (let i = 1; i <= 11; i++) {
        list.push({
          id: String(id++),
          name: `11A${i}`,
          participants: Array.from({ length: maxSTT }, (_, idx) => `STT ${idx + 1}`),
        });
      }
    }

    // Grade 12: 12A1 -> 12A12
    if (grade12) {
      for (let i = 1; i <= 12; i++) {
        list.push({
          id: String(id++),
          name: `12A${i}`,
          participants: Array.from({ length: maxSTT }, (_, idx) => `STT ${idx + 1}`),
        });
      }
    }

    return list;
  };

  // Parse custom named students
  const parseNamedStudents = (): StudentItem[] => {
    const lines = namedStudentsText.split('\n').map(l => l.trim()).filter(l => l);
    const result: StudentItem[] = [];

    lines.forEach((line, idx) => {
      // Formats: "Nguyễn Văn A - 10A1" or "10A1: Nguyễn Văn A"
      if (line.includes('-')) {
        const parts = line.split('-');
        result.push({
          id: String(idx + 1),
          name: parts[0].trim(),
          className: parts[1] ? parts[1].trim() : 'VTS',
        });
      } else if (line.includes(':')) {
        const parts = line.split(':');
        const cName = parts[0].trim();
        const names = parts[1].split(',').map(n => n.trim()).filter(n => n);
        names.forEach(n => {
          result.push({
            id: String(result.length + 1),
            name: n,
            className: cName,
          });
        });
      } else {
        result.push({
          id: String(idx + 1),
          name: line,
          className: 'THPT VTS',
        });
      }
    });

    return result;
  };

  const handleTestVoice = () => {
    if (isTestingVoice) {
      stopSpeaking();
      setIsTestingVoice(false);
      return;
    }

    setIsTestingVoice(true);
    const testText = "Chào mừng toàn thể quý thầy cô cùng các bạn học sinh Trường Trung Học Phổ Thông Võ Thị Sáu đến với buổi sinh hoạt chuyên đề ngày hôm nay! Chúc các bạn sẽ có những giây phút thật hào hứng và trả lời thật xuất sắc nhé!";
    speakQuestion(testText, {
      genderPreference: voicePref,
      questionIndex: 0,
      rate: 1.12,
      onStart: () => setIsTestingVoice(true),
      onEnd: () => setIsTestingVoice(false),
      onError: () => setIsTestingVoice(false),
    });
  };

  const handleStart = () => {
    // 1. Ensure latest questions are captured from manualText or state
    let currentQuestions = [...questions];

    if (manualText.trim()) {
      const { questions: freshlyParsed } = parseFlexibleQuestions(manualText);
      if (freshlyParsed.length > 0) {
        currentQuestions = freshlyParsed;
        setQuestions(freshlyParsed);
      }
    }

    if (currentQuestions.length === 0) {
      alert('Chưa có câu hỏi nào trong hệ thống! Thầy cô vui lòng dán nội dung câu hỏi hoặc chuẩn hóa bằng AI trước khi bắt đầu.');
      setIsQuestionsExpanded(true);
      setQTab('manual');
      return;
    }

    // 2. Validate selection mode
    if (selectionMode === 'class_stt') {
      if (!grade10 && !grade11 && !grade12) {
        alert('Vui lòng tích chọn ít nhất một khối lớp (Khối 10, 11 hoặc 12).');
        return;
      }
    } else {
      const parsedStudents = parseNamedStudents();
      if (parsedStudents.length === 0) {
        alert('Vui lòng nhập ít nhất 1 học sinh trong danh sách tên.');
        return;
      }
    }

    const classesList = buildClasses();
    const customStudents = parseNamedStudents();

    // Trigger Fullscreen on direct user click for best projector experience
    if (startInFullScreen && !document.fullscreenElement) {
      try {
        document.documentElement.requestFullscreen().catch(() => {});
      } catch {}
    }

    onStart(
      currentQuestions,
      selectionMode,
      { grade10, grade11, grade12, maxSTT },
      customStudents,
      classesList,
      voicePref
    );
  };

  // Stats calculation
  const totalClassesCount = (grade10 ? 11 : 0) + (grade11 ? 11 : 0) + (grade12 ? 12 : 0);

  return (
    <div className="w-full max-w-[1650px] mx-auto p-3 sm:p-6 lg:p-8 py-4 sm:py-6">
      {/* School Header Banner with Fullscreen Toggle Button */}
      <SchoolBanner 
        onToggleFullscreen={toggleFullScreen} 
        isFullScreen={isFullScreen} 
      />

      {/* Thematic Assembly Session Selector & Management Bar (Lưu & Chọn Buổi Sinh Hoạt) - Refined & Compact */}
      <div className="my-5 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4.5 border border-rose-200/80 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
        {/* Top Info & Action Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <BookOpen size={20} className="text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-50 text-red-700 px-2 py-0.5 rounded-md border border-rose-200">
                  Chuyên Đề Của Thầy Cô
                </span>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  • <span className="text-red-600 font-black">{questions.length}</span> câu hỏi đã nạp
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
                {activeSession ? activeSession.title : 'Chuyên Đề Mới (Đang soạn thảo)'}
              </h3>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleCreateNewSession}
              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-2xs"
              title="Tạo mới một chuyên đề và đặt tên theo ý muốn"
            >
              <PlusCircle size={14} className="text-sky-600" /> <span>+ Tạo Chuyên Đề Mới</span>
            </button>

            {activeSession && (
              <button
                onClick={handleUpdateCurrentSession}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 border border-slate-200 shadow-2xs"
                title="Lưu các câu hỏi vừa sửa vào chuyên đề này"
              >
                <Save size={14} className="text-emerald-600" /> <span>Lưu Thay Đổi</span>
              </button>
            )}

            <button
              onClick={() => setIsSaveNewModalOpen(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-2xs"
              title="Lưu bộ câu hỏi hiện tại thành một chuyên đề mới"
            >
              <BookmarkPlus size={14} className="text-red-600" /> <span>Lưu Chuyên Đề</span>
            </button>

            <button
              onClick={() => setIsSessionModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Mở danh sách các chuyên đề thầy cô đã lưu"
            >
              <FolderOpen size={14} className="text-amber-300" /> <span>Kho Chuyên Đề ({savedSessions.length})</span>
            </button>

            <button
              onClick={handleQuickCloudSync}
              disabled={isCloudSyncing}
              className="px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              title="Đồng bộ tự động các chuyên đề & câu hỏi qua Đám Mây máy chủ (không cần đăng nhập)"
            >
              <Cloud size={14} className={isCloudSyncing ? "animate-spin text-sky-200" : "text-sky-200"} />
              <span>{isCloudSyncing ? "Đang Đồng Bộ..." : "Đồng Bộ Đám Mây"}</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="max-w-[130px] truncate" title={currentUser.email || ''}>
                  {currentUser.email}
                </span>
                <button
                  onClick={handleGoogleLogout}
                  className="p-1 hover:bg-emerald-100 rounded text-slate-500 hover:text-rose-600 transition"
                  title="Đăng xuất tài khoản này"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Quick-Pick Thematic Pills for Super Fast Switch */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Layers size={12} /> Nhanh:
          </span>
          {savedSessions.length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              Chưa có chuyên đề lưu trữ • Thầy cô tự nạp câu hỏi và bấm "Lưu Chuyên Đề" để lưu trữ lại cho các buổi sau.
            </span>
          ) : (
            savedSessions.slice(0, 5).map((sess, idx) => {
              const isSelected = activeSession?.id === sess.id;
              return (
                <button
                  key={sess.id}
                  onClick={() => loadSession(sess)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-xs ring-1 ring-red-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>{sess.title.split(':')[0] || `Chuyên đề ${idx + 1}`}</span>
                  {isSelected && <CheckCircle2 size={11} className="text-amber-300" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Session Toast Notification */}
      {sessionToast && (
        <div className="mb-5 p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="text-amber-300 shrink-0" />
          <span>{sessionToast}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Question Configuration (7 cols) - Collapsible Section */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col transition-all">
          {/* Clickable Header for Collapsible Question Prep */}
          <div 
            onClick={() => setIsQuestionsExpanded(!isQuestionsExpanded)}
            className={`p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer transition-colors select-none ${
              isQuestionsExpanded 
                ? 'bg-gradient-to-r from-sky-50 via-indigo-50/40 to-purple-50/50 border-b border-slate-100'
                : 'bg-gradient-to-r from-slate-50 via-sky-50/30 to-indigo-50/20 hover:bg-sky-50/50'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                <BookOpen size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                    1. Chuẩn Bị Bộ Câu Hỏi
                  </h2>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={12} /> {questions.length} câu hỏi sẵn sàng
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {isQuestionsExpanded 
                    ? 'Bấm để thu gọn lại phần chuẩn bị câu hỏi' 
                    : 'Đang thu gọn • Bấm vào đây để mở rộng soạn thảo hoặc chuẩn hóa bằng AI'}
                </p>
              </div>
            </div>

            {/* Header Right Action & Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {!isQuestionsExpanded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQTab('normalize');
                    setIsQuestionsExpanded(true);
                  }}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black rounded-xl shadow-xs hover:from-purple-700 hover:to-indigo-700 transition"
                >
                  <Sparkles size={13} className="text-amber-300" />
                  <span>⚡ AI Chuẩn Hóa</span>
                </button>
              )}

              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                  isQuestionsExpanded
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-white text-sky-700 border-sky-200 shadow-2xs'
                }`}
              >
                {isQuestionsExpanded ? (
                  <>
                    <span>Thu gọn</span>
                    <ChevronUp size={15} />
                  </>
                ) : (
                  <>
                    <span>Mở rộng</span>
                    <ChevronDown size={15} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expanded Question Configuration Area */}
          {isQuestionsExpanded && (
            <div className="flex flex-col flex-1 animate-in fade-in duration-200">
              {/* Question Feature Navigation Tabs */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex bg-slate-200/90 p-1 rounded-2xl">
                  <button
                    onClick={() => setQTab('normalize')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      qTab === 'normalize'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles size={14} className={qTab === 'normalize' ? 'text-amber-300' : 'text-purple-500'} />
                    <span>⚡ AI Chuẩn Hóa (.doc, PDF, Ảnh)</span>
                  </button>

                  <button
                    onClick={() => setQTab('manual')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      qTab === 'manual'
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Type size={14} className="text-sky-600" />
                    <span>Dán Câu Hỏi Chuẩn</span>
                  </button>

                  <button
                    onClick={() => setQTab('ai')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      qTab === 'ai'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wand2 size={14} className="text-indigo-600" />
                    <span>AI Tạo Đề Mới</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuestionsExpanded(false)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-semibold flex items-center gap-1 transition"
                >
                  <span>Thu gọn phần này</span>
                  <ChevronUp size={13} />
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-5 flex-1 flex flex-col">
                {/* TAB 1: AI Question Normalizer */}
                {qTab === 'normalize' && (
                  <AIQuestionNormalizer
                    onApplyQuestions={handleApplyNormalizedQuestions}
                  />
                )}

                {/* TAB 2: Manual Textarea */}
                {qTab === 'manual' && (
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <FileEdit size={14} className="text-sky-600" />
                        Danh sách câu hỏi & đáp án
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLoadSampleQuestions}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 hover:bg-sky-100 flex items-center gap-1 transition"
                        >
                          <RotateCcw size={12} /> Nạp mẫu 2 câu
                        </button>
                        {manualText && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Thầy cô có chắc muốn xóa sạch nội dung khung soạn thảo?')) {
                                setManualText('');
                                setQuestions([]);
                              }
                            }}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 hover:bg-rose-100 flex items-center gap-1 transition"
                          >
                            <Trash2 size={12} /> Xóa khung
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      className="w-full flex-1 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-sky-500 outline-none resize-none font-mono text-xs sm:text-sm leading-relaxed min-h-[190px] bg-slate-50/50"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Dán câu hỏi của thầy cô vào đây (Hỗ trợ nhiều kiểu đánh số 1., Câu 1:, A., A/ ...):

Câu 1: Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là gì?
A. Thành phố Hồ Chí Minh
B. Hà Nội
C. Đà Nẵng
D. Cần Thơ
Đáp án: B"
                    />

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleConfirmManualQuestions}
                        className="flex-1 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 text-white py-3 rounded-2xl font-black hover:from-sky-600 hover:via-indigo-700 hover:to-purple-700 transition shadow-md shadow-sky-200 flex items-center justify-center gap-2 active:scale-98 text-sm"
                      >
                        <CheckCircle2 size={18} className="text-amber-300" />
                        <span>Phân Tích & Xác Nhận Câu Hỏi</span>
                      </button>
                    </div>

                    {/* Live Parsed Question Cards list */}
                    {questions.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Danh sách {questions.length} câu hỏi đã nạp vào máy:
                          </div>
                          <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            Sẵn sàng trình chiếu
                          </span>
                        </div>

                        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                          {questions.map((q, qIndex) => {
                            const letters = ['A', 'B', 'C', 'D'];
                            return (
                              <div
                                key={qIndex}
                                className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 hover:border-slate-300 transition text-xs relative group"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-bold text-slate-900 leading-snug">
                                    <span className="inline-block px-1.5 py-0.5 bg-sky-100 text-sky-800 font-black rounded-md mr-1.5 text-[11px]">
                                      Câu {qIndex + 1}
                                    </span>
                                    {q.question}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = questions.filter((_, i) => i !== qIndex);
                                      setQuestions(next);
                                      setManualText(formatQuestionsToManualText(next));
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1 opacity-60 group-hover:opacity-100 transition shrink-0"
                                    title="Xóa câu này"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>

                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {q.options.map((opt, oIndex) => {
                                    const isCorrect = q.correctAnswer === oIndex;
                                    return (
                                      <div
                                        key={oIndex}
                                        className={`px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition ${
                                          isCorrect
                                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold'
                                            : 'bg-white text-slate-600 border border-slate-200/80'
                                        }`}
                                      >
                                        <span
                                          className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                          }`}
                                        >
                                          {letters[oIndex]}
                                        </span>
                                        <span className="truncate">{opt}</span>
                                        {isCorrect && <CheckCircle size={12} className="text-emerald-600 ml-auto shrink-0" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Prompt AI Generator */}
                {qTab === 'ai' && (
                  <div className="flex flex-col flex-1">
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                        Tải tài liệu trắc nghiệm (.docx, .pdf, ảnh)
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl p-5 text-center cursor-pointer hover:bg-indigo-50 transition"
                      >
                        {file ? (
                          <div className="flex items-center justify-center gap-2 text-indigo-700 font-bold text-xs sm:text-sm">
                            <File size={22} />
                            <span>{file.name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-slate-400">
                            <Upload size={28} className="mb-1 text-indigo-400" />
                            <span className="text-xs sm:text-sm font-semibold text-slate-600">Nhấn để chọn file tài liệu</span>
                            <span className="text-[11px] text-slate-400">Hỗ trợ giáo án, file đề cương Word, PDF</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                          if (e.target.files?.length) setFile(e.target.files[0]);
                        }}
                      />
                    </div>

                    <div className="mb-4 flex-1">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                        Yêu cầu tạo đề cho AI (Tùy chọn)
                      </label>
                      <textarea
                        className="w-full border border-slate-200 rounded-2xl p-3 h-20 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-xs sm:text-sm bg-slate-50/50"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ví dụ: Tạo 5 câu trắc nghiệm tìm hiểu về lịch sử trường THPT Võ Thị Sáu và an toàn giao thông..."
                      />
                    </div>

                    <button
                      onClick={handleGenerateQuestions}
                      disabled={isGenerating || (!prompt && !file)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-2xl font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition shadow-md shadow-indigo-200 active:scale-98"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      {isGenerating ? 'AI đang tạo câu hỏi...' : 'Tạo Câu Hỏi Bằng AI'}
                    </button>
                  </div>
                )}

                {/* Questions count feedback */}
                {questions.length > 0 && (
                  <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>Đã sẵn sàng {questions.length} câu hỏi trắc nghiệm!</span>
                    </span>
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Đầy đủ 4 phương án A-B-C-D
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Voice & Audio Preview Bar (Always accessible) */}
          <div className="bg-slate-50/80 p-4 sm:p-5 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <Volume2 size={16} className="text-sky-600" />
                  Giọng Đọc MC Gameshow Toàn Trường (Thanh thoát & Sôi động)
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleSelectVoice('aoede')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                      voicePref === 'aoede' || voicePref === 'mc_energetic'
                        ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🎤 MC Nữ Thanh Thoát
                  </button>
                  <button
                    onClick={() => handleSelectVoice('puck')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                      voicePref === 'puck' || voicePref === 'male'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-orange-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🚀 MC Nam Hoạt Náo
                  </button>
                  <button
                    onClick={() => handleSelectVoice('kore')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      voicePref === 'kore' || voicePref === 'female'
                        ? 'bg-pink-600 text-white border-pink-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    👩 MC Nữ Tươi Sáng
                  </button>
                  <button
                    onClick={() => handleSelectVoice('zephyr')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      voicePref === 'zephyr'
                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ MC Nam Nhanh Nhẹn
                  </button>
                  <button
                    onClick={() => handleSelectVoice('alternate')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      voicePref === 'alternate'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🔄 MC Luân Phiên
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  onClick={handleTestVoice}
                  className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold border border-sky-200 transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Volume2 size={13} />
                  {isTestingVoice ? 'Dừng đọc' : 'Nghe thử giọng MC'}
                </button>
                <button
                  onClick={() => playWinnerFanfare()}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold border border-amber-200 transition"
                  title="Thử âm thanh kèn chiến thắng"
                >
                  🎺 Fanfare
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Student & Class Picker Modes (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                  <Users size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    2. Chế Độ Chọn Học Sinh
                  </h2>
                  <p className="text-xs text-slate-500">Tùy biến phạm vi bốc thăm trên sân cờ</p>
                </div>
              </div>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {totalClassesCount} lớp tham gia
              </span>
            </div>

            {/* Segmented Mode Control */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/80 rounded-2xl mb-5">
              <button
                onClick={() => setSelectionMode('class_stt')}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1.5 ${
                  selectionMode === 'class_stt'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🎲 Lớp + Số Thứ Tự</span>
              </button>
              <button
                onClick={() => setSelectionMode('named_students')}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1.5 ${
                  selectionMode === 'named_students'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📋 Danh Sách Họ Tên</span>
              </button>
            </div>

            {/* Mode 1: Class + STT */}
            {selectionMode === 'class_stt' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-rose-50/30 rounded-2xl p-4 border border-amber-200/70">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1">
                      <span>Chọn các khối tham gia:</span>
                    </span>
                    <button
                      onClick={() => {
                        const allSelected = grade10 && grade11 && grade12;
                        setGrade10(!allSelected);
                        setGrade11(!allSelected);
                        setGrade12(!allSelected);
                      }}
                      className="text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline"
                    >
                      {grade10 && grade11 && grade12 ? 'Bỏ chọn hết' : 'Chọn cả 3 khối'}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {/* Grade 10 - Warm Amber */}
                    <label className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                      grade10 
                        ? 'bg-white border-amber-300 shadow-xs ring-1 ring-amber-300/50' 
                        : 'bg-slate-50/80 border-slate-200 opacity-60'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={grade10}
                          onChange={(e) => setGrade10(e.target.checked)}
                          className="w-5 h-5 rounded text-amber-600 focus:ring-amber-400 accent-amber-500"
                        />
                        <div>
                          <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                            Khối 10
                          </div>
                          <div className="text-[11px] text-slate-500">Từ 10A1 đến 10A11</div>
                        </div>
                      </div>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        11 lớp
                      </span>
                    </label>

                    {/* Grade 11 - Emerald / Teal */}
                    <label className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                      grade11 
                        ? 'bg-white border-emerald-300 shadow-xs ring-1 ring-emerald-300/50' 
                        : 'bg-slate-50/80 border-slate-200 opacity-60'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={grade11}
                          onChange={(e) => setGrade11(e.target.checked)}
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-400 accent-emerald-500"
                        />
                        <div>
                          <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                            Khối 11
                          </div>
                          <div className="text-[11px] text-slate-500">Từ 11A1 đến 11A11</div>
                        </div>
                      </div>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                        11 lớp
                      </span>
                    </label>

                    {/* Grade 12 - Indigo / Purple */}
                    <label className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                      grade12 
                        ? 'bg-white border-purple-300 shadow-xs ring-1 ring-purple-300/50' 
                        : 'bg-slate-50/80 border-slate-200 opacity-60'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={grade12}
                          onChange={(e) => setGrade12(e.target.checked)}
                          className="w-5 h-5 rounded text-purple-600 focus:ring-purple-400 accent-purple-500"
                        />
                        <div>
                          <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                            Khối 12
                          </div>
                          <div className="text-[11px] text-slate-500">Từ 12A1 đến 12A12</div>
                        </div>
                      </div>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                        12 lớp
                      </span>
                    </label>
                  </div>
                </div>

                {/* Sĩ số / STT range */}
                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Khoảng STT học sinh trong lớp:
                    </label>
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                      Từ STT 1 đến {maxSTT}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={25}
                      max={48}
                      value={maxSTT}
                      onChange={(e) => setMaxSTT(parseInt(e.target.value) || 40)}
                      className="w-full accent-indigo-600"
                    />
                    <input
                      type="number"
                      value={maxSTT}
                      onChange={(e) => setMaxSTT(Math.min(50, Math.max(10, parseInt(e.target.value) || 40)))}
                      className="w-16 p-1.5 rounded-xl border border-slate-300 text-center font-black text-sm bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    * Khuyên dùng: STT 1 đến 40 đảm bảo lớp nào cũng có học sinh tương ứng.
                  </p>
                </div>

                {/* Output Example preview */}
                <div className="p-3 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-2xl border border-amber-200/80 text-xs text-amber-950 font-medium flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wide font-bold text-amber-800">Mẫu hiển thị khi bốc thăm:</span>
                    <div className="font-black text-amber-900 text-sm mt-0.5">
                      &quot;Lớp 10A1 - Học sinh có STT 12&quot;
                    </div>
                  </div>
                  <span className="text-2xl">🎯</span>
                </div>
              </div>
            )}

            {/* Mode 2: Named Students */}
            {selectionMode === 'named_students' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Dán danh sách học sinh:
                    </label>
                    <button
                      onClick={() => setNamedStudentsText(SAMPLE_STUDENTS_TEXT)}
                      className="text-xs text-indigo-600 font-bold hover:underline"
                    >
                      Nạp mẫu 10 học sinh
                    </button>
                  </div>
                  <textarea
                    className="w-full border border-slate-200 rounded-2xl p-3 h-44 focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm font-mono leading-relaxed bg-slate-50/50"
                    value={namedStudentsText}
                    onChange={(e) => setNamedStudentsText(e.target.value)}
                    placeholder="Nguyễn Văn A - 10A1&#10;Trần Thị B - 11A3&#10;Lê Hoàng C - 12A5"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * Định dạng: <code>Họ và tên - Tên lớp</code> (mỗi học sinh một dòng)
                  </p>
                </div>

                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wide font-bold text-indigo-800">Mẫu hiển thị khi bốc thăm:</span>
                    <div className="font-black text-indigo-900 text-sm mt-0.5">
                      &quot;Lớp 10A1 - Nguyễn Hoàng Nam&quot;
                    </div>
                  </div>
                  <span className="text-2xl">🌟</span>
                </div>
              </div>
            )}
          </div>

          {/* Start Presentation Button - Vibrant and Celebratory */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            {/* Fullscreen & AI Voice Options */}
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 mb-3 px-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-bold text-slate-700 hover:text-purple-700 bg-purple-50/80 hover:bg-purple-100/90 px-3.5 py-1.5 rounded-full border border-purple-200 transition">
                <input
                  type="checkbox"
                  checked={enableAiVoice}
                  onChange={(e) => {
                    setEnableAiVoice(e.target.checked);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('vts_auto_speak_ai', e.target.checked ? 'true' : 'false');
                    }
                  }}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                />
                <span>🎙️ Bật giọng đọc MC AI (Tự động đọc câu hỏi)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-bold text-slate-700 hover:text-sky-700 bg-sky-50/80 hover:bg-sky-100/90 px-3.5 py-1.5 rounded-full border border-sky-200 transition">
                <input
                  type="checkbox"
                  checked={startInFullScreen}
                  onChange={(e) => setStartInFullScreen(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                />
                <span>🖥️ Tự động bật Toàn Màn Hình (F11) khi bắt đầu</span>
              </label>
            </div>

            <button
              onClick={handleStart}
              className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:from-red-700 hover:via-rose-700 hover:to-amber-600 text-white py-4 sm:py-4.5 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg shadow-rose-300/60 flex items-center justify-center gap-3 transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Play fill="currentColor" size={22} className="text-amber-300" />
              <span>BẮT ĐẦU TRÌNH CHIẾU SINH HOẠT CHUYÊN ĐỀ</span>
            </button>
            <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-slate-500 font-medium">
              <span>⚡ 5 Minigame sôi động</span>
              <span>•</span>
              <span>🎙️ Giọng đọc MC thời gian thực</span>
              <span>•</span>
              <span>🎺 Âm thanh sân khấu</span>
            </div>
          </div>

          {/* Footer Developer Credit */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs font-semibold text-slate-400 tracking-wide select-none">
            Được phát triển bởi Thầy Trịnh Tuấn Kiệt
          </div>
        </div>
      </div>

      {/* Saved Sessions Manager Modal */}
      <SavedSessionsModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSavedSessions(getSavedSessions());
        }}
        activeSessionId={activeSession?.id}
        onSelectSession={(sess) => loadSession(sess)}
        onSaveCurrentAsNew={() => {
          setIsSessionModalOpen(false);
          setIsSaveNewModalOpen(true);
        }}
      />

      {/* Save Current as New Thematic Session Dialog */}
      <SaveSessionDialog
        isOpen={isSaveNewModalOpen}
        onClose={() => setIsSaveNewModalOpen(false)}
        defaultTitle={activeSession ? `${activeSession.title} (Mới)` : ''}
        onSave={(title, desc) => handleSaveCurrentAsNew(title, desc)}
      />
    </div>
  );
}
