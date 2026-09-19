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

// Audio queue state for client-side streaming Google TTS
interface ClientAudioQueue {
  chunks: string[];
  currentIndex: number;
  options: SpeakOptions;
  isCancelled: boolean;
  activeAudio: HTMLAudioElement | null;
}
let activeClientQueue: ClientAudioQueue | null = null;

// Cross-device audio unlocker ensuring audio plays on any other computer without autoplay restrictions
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    const silentAudio = new Audio();
    // 1-sample silent WAV to unlock HTML5 audio on mobile/classroom computers
    silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      hasUnlockedAudio = true;
    }).catch(() => {});

    // Also unlock Web Audio AudioContext if available
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
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

// Helper to find Vietnamese voices in Web Speech API with natural/neural voices prioritized
export function getVietnameseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  // STRICT: Only voices whose language tag is explicitly Vietnamese (vi, vi-VN, vi_VN)
  // NEVER match English voices that might contain "Vietnam" in their text/descriptions
  const viVoices = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    return lang === 'vi' || lang.startsWith('vi-');
  });

  // Sort natural/neural voices first (e.g. Microsoft HoaiMy Online, Google Tiếng Việt)
  return viVoices.sort((a, b) => {
    const aScore = (a.name.includes('Natural') ? 10 : 0) + (a.name.includes('Online') ? 5 : 0) + (a.name.includes('Google') ? 3 : 0);
    const bScore = (b.name.includes('Natural') ? 10 : 0) + (b.name.includes('Online') ? 5 : 0) + (b.name.includes('Google') ? 3 : 0);
    return bScore - aScore;
  });
}

export function stopSpeaking() {
  // 1. Cancel active client TTS queue
  if (activeClientQueue) {
    activeClientQueue.isCancelled = true;
    if (activeClientQueue.activeAudio) {
      activeClientQueue.activeAudio.pause();
      activeClientQueue.activeAudio.src = '';
    }
    activeClientQueue = null;
  }

  // 2. Stop audio element
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = '';
    currentAudio = null;
  }

  // 3. Stop speech synthesis
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
 * Split text into natural Vietnamese sentence chunks <= 90 chars
 * so public Google TTS audio stream plays without length limit or 400 error.
 */
function splitTextForClientTTS(text: string, maxLen = 90): string[] {
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '. ')
    .trim();

  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  // Split on punctuation delimiters
  const rawParts = clean.split(/([.?!:;,]+|\n)/);
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i].trim();
    if (!part) continue;

    if ((current + ' ' + part).trim().length <= maxLen) {
      current = (current + ' ' + part).trim();
    } else {
      if (current) chunks.push(current);
      if (part.length <= maxLen) {
        current = part;
      } else {
        // Fallback: split words if single clause is longer than maxLen
        const words = part.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(c => c.length > 0);
}

/**
 * High reliability client-side Google Vietnamese TTS audio stream player.
 * Works on any hosting (Vercel static, GitHub Pages, Netlify) without backend server or local OS voice pack!
 */
function playClientGoogleTTS(text: string, options: SpeakOptions) {
  const chunks = splitTextForClientTTS(text);
  if (chunks.length === 0) {
    options.onEnd?.();
    return;
  }

  const queue: ClientAudioQueue = {
    chunks,
    currentIndex: 0,
    options,
    isCancelled: false,
    activeAudio: null,
  };
  activeClientQueue = queue;

  function playNext() {
    if (!activeClientQueue || activeClientQueue.isCancelled) return;

    if (activeClientQueue.currentIndex >= activeClientQueue.chunks.length) {
      const onEnd = activeClientQueue.options.onEnd;
      activeClientQueue = null;
      currentAudio = null;
      onEnd?.();
      return;
    }

    const chunkText = activeClientQueue.chunks[activeClientQueue.currentIndex];
    const streamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunkText)}`;
    
    const audio = new Audio(streamUrl);
    audio.playbackRate = activeClientQueue.options.rate ?? 1.25;
    activeClientQueue.activeAudio = audio;
    currentAudio = audio;

    // Preload the next chunk in parallel for seamless playback
    if (activeClientQueue.currentIndex + 1 < activeClientQueue.chunks.length) {
      const nextText = activeClientQueue.chunks[activeClientQueue.currentIndex + 1];
      const nextUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(nextText)}`;
      const nextAudio = new Audio(nextUrl);
      nextAudio.preload = 'auto';
    }

    audio.onplay = () => {
      if (activeClientQueue && activeClientQueue.currentIndex === 0) {
        activeClientQueue.options.onStart?.();
      }
    };

    audio.onended = () => {
      if (!activeClientQueue || activeClientQueue.isCancelled) return;
      activeClientQueue.currentIndex++;
      playNext();
    };

    audio.onerror = (e) => {
      console.warn('Client Google TTS chunk stream notice, using Web Speech synthesis:', e);
      if (activeClientQueue && !activeClientQueue.isCancelled) {
        const remaining = activeClientQueue.chunks.slice(activeClientQueue.currentIndex).join(' ');
        const opts = activeClientQueue.options;
        activeClientQueue = null;
        fallbackWebSpeech(remaining, opts);
      }
    };

    audio.play().catch((err) => {
      console.warn('Direct audio playback notice:', err);
      if (activeClientQueue && !activeClientQueue.isCancelled) {
        const remaining = activeClientQueue.chunks.slice(activeClientQueue.currentIndex).join(' ');
        const opts = activeClientQueue.options;
        activeClientQueue = null;
        fallbackWebSpeech(remaining, opts);
      }
    });
  }

  playNext();
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
    // Validate that response is valid audio, not an HTML error page
    if (blob.type.includes('html')) {
      throw new Error('Received HTML instead of audio from /api/tts');
    }

    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    audio.preload = 'auto';
    audio.playbackRate = options.rate ?? 1.22;

    // Load to ensure browser has decoded audio metadata
    audio.load();
    audioPreloadCache.set(cacheKey, audio);
  } catch (err) {
    console.debug('Background audio prefetch notice:', err);
  } finally {
    prefetchPendingKeys.delete(cacheKey);
  }
}

export function speakQuestion(text: string, options: SpeakOptions = {}) {
  stopSpeaking();
  unlockAudio();

  const trimmed = text.trim();
  if (!trimmed) return;

  // If user explicitly selected browser-only voice
  if (options.genderPreference === 'browser') {
    fallbackWebSpeech(trimmed, options);
    return;
  }

  const targetVoice = resolveGeminiVoiceName(options.genderPreference, options.questionIndex ?? 0);
  const cacheKey = `${targetVoice}:${trimmed}`;

  const handleAudioFailure = () => {
    currentAudio = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && getVietnameseVoices().length > 0) {
      fallbackWebSpeech(trimmed, options);
    } else {
      playClientGoogleTTS(trimmed, options);
    }
  };

  // 1. Check if high-fidelity backend audio was already pre-fetched
  if (audioPreloadCache.has(cacheKey)) {
    const audio = audioPreloadCache.get(cacheKey)!;
    audio.currentTime = 0;
    audio.playbackRate = options.rate ?? 1.08;
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
    audio.onerror = () => {
      handleAudioFailure();
    };

    audio.play().catch(() => {
      handleAudioFailure();
    });
    return;
  }

  // 2. Try fetching from backend /api/tts with rapid fallback to client Google TTS
  try {
    const audioUrl = `/api/tts?text=${encodeURIComponent(trimmed)}&voice=${encodeURIComponent(targetVoice)}`;
    const audio = new Audio(audioUrl);
    audio.playbackRate = options.rate ?? 1.08;
    currentAudio = audio;

    let hasStarted = false;
    let hasFailed = false;

    const switchToClientTTS = () => {
      if (hasFailed) return;
      hasFailed = true;
      if (currentAudio === audio) {
        audio.pause();
        audio.src = '';
        currentAudio = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && getVietnameseVoices().length > 0) {
        fallbackWebSpeech(trimmed, options);
      } else {
        playClientGoogleTTS(trimmed, options);
      }
    };

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

    audio.onerror = () => {
      // Backend /api/tts error -> Seamlessly switch to Client Google TTS!
      switchToClientTTS();
    };

    // Allow 4.5s for web serverless cold-start before switching to client fallback
    const timeoutId = setTimeout(() => {
      if (!hasStarted && !hasFailed && currentAudio === audio) {
        console.log('[TTS] Serverless cold-start taking >4.5s on web, switching to fast client TTS...');
        switchToClientTTS();
      }
    }, 4500);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          clearTimeout(timeoutId);
          if (!hasStarted) {
            hasStarted = true;
            options.onStart?.();
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
          switchToClientTTS();
        });
    }
  } catch {
    playClientGoogleTTS(trimmed, options);
  }
}

// Fallback to Web Speech API with boosted rate & pitch for maximum clarity and cheerfulness
function fallbackWebSpeech(text: string, options: SpeakOptions) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    playClientGoogleTTS(text, options);
    return;
  }

  const viVoices = getVietnameseVoices();
  // CRITICAL: If the client OS/browser does not have a native Vietnamese voice installed,
  // NEVER call window.speechSynthesis.speak() because Windows/Chrome will default to English voices (e.g. Microsoft David)!
  if (viVoices.length === 0) {
    console.warn('[TTS] No native Vietnamese voice found in browser. Falling back to guaranteed Vietnamese audio.');
    playClientGoogleTTS(text, options);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'vi-VN';

  const isMale = options.genderPreference === 'male' || options.genderPreference === 'puck' || options.genderPreference === 'zephyr';

  let chosenVoice: SpeechSynthesisVoice | undefined;
  if (isMale) {
    chosenVoice = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('namminh') || n.includes('nam') || (n.includes('male') && !n.includes('female'));
    });
  } else {
    chosenVoice = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('hoaimy') || n.includes('female') || n.includes('linh') || n.includes('nu');
    });
  }

  // Must select strictly from viVoices (which is verified Vietnamese).
  // If male requested but no male Vietnamese voice exists on this computer, use viVoices[0] (Vietnamese female voice)
  // NEVER let the browser pick an English male voice!
  utterance.voice = chosenVoice || viVoices[0];

  utterance.rate = options.rate ?? 1.22; // Nhanh nhẹn, sôi nổi, phong cách MC
  utterance.pitch = 1.08; // Cao hơn một chút giúp âm sắc thanh thoát, tươi vui

  if (options.onStart) utterance.onstart = () => options.onStart?.();
  if (options.onEnd) utterance.onend = () => options.onEnd?.();
  if (options.onError) utterance.onerror = (e) => {
    // If WebSpeech fails mid-stream, fallback safely to client Google TTS
    playClientGoogleTTS(text, options);
  };

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

