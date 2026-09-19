export type VoiceGenderPreference = 
  | 'mc_energetic' 
  | 'female' 
  | 'male' 
  | 'alternate'
  | 'aoede'
  | 'puck'
  | 'kore'
  | 'zephyr'
  | 'browser';

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let hasUnlockedAudio = false;

// Cross-device audio unlocker ensuring audio plays on any other computer without autoplay restrictions
export function unlockAudio() {
  if (typeof window === 'undefined' || hasUnlockedAudio) return;
  try {
    const silentAudio = new Audio();
    // 1-sample silent WAV to unlock HTML5 audio on mobile/classroom computers
    silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      hasUnlockedAudio = true;
    }).catch(() => {});
  } catch {}
}

if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockAudio();
  };
  window.addEventListener('click', handleInteraction, { once: true, passive: true });
  window.addEventListener('keydown', handleInteraction, { once: true, passive: true });
  window.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
}

// Helper to find Vietnamese voices in Web Speech API
export function getVietnameseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('vi') ||
      v.name.toLowerCase().includes('vietnam') ||
      v.name.toLowerCase().includes('tiếng việt')
  );
}

export function stopSpeaking() {
  // 1. Stop audio element
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = '';
    currentAudio = null;
  }

  // 2. Stop speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export interface SpeakOptions {
  gender?: 'female' | 'male';
  questionIndex?: number;
  genderPreference?: VoiceGenderPreference;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

// Map preference to Gemini prebuilt voice name
export function resolveGeminiVoiceName(pref?: VoiceGenderPreference, qIndex: number = 0): string {
  switch (pref) {
    case 'puck':
    case 'male':
      return 'Puck'; // MC Nam Sôi Động, hào hứng
    case 'kore':
      return 'Kore'; // MC Nữ Tươi Sáng
    case 'zephyr':
      return 'Zephyr'; // MC Nam Nhanh Nhẹn, bản lĩnh
    case 'alternate':
      return qIndex % 2 === 0 ? 'Aoede' : 'Puck'; // Luân phiên
    case 'aoede':
    case 'female':
    case 'mc_energetic':
    default:
      return 'Aoede'; // MC Nữ Thanh Thoát, trong trẻo, tràn đầy năng lượng
  }
}

// Client-side in-memory audio pre-fetch cache for instantaneous (0ms) speech playback
const audioPreloadCache = new Map<string, HTMLAudioElement>();
const prefetchPendingKeys = new Set<string>();

export function clearAudioCache() {
  audioPreloadCache.forEach((audio) => {
    audio.pause();
    audio.src = '';
  });
  audioPreloadCache.clear();
  prefetchPendingKeys.clear();
}

/**
 * Pre-fetch TTS audio in the background before it is needed on screen.
 * Once pre-fetched, speakQuestion() will play instantly (0ms latency, truly simultaneous with visual updates).
 */
export async function prefetchSpeech(
  text: string,
  options: { genderPreference?: VoiceGenderPreference; questionIndex?: number; rate?: number } = {}
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || typeof window === 'undefined') return;

  const targetVoice = resolveGeminiVoiceName(options.genderPreference, options.questionIndex ?? 0);
  const cacheKey = `${targetVoice}:${trimmed}`;

  if (audioPreloadCache.has(cacheKey) || prefetchPendingKeys.has(cacheKey)) {
    return;
  }

  prefetchPendingKeys.add(cacheKey);

  try {
    const audioUrl = `/api/tts?text=${encodeURIComponent(trimmed)}&voice=${encodeURIComponent(targetVoice)}`;
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    audio.preload = 'auto';
    audio.playbackRate = options.rate ?? 1.12;

    // Load to ensure browser has decoded audio metadata
    audio.load();
    audioPreloadCache.set(cacheKey, audio);
  } catch (err) {
    console.debug('Background audio prefetch non-fatal error:', err);
  } finally {
    prefetchPendingKeys.delete(cacheKey);
  }
}

export function speakQuestion(text: string, options: SpeakOptions = {}) {
  stopSpeaking();

  const trimmed = text.trim();
  if (!trimmed) return;

  const targetVoice = resolveGeminiVoiceName(options.genderPreference, options.questionIndex ?? 0);
  const cacheKey = `${targetVoice}:${trimmed}`;

  // If user selected browser-only voice
  if (options.genderPreference === 'browser') {
    fallbackWebSpeech(trimmed, options);
    return;
  }

  // Primary High-Fidelity Native Vietnamese TTS (Instant playback if pre-fetched, or streaming fetch)
  try {
    let audio: HTMLAudioElement;

    if (audioPreloadCache.has(cacheKey)) {
      // 🚀 INSTANT 0ms ZERO-LATENCY PLAYBACK: Perfectly simultaneous with UI display!
      audio = audioPreloadCache.get(cacheKey)!;
      audio.currentTime = 0;
      audio.playbackRate = options.rate ?? 1.12;
    } else {
      const audioUrl = `/api/tts?text=${encodeURIComponent(trimmed)}&voice=${encodeURIComponent(targetVoice)}`;
      audio = new Audio(audioUrl);
      audio.playbackRate = options.rate ?? 1.12;
    }

    currentAudio = audio;

    let hasStarted = false;

    audio.onplay = () => {
      if (!hasStarted) {
        hasStarted = true;
        options.onStart?.();
      }
    };

    audio.onended = () => {
      currentAudio = null;
      options.onEnd?.();
    };

    audio.onerror = (e) => {
      console.warn('Backend TTS failed, checking local Vietnamese voice fallback...', e);
      currentAudio = null;
      fallbackWebSpeech(trimmed, options);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (!hasStarted) {
            hasStarted = true;
            options.onStart?.();
          }
        })
        .catch((err) => {
          console.warn('Audio play autoplay restricted or network error, attempting fallback:', err);
          fallbackWebSpeech(trimmed, options);
        });
    }
  } catch (err) {
    console.warn('Error starting audio playback:', err);
    fallbackWebSpeech(trimmed, options);
  }
}

// Fallback to Web Speech API with boosted rate & pitch for maximum clarity and cheerfulness
function fallbackWebSpeech(text: string, options: SpeakOptions) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.(new Error('TTS not available'));
    return;
  }

  const viVoices = getVietnameseVoices();
  if (viVoices.length === 0) {
    console.warn('No native Vietnamese voice installed on client OS.');
    options.onError?.(new Error('No Vietnamese voice found on system.'));
    return;
  }

  // Prefer high quality natural Vietnamese voices if available
  const preferredVoice = viVoices.find(v => 
    v.name.includes('Natural') || 
    v.name.includes('Online') || 
    v.name.includes('Google') || 
    v.name.includes('Linh')
  ) || viVoices[0];

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'vi-VN';
  utterance.voice = preferredVoice;
  utterance.rate = options.rate ?? 1.14; // Nhanh nhẹn, sôi nổi
  utterance.pitch = 1.12; // Cao hơn một chút giúp âm sắc thanh thoát, tươi vui

  if (options.onStart) utterance.onstart = () => options.onStart?.();
  if (options.onEnd) utterance.onend = () => options.onEnd?.();
  if (options.onError) utterance.onerror = (e) => options.onError?.(e);

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

// Helper to construct charismatic MC script for questions
export function buildMCQuestionScript(
  questionIndex: number,
  question: string,
  options: string[]
): string {
  const introPhrases = [
    `Kính mời quý thầy cô và các bạn cùng chú ý lên màn hình theo dõi câu hỏi số ${questionIndex + 1}!`,
    `Xin mời toàn trường cùng hướng mắt lên màn hình đón xem câu hỏi số ${questionIndex + 1}!`,
    `Và bây giờ, chúng ta cùng đến với câu hỏi số ${questionIndex + 1}!`,
  ];
  const intro = introPhrases[questionIndex % introPhrases.length];

  return (
    `${intro} ` +
    `${question}. ` +
    `Phương án A: ${options[0]}. ` +
    `Phương án B: ${options[1]}. ` +
    `Phương án C: ${options[2]}. ` +
    `Và phương án D: ${options[3]}. ` +
    `Xin mời học sinh đưa ra lựa chọn!`
  );
}

// Helper to construct celebratory MC script when student is correct
export function buildMCCelebrationScript(
  studentNameOrClass: string,
  optionLetter: string,
  optionContent: string,
  variant: number = 0
): string {
  const cheers = [
    `Hoan hô! Xin chúc mừng bạn đã xuất sắc trả lời hoàn toàn chính xác! Đáp án đúng chính là phương án ${optionLetter}: ${optionContent}! Cả trường hãy dành một tràng pháo tay thật giòn giã chúc mừng bạn nào!`,
    `Chính xác tuyệt đối! Xin chúc mừng bạn và tập thể lớp đã giành được điểm số với đáp án ${optionLetter}: ${optionContent}! Một tràng pháo tay thật lớn từ toàn trường nào!`,
    `Tuyệt vời! Một câu trả lời hoàn toàn chính xác! Phương án đúng là ${optionLetter}. Chúc mừng bạn đã hoàn thành xuất sắc thử thách!`,
  ];
  const idx = Math.abs(variant) % cheers.length;
  return cheers[idx];
}

// Helper to construct encouraging MC script when student is incorrect
export function buildMCEncouragementScript(
  studentNameOrClass: string,
  correctOptionLetter: string,
  correctOptionContent: string,
  variant: number = 0
): string {
  const encouragements = [
    `Rất tiếc! Câu trả lời vừa rồi chưa chính xác. Đáp án đúng của câu này là phương án ${correctOptionLetter}: ${correctOptionContent}. Nhưng không sao cả, bạn đã rất tự tin và nỗ lực hết mình! Cả trường hãy dành một tràng pháo tay thật lớn để động viên bạn nhé!`,
    `Ôi, tiếc quá! Lựa chọn vừa rồi chưa đúng rồi. Đáp án chính xác phải là phương án ${correctOptionLetter}: ${correctOptionContent}. Đừng buồn nhé, bạn đã rất dũng cảm tham gia! Hãy cùng vỗ tay thật lớn cổ vũ cho bạn nào!`,
    `Câu trả lời chưa đúng rồi! Đáp án chính xác là phương án ${correctOptionLetter}. Dù sao bạn cũng đã rất cố gắng và xuất sắc vượt qua vòng chọn ngẫu nhiên. Xin một tràng pháo tay động viên cho tinh thần tuyệt vời này!`,
  ];
  const idx = Math.abs(variant) % encouragements.length;
  return encouragements[idx];
}

