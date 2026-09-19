import { useState, useEffect, type ReactNode } from 'react';
import { triggerFullScreenFireworks, stopFireworks } from '../utils/confettiFireworks';
import { 
  Question, 
  ClassData, 
  SelectionMode, 
  ClassSelectionConfig, 
  StudentItem, 
  GameSelectionResult,
  MinigameType 
} from '../types';
import WheelOfFortune from './animations/WheelOfFortune';
import LuckyBalls from './animations/LuckyBalls';
import SlotMachine from './animations/SlotMachine';
import RocketRace from './animations/RocketRace';
import MysteryChest from './animations/MysteryChest';
import SchoolBanner from './SchoolBanner';
import { 
  ArrowLeft, 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  Volume2, 
  VolumeX, 
  Sparkles, 
  Square,
  Trophy,
  HelpCircle,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  playQuestionEnter, 
  playSuspenseTension, 
  playCorrectAnswerSound, 
  playOptionSelectSound,
  playDramaticLockingLoop,
  playWrongAnswerSound,
  playWinnerFanfare,
  setSoundMuted, 
  getSoundMuted 
} from '../utils/soundFx';
import { 
  speakQuestion, 
  stopSpeaking, 
  prefetchSpeech,
  VoiceGenderPreference,
  buildMCQuestionScript,
  buildMCCelebrationScript,
  buildMCEncouragementScript
} from '../utils/speechHelper';

interface PresentationScreenProps {
  questions: Question[];
  selectionMode: SelectionMode;
  classConfig: ClassSelectionConfig;
  customStudents: StudentItem[];
  classes: ClassData[];
  voicePreference: VoiceGenderPreference;
  onBack: () => void;
}

type ScreenState = 
  | 'IDLE' 
  | 'MINIGAME' 
  | 'ANNOUNCE_PLAYER' 
  | 'SHOW_QUESTION' 
  | 'SHOW_ANSWER';

interface ResultBannerState {
  isCorrect: boolean;
  title: string;
  subtitle: string;
}

export default function PresentationScreen({
  questions,
  selectionMode,
  classConfig,
  customStudents,
  classes,
  voicePreference,
  onBack,
}: PresentationScreenProps) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [activeGame, setActiveGame] = useState<MinigameType>('WHEEL');

  // Selected student/class from minigame
  const [selectedResult, setSelectedResult] = useState<GameSelectionResult>({
    className: '10A1',
    stt: 1,
    displayText: 'Lớp 10A1 - Học sinh có STT 01',
  });

  // Interactive Answer Selection & Locking States
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [lockingPhase, setLockingPhase] = useState(0);
  const [resultBanner, setResultBanner] = useState<ResultBannerState | null>(null);

  // Sound and Voice States
  const [currentVoicePref, setCurrentVoicePref] = useState<VoiceGenderPreference>(voicePreference);
  const [isMuted, setIsMutedState] = useState(getSoundMuted());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeakQuestion, setAutoSpeakQuestion] = useState(true);

  // Fullscreen State & Handlers
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullScreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullScreen(false);
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle notice:', err);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleFullScreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute available classes list based on selected grades
  const getAvailableClassNames = (): string[] => {
    const list: string[] = [];
    if (classConfig.grade10) {
      for (let i = 1; i <= 11; i++) list.push(`10A${i}`);
    }
    if (classConfig.grade11) {
      for (let i = 1; i <= 11; i++) list.push(`11A${i}`);
    }
    if (classConfig.grade12) {
      for (let i = 1; i <= 12; i++) list.push(`12A${i}`);
    }
    return list.length > 0 ? list : ['10A1', '11A1', '12A1'];
  };

  const pickRandomPlayer = () => {
    if (selectionMode === 'class_stt') {
      const availClasses = getAvailableClassNames();
      const randClass = availClasses[Math.floor(Math.random() * availClasses.length)];
      const maxStt = classConfig.maxSTT || 40;
      const randSTT = Math.floor(Math.random() * maxStt) + 1;
      
      setSelectedResult({
        className: randClass,
        stt: randSTT,
        displayText: `Lớp ${randClass} - Học sinh có STT ${randSTT < 10 ? '0' + randSTT : randSTT}`,
      });
    } else {
      if (customStudents.length > 0) {
        const randStudent = customStudents[Math.floor(Math.random() * customStudents.length)];
        setSelectedResult({
          className: randStudent.className,
          studentName: randStudent.name,
          displayText: `Lớp ${randStudent.className} - ${randStudent.name}`,
        });
      } else {
        setSelectedResult({
          className: '10A1',
          studentName: 'Học sinh may mắn',
          displayText: 'Lớp 10A1 - Học sinh may mắn',
        });
      }
    }
  };

  const startMinigame = (gameType: MinigameType) => {
    pickRandomPlayer();
    setActiveGame(gameType);
    setScreenState('MINIGAME');
  };

  const handleMinigameEnd = () => {
    setScreenState('ANNOUNCE_PLAYER');
  };

  // Proactively pre-fetch question audio so speech plays simultaneously with question card appearance
  useEffect(() => {
    if (!questions || questions.length === 0) return;

    const curQ = questions[currentQIndex];
    if (curQ) {
      const qSpeech = buildMCQuestionScript(currentQIndex, curQ.question, curQ.options);
      prefetchSpeech(qSpeech, { genderPreference: currentVoicePref, questionIndex: currentQIndex });
    }
  }, [currentQIndex, currentVoicePref, questions]);

  const proceedToQuestion = () => {
    setSelectedAnswer(null);
    setIsLocking(false);
    setResultBanner(null);
    setScreenState('SHOW_QUESTION');
    playQuestionEnter();

    if (autoSpeakQuestion) {
      triggerSpeak();
    }
  };

  // Student selects an option
  const handleSelectOption = (index: number) => {
    if (screenState !== 'SHOW_QUESTION' || isLocking) return;
    setSelectedAnswer(index);
    playOptionSelectSound();
  };

  // Dramatic Answer Locking with Suspense Color-Cycling Effect
  const handleRevealAnswer = () => {
    if (isLocking || screenState !== 'SHOW_QUESTION') return;
    setIsLocking(true);
    stopSpeaking();
    setIsSpeaking(false);

    // Play heartbeat tension loop
    const stopTension = playDramaticLockingLoop();

    // 2.4-second dynamic color shifting across options
    let phase = 0;
    const interval = setInterval(() => {
      phase = (phase + 1) % 8;
      setLockingPhase(phase);
    }, 170);

    setTimeout(() => {
      clearInterval(interval);
      stopTension();
      setIsLocking(false);
      setScreenState('SHOW_ANSWER');

      const currentQ = questions[currentQIndex];
      const correctIdx = currentQ.correctAnswer;
      const correctLetter = String.fromCharCode(65 + correctIdx);
      const correctText = currentQ.options[correctIdx];

      if (selectedAnswer !== null) {
        if (selectedAnswer === correctIdx) {
          // CORRECT!
          playWinnerFanfare();
          playCorrectAnswerSound();
          triggerFullScreenFireworks(4200);

          setResultBanner({
            isCorrect: true,
            title: '🎉 XUẤT SẮC! CÂU TRẢ LỜI HOÀN TOÀN CHÍNH XÁC!',
            subtitle: `Chúc mừng ${selectedResult.displayText} đã trả lời đúng phương án ${correctLetter}: "${correctText}"!`,
          });

          const speech = buildMCCelebrationScript(selectedResult.displayText, correctLetter, correctText, currentQIndex);
          setIsSpeaking(true);
          speakQuestion(speech, {
            genderPreference: currentVoicePref,
            rate: 1.12,
            onStart: () => setIsSpeaking(true),
            onEnd: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          });
        } else {
          // WRONG!
          playWrongAnswerSound();
          const chosenLetter = String.fromCharCode(65 + selectedAnswer);
          const chosenText = currentQ.options[selectedAnswer];

          setResultBanner({
            isCorrect: false,
            title: '💡 BẠN CHỌN CHƯA ĐÚNG RỒI! ĐỪNG BUỒN NHÉ!',
            subtitle: `Bạn đã chọn phương án ${chosenLetter}: "${chosenText}". Đáp án đúng là phương án ${correctLetter}: "${correctText}". Bạn đã rất tự tin và cố gắng hết mình!`,
          });

          const speech = buildMCEncouragementScript(selectedResult.displayText, correctLetter, correctText, currentQIndex);
          setIsSpeaking(true);
          speakQuestion(speech, {
            genderPreference: currentVoicePref,
            rate: 1.10,
            onStart: () => setIsSpeaking(true),
            onEnd: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          });
        }
      } else {
        // Direct reveal when student didn't click
        playWinnerFanfare();
        playCorrectAnswerSound();
        triggerFullScreenFireworks(3500);
        setResultBanner({
          isCorrect: true,
          title: `✨ ĐÁP ÁN CHÍNH XÁC: PHƯƠNG ÁN ${correctLetter}`,
          subtitle: correctText,
        });

        const speech = `Và đáp án chính xác cho câu hỏi này là phương án ${correctLetter}: ${correctText}!`;
        setIsSpeaking(true);
        speakQuestion(speech, {
          genderPreference: currentVoicePref,
          rate: 1.12,
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      }
    }, 2400);
  };

  const triggerSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    const currentQ = questions[currentQIndex];
    if (!currentQ) return;

    // Charismatic MC Script for Question
    const speechText = buildMCQuestionScript(currentQIndex, currentQ.question, currentQ.options);

    setIsSpeaking(true);
    speakQuestion(speechText, {
      genderPreference: currentVoicePref,
      questionIndex: currentQIndex,
      rate: 1.12,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Stop speaking whenever leaving question screen
  useEffect(() => {
    if (screenState !== 'SHOW_QUESTION' && screenState !== 'SHOW_ANSWER') {
      stopSpeaking();
      stopFireworks();
      setIsSpeaking(false);
    }
  }, [screenState]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMutedState(next);
    setSoundMuted(next);
  };

  const currentQ = questions[currentQIndex];
  const isLastQuestion = currentQIndex >= questions.length - 1;

  // Determine current active voice label
  const getVoiceLabel = () => {
    switch (currentVoicePref) {
      case 'puck':
      case 'male':
        return 'MC Nam Hoạt Náo';
      case 'kore':
        return 'MC Nữ Tươi Sáng';
      case 'zephyr':
        return 'MC Nam Nhanh Nhẹn';
      case 'alternate':
        return (currentQIndex % 2 === 0 ? 'MC Nữ' : 'MC Nam') + ' (Xen kẽ)';
      case 'browser':
        return 'Giọng Trực Tiếp';
      case 'aoede':
      case 'female':
      case 'mc_energetic':
      default:
        return 'MC Nữ Thanh Thoát';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50/40 to-slate-100 text-slate-800 overflow-hidden flex flex-col justify-between relative font-sans select-none">
      {/* Top Navigation & Status Bar */}
      <header className="z-40 px-4 sm:px-8 py-3 flex items-center justify-between bg-white/85 backdrop-blur-xl border-b border-sky-100 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              stopSpeaking();
              onBack();
            }} 
            className="p-2.5 bg-white hover:bg-slate-100 rounded-2xl shadow-sm text-slate-600 transition flex items-center gap-1.5 border border-slate-200 text-xs font-bold"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Quay lại cấu hình</span>
          </button>

          {/* School Badge */}
          <SchoolBanner compact={true} />
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullScreen}
            className={`px-3 py-2 rounded-2xl transition flex items-center gap-1.5 border text-xs font-bold shadow-xs ${
              isFullScreen
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-amber-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300'
            }`}
            title={isFullScreen ? 'Thu nhỏ màn hình (phím F hoặc Esc)' : 'Hiển thị toàn màn hình (phím F)'}
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span className="hidden sm:inline">{isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>

          {/* Question Counter Pill */}
          <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 text-white font-black text-xs sm:text-sm tracking-wider shadow-sm uppercase">
            Câu {currentQIndex + 1} / {questions.length}
          </div>

          {/* Audio Mute/Unmute */}
          <button
            onClick={toggleMute}
            className={`p-2.5 rounded-2xl transition border ${
              isMuted 
                ? 'bg-rose-50 text-rose-600 border-rose-200' 
                : 'bg-white text-emerald-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      {/* Main Presentation Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative max-w-7xl w-full mx-auto">
        <AnimatePresence mode="wait">
          {/* STATE 1: IDLE - GAME SELECTION SCREEN (CHOOSE 1 OF 5 GAMES) */}
          {screenState === 'IDLE' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -40 }}
              className="text-center bg-white/90 backdrop-blur-2xl p-6 sm:p-10 rounded-[3rem] shadow-2xl border border-sky-100 max-w-4xl w-full"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-sky-100 text-sky-800 font-extrabold text-xs uppercase tracking-wider mb-2 border border-sky-200">
                <span>🏫</span> TRƯỜNG THPT VÕ THỊ SÁU
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600">
                Câu Hỏi Số {currentQIndex + 1}
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mb-8 font-semibold">
                Chọn một trong 5 trò chơi để tìm ra lớp và học sinh may mắn trả lời:
              </p>

              {/* 5 Minigames Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8">
                {/* 1. Vòng quay kỳ diệu */}
                <button
                  onClick={() => startMinigame('WHEEL')}
                  className="p-5 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-extrabold text-left transition transform hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-orange-300/50 flex flex-col justify-between h-36"
                >
                  <div className="text-3xl">🎡</div>
                  <div>
                    <div className="text-xl font-black">Vòng Quay Kỳ Diệu</div>
                    <div className="text-xs text-amber-100 font-medium mt-0.5">Quay số hồi hộp như Chiếc Nón Kỳ Diệu</div>
                  </div>
                </button>

                {/* 2. Quả Cầu May Mắn */}
                <button
                  onClick={() => startMinigame('VTS_BALLS')}
                  className="p-5 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-extrabold text-left transition transform hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-blue-300/50 flex flex-col justify-between h-36"
                >
                  <div className="text-3xl">🔮</div>
                  <div>
                    <div className="text-xl font-black">Quả Cầu May Mắn</div>
                    <div className="text-xs text-blue-100 font-medium mt-0.5">Các quả cầu phát sáng chuyển động & mở kết quả</div>
                  </div>
                </button>

                {/* 3. Máy Quay Số May Mắn */}
                <button
                  onClick={() => startMinigame('SLOT')}
                  className="p-5 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-extrabold text-left transition transform hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-purple-300/50 flex flex-col justify-between h-36"
                >
                  <div className="text-3xl">🎰</div>
                  <div>
                    <div className="text-xl font-black">Máy Cuộn Số 777</div>
                    <div className="text-xs text-purple-100 font-medium mt-0.5">3 trục số cuộn tốc độ cao cực cuốn hút</div>
                  </div>
                </button>

                {/* 4. Đua Tên Lửa VTS */}
                <button
                  onClick={() => startMinigame('ROCKET')}
                  className="p-5 rounded-3xl bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold text-left transition transform hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-red-300/50 flex flex-col justify-between h-36"
                >
                  <div className="text-3xl">🚀</div>
                  <div>
                    <div className="text-xl font-black">Tên Lửa Khám Phá</div>
                    <div className="text-xs text-rose-100 font-medium mt-0.5">3 tên lửa khối 10, 11, 12 tranh tài về đích</div>
                  </div>
                </button>

                {/* 5. Rương Kho Báu Bí Ẩn */}
                <button
                  onClick={() => startMinigame('CHEST')}
                  className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-left transition transform hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-emerald-300/50 flex flex-col justify-between h-36 sm:col-span-2 lg:col-span-1"
                >
                  <div className="text-3xl">🎁</div>
                  <div>
                    <div className="text-xl font-black">Rương Báu Tri Thức</div>
                    <div className="text-xs text-emerald-100 font-medium mt-0.5">Chọn rương phát sáng mở ra người may mắn</div>
                  </div>
                </button>
              </div>

              {/* Direct Jump Button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-center">
                <button
                  onClick={() => {
                    pickRandomPlayer();
                    setScreenState('ANNOUNCE_PLAYER');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-sky-700 underline flex items-center gap-1.5 transition"
                >
                  <Sparkles size={14} /> Bỏ qua minigame và chọn ngẫu nhiên ngay
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 2: ACTIVE MINIGAME PLAYING */}
          {screenState === 'MINIGAME' && (
            <motion.div
              key="minigame"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex justify-center"
            >
              {activeGame === 'WHEEL' && (
                <WheelOfFortune
                  candidateList={getAvailableClassNames()}
                  targetName={selectedResult.displayText}
                  onComplete={handleMinigameEnd}
                />
              )}
              {activeGame === 'VTS_BALLS' && (
                <LuckyBalls
                  targetName={selectedResult.displayText}
                  onComplete={handleMinigameEnd}
                />
              )}
              {activeGame === 'SLOT' && (
                <SlotMachine
                  candidateClasses={getAvailableClassNames()}
                  targetClass={selectedResult.className}
                  targetSTTorName={
                    selectedResult.studentName ||
                    (selectedResult.stt !== undefined
                      ? `STT ${selectedResult.stt < 10 ? '0' + selectedResult.stt : selectedResult.stt}`
                      : 'Học sinh may mắn')
                  }
                  onComplete={handleMinigameEnd}
                />
              )}
              {activeGame === 'ROCKET' && (
                <RocketRace
                  targetClass={selectedResult.className}
                  targetSTTorName={
                    selectedResult.studentName ||
                    (selectedResult.stt !== undefined
                      ? `STT ${selectedResult.stt < 10 ? '0' + selectedResult.stt : selectedResult.stt}`
                      : 'Học sinh may mắn')
                  }
                  onComplete={handleMinigameEnd}
                />
              )}
              {activeGame === 'CHEST' && (
                <MysteryChest
                  targetClass={selectedResult.className}
                  targetSTTorName={
                    selectedResult.studentName ||
                    (selectedResult.stt !== undefined
                      ? `STT ${selectedResult.stt < 10 ? '0' + selectedResult.stt : selectedResult.stt}`
                      : 'Học sinh may mắn')
                  }
                  onComplete={handleMinigameEnd}
                />
              )}
            </motion.div>
          )}

          {/* STATE 3: ANNOUNCE WINNER PLAYER BANNER */}
          {screenState === 'ANNOUNCE_PLAYER' && (
            <motion.div
              key="announce"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 p-8 sm:p-14 rounded-[3.5rem] shadow-2xl text-white max-w-3xl w-full border-4 border-amber-200"
            >
              <motion.div
                initial={{ rotate: -20, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 8 }}
                className="w-24 h-24 sm:w-28 sm:h-28 mx-auto bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center text-5xl sm:text-6xl mb-6 shadow-inner"
              >
                🎯
              </motion.div>

              <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-white/20 text-white font-black text-xs sm:text-sm uppercase tracking-widest mb-3 border border-white/30">
                NGƯỜI CHƠI MAY MẮN ĐÃ XUẤT HIỆN
              </div>

              <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight drop-shadow-md">
                {selectedResult.displayText}
              </h2>

              <p className="text-amber-100 text-sm sm:text-lg mb-8 font-medium">
                Xin mời bạn đứng lên chuẩn bị trả lời câu hỏi số {currentQIndex + 1}!
              </p>

              <button
                onClick={proceedToQuestion}
                className="px-8 sm:px-12 py-4 sm:py-5 bg-white text-orange-600 hover:bg-amber-50 rounded-3xl font-black text-xl sm:text-2xl shadow-xl transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mx-auto"
              >
                HIỂN THỊ CÂU HỎI <Play fill="currentColor" size={24} />
              </button>
            </motion.div>
          )}

          {/* STATE 4 & 5: SHOW QUESTION & SHOW ANSWER */}
          {(screenState === 'SHOW_QUESTION' || screenState === 'SHOW_ANSWER') && (
            <motion.div
              key="question_view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              {/* Question Banner - Expanded and Prominent */}
              <div className="relative bg-white/95 backdrop-blur-md border-4 border-sky-300 rounded-[2.5rem] p-6 sm:p-9 lg:p-10 mb-6 shadow-2xl flex flex-col justify-center min-h-[170px]">
                {/* School & Question Tag */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 text-xs sm:text-sm font-black uppercase tracking-wide border border-sky-200">
                      🏫 THPT Võ Thị Sáu
                    </span>
                    <span className="px-3.5 py-1.5 rounded-full bg-indigo-100 text-indigo-800 text-xs sm:text-sm font-black border border-indigo-200">
                      🎯 {selectedResult.displayText}
                    </span>
                  </div>

                  {/* AI Speech Control & Voice Selection */}
                  <div className="flex items-center gap-2">
                    <select
                      value={currentVoicePref}
                      onChange={(e) => {
                        stopSpeaking();
                        setCurrentVoicePref(e.target.value as VoiceGenderPreference);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 transition cursor-pointer focus:outline-none"
                      title="Chọn giọng đọc MC chương trình"
                    >
                      <option value="aoede">🎤 MC Nữ Thanh Thoát</option>
                      <option value="puck">🚀 MC Nam Hoạt Náo</option>
                      <option value="kore">👩 MC Nữ Tươi Sáng</option>
                      <option value="zephyr">⚡ MC Nam Nhanh Nhẹn</option>
                      <option value="alternate">🔄 MC Luân Phiên</option>
                      <option value="browser">🌐 Giọng Trực Tiếp</option>
                    </select>

                    <button
                      onClick={triggerSpeak}
                      className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition flex items-center gap-1.5 ${
                        isSpeaking
                          ? 'bg-rose-500 text-white border-rose-600 shadow-md animate-pulse'
                          : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 shadow-xs'
                      }`}
                    >
                      {isSpeaking ? <Square size={13} fill="currentColor" /> : <Volume2 size={15} />}
                      <span>{isSpeaking ? 'Dừng đọc' : 'Đọc câu hỏi'}</span>
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center leading-relaxed text-slate-900 px-2 sm:px-8">
                  {currentQ.question}
                </h3>
              </div>

              {/* Congratulation / Encouragement Announcement Banner */}
              {screenState === 'SHOW_ANSWER' && resultBanner && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`mb-6 p-4 sm:p-5 rounded-3xl shadow-xl border-2 text-white flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    resultBanner.isCorrect
                      ? 'bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 border-emerald-300'
                      : 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-700 border-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-4 text-center sm:text-left">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      {resultBanner.isCorrect ? '🎉' : '💡'}
                    </div>
                    <div>
                      <h4 className="text-base sm:text-xl font-black uppercase tracking-wide drop-shadow-sm">
                        {resultBanner.title}
                      </h4>
                      <p className="text-xs sm:text-sm font-medium opacity-95 mt-0.5">
                        {resultBanner.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {resultBanner.isCorrect && (
                      <button
                        onClick={() => triggerFullScreenFireworks(4000)}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-2xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md whitespace-nowrap active:scale-95"
                        title="Bắn pháo hoa rực rỡ toàn màn hình"
                      >
                        <Sparkles size={16} /> <span>Bắn pháo hoa 🎆</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const speech = resultBanner.isCorrect
                          ? buildMCCelebrationScript(selectedResult.displayText, String.fromCharCode(65 + currentQ.correctAnswer), currentQ.options[currentQ.correctAnswer], currentQIndex)
                          : buildMCEncouragementScript(selectedResult.displayText, String.fromCharCode(65 + currentQ.correctAnswer), currentQ.options[currentQ.correctAnswer], currentQIndex);
                        speakQuestion(speech, { genderPreference: currentVoicePref, rate: 1.12 });
                      }}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 border border-white/30 whitespace-nowrap"
                    >
                      <Volume2 size={16} /> <span>{resultBanner.isCorrect ? 'MC Chúc Mừng 🎤' : 'MC Động Viên 🎤'}</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 4 Options Grid - Fully Legible Without Truncation */}
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = currentQ.correctAnswer === i;
                  const isSelected = selectedAnswer === i;
                  const isAnswerRevealed = screenState === 'SHOW_ANSWER';

                  // Dynamic card appearance
                  let cardStyle = "";
                  let badgeStyle = "";
                  let statusTag: ReactNode = null;

                  if (isLocking) {
                    // SUSPENSE PHASE: 4 Options cycle dynamic thrilling gameshow colors!
                    const colorIndex = (i + lockingPhase) % 4;
                    if (colorIndex === 0) {
                      cardStyle = "bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-amber-300 shadow-xl scale-[1.02] ring-4 ring-amber-300/80";
                      badgeStyle = "bg-white text-amber-800";
                    } else if (colorIndex === 1) {
                      cardStyle = "bg-gradient-to-r from-sky-500 to-blue-600 text-white border-cyan-300 shadow-xl scale-[1.02] ring-4 ring-cyan-300/80";
                      badgeStyle = "bg-white text-blue-800";
                    } else if (colorIndex === 2) {
                      cardStyle = "bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-300 shadow-xl scale-[1.02] ring-4 ring-purple-300/80";
                      badgeStyle = "bg-white text-purple-800";
                    } else {
                      cardStyle = "bg-gradient-to-r from-rose-500 to-pink-600 text-white border-rose-300 shadow-xl scale-[1.02] ring-4 ring-rose-300/80";
                      badgeStyle = "bg-white text-rose-800";
                    }
                    statusTag = (
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest bg-white/25 px-2.5 py-1 rounded-full border border-white/40 animate-pulse">
                        Đang chốt...
                      </span>
                    );
                  } else if (isAnswerRevealed) {
                    // REVEALED PHASE
                    if (isCorrect) {
                      cardStyle = "bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 border-emerald-300 text-white shadow-[0_0_35px_rgba(34,197,94,0.65)] transform scale-[1.03] z-20 ring-4 ring-emerald-300 animate-pulse";
                      badgeStyle = "bg-white text-emerald-800 font-black";
                      statusTag = (
                        <span className="flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full border border-white/40 shadow-xs">
                          <CheckCircle2 size={18} /> ĐÁP ÁN ĐÚNG
                        </span>
                      );
                    } else if (isSelected) {
                      // Student chose this wrong answer!
                      cardStyle = "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 border-red-300 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)] transform scale-[1.01] ring-4 ring-red-300 z-10";
                      badgeStyle = "bg-white text-rose-800 font-black";
                      statusTag = (
                        <span className="flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full border border-white/40 shadow-xs">
                          <XCircle size={18} /> BẠN ĐÃ CHỌN (SAI)
                        </span>
                      );
                    } else {
                      cardStyle = "bg-slate-100/70 border-slate-200 text-slate-400 opacity-40 scale-[0.98]";
                      badgeStyle = "bg-slate-200 text-slate-400";
                    }
                  } else {
                    // QUESTION SELECTION PHASE
                    if (isSelected) {
                      cardStyle = "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-white border-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.6)] transform scale-[1.02] ring-4 ring-amber-300/80 z-20";
                      badgeStyle = "bg-white text-amber-800 font-black";
                      statusTag = (
                        <span className="flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-wider bg-white/25 px-3 py-1 rounded-full border border-white/40 shadow-sm animate-pulse">
                          🎯 BẠN ĐANG CHỌN
                        </span>
                      );
                    } else {
                      cardStyle = "bg-white border-2 border-sky-100 text-slate-800 hover:border-sky-300 hover:shadow-xl hover:scale-[1.015] cursor-pointer";
                      badgeStyle = "bg-sky-100 text-sky-800";
                    }
                  }

                  return (
                    <div
                      key={i}
                      onClick={() => handleSelectOption(i)}
                      className={`relative rounded-3xl border-4 p-5 sm:p-6 lg:p-7 min-h-[96px] flex items-center justify-between transition-all duration-300 shadow-md select-none ${cardStyle}`}
                    >
                      <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0 mr-3">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shrink-0 shadow-inner mt-0.5 ${badgeStyle}`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base sm:text-xl lg:text-2xl font-bold leading-relaxed break-words text-left">
                            {opt}
                          </div>
                        </div>
                      </div>

                      {statusTag && (
                        <div className="shrink-0 ml-2 self-center">
                          {statusTag}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Bar (Lock Answer / Next Question) */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl shadow-sm border border-sky-100">
                <div className="text-xs sm:text-sm font-bold text-slate-600">
                  {screenState === 'SHOW_QUESTION' ? (
                    isLocking ? (
                      <span className="text-amber-600 flex items-center gap-2 animate-pulse">
                        <Sparkles size={16} /> Đang hồi hộp chốt đáp án...
                      </span>
                    ) : selectedAnswer !== null ? (
                      <span className="text-blue-600 flex items-center gap-1.5 font-bold">
                        🎯 Đã chọn đáp án {String.fromCharCode(65 + selectedAnswer)}! Bấm &quot;CHỐT ĐÁP ÁN&quot; bên dưới:
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1.5">
                        👉 Click chọn một phương án A, B, C, D rồi bấm chốt đáp án:
                      </span>
                    )
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={16} /> Đã công bố kết quả câu hỏi!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {screenState === 'SHOW_QUESTION' ? (
                    <button
                      onClick={handleRevealAnswer}
                      disabled={isLocking}
                      className="px-8 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-black text-lg sm:text-xl flex items-center transition shadow-lg shadow-orange-300 transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      CHỐT ĐÁP ÁN <Play fill="currentColor" size={20} className="ml-2" />
                    </button>
                  ) : (
                    <>
                      {!isLastQuestion ? (
                        <button
                          onClick={() => {
                            stopSpeaking();
                            stopFireworks();
                            setCurrentQIndex((c) => c + 1);
                            setScreenState('IDLE');
                          }}
                          className="px-8 py-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-2xl font-black text-lg sm:text-xl flex items-center transition shadow-lg shadow-sky-300 transform hover:scale-105 active:scale-95"
                        >
                          CÂU TIẾP THEO <ArrowRight size={22} className="ml-2" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            stopSpeaking();
                            stopFireworks();
                            onBack();
                          }}
                          className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-lg sm:text-xl flex items-center transition shadow-lg shadow-emerald-300 transform hover:scale-105 active:scale-95"
                        >
                          KẾT THÚC BUỔI SINH HOẠT 🏆
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Required Footer Credit */}
      <footer className="py-2.5 text-center text-xs font-semibold text-slate-500 tracking-wide select-none z-30 shrink-0 border-t border-sky-100 bg-white/40 backdrop-blur-sm">
        Được phát triển bởi Thầy Trịnh Tuấn Kiệt
      </footer>
    </div>
  );
}
