import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// In-memory cache for synthesized audio
const ttsAudioCache = new Map<string, { buffer: Buffer; mimeType: string }>();
let geminiTtsCooldownUntil = 0;

// Convert PCM linear16 24000Hz mono to standard playable WAV buffer
function pcmToWav(pcmData: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

// 1. Generate lively energetic Vietnamese speech via Gemini TTS (when API key is present)
async function generateGeminiSpeech(text: string, voiceName = 'Aoede'): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (Date.now() < geminiTtsCooldownUntil) return null;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const validVoices = ['Aoede', 'Puck', 'Kore', 'Zephyr'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Aoede';

    let promptText = '';
    if (chosenVoice === 'Aoede') {
      promptText = `Đọc bằng giọng nữ tiếng Việt truyền cảm, thanh thoát, sôi động, tươi vui, tốc độ nhanh nhẹn, phong cách MC dẫn gameshow trường học hào hứng, dứt khoát: ${text.trim()}`;
    } else if (chosenVoice === 'Kore') {
      promptText = `Đọc bằng giọng nữ tiếng Việt trẻ trung, hoạt bát, tươi sáng, rạng rỡ, tốc độ nhanh nhẹn, dứt khoát, phong cách MC sân khấu sôi nổi: ${text.trim()}`;
    } else if (chosenVoice === 'Puck') {
      promptText = `Đọc bằng giọng nam tiếng Việt hào sảng, sôi động, hoạt náo, vang rền, tốc độ nhanh nhẹn, phong cách MC gameshow trường học đầy nhiệt huyết: ${text.trim()}`;
    } else {
      promptText = `Đọc bằng giọng nam tiếng Việt thanh niên nhanh nhẹn, dứt khoát, phong độ, nhiệt huyết, tràn đầy năng lượng: ${text.trim()}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Data) return null;

    const pcmBuffer = Buffer.from(base64Data, 'base64');
    return pcmToWav(pcmBuffer, 24000, 1, 16);
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded')) {
      geminiTtsCooldownUntil = Date.now() + 10 * 60 * 1000;
      console.log('[Vercel TTS] Gemini TTS 429 quota reached, switching to Neural Edge TTS.');
    } else {
      console.warn('[Vercel TTS] Gemini TTS notice:', errMsg);
    }
    return null;
  }
}

// 2. High-fidelity Neural Edge TTS (HoaiMy & NamMinh Neural) - Extremely lively, natural MC intonation, 0 API key required!
async function generateEdgeSpeech(text: string, voiceName = 'Aoede'): Promise<Buffer | null> {
  try {
    const isMale = ['puck', 'zephyr', 'male'].includes(voiceName.toLowerCase());
    // 100% Native Vietnamese Voices: NamMinh (Male MC) and HoaiMy (Female MC)
    const edgeVoice = isMale ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
    const tts = new MsEdgeTTS();
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Clean formatting markers
    const cleanText = text.replace(/[*#_`]/g, '').trim();
    if (!cleanText) return null;

    const { audioStream } = tts.toStream(cleanText, { rate: '+18%', pitch: '+4Hz' });

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timeout = setTimeout(() => {
        reject(new Error('Edge TTS stream timeout'));
      }, 7000);

      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', (err: any) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (err) {
    console.warn('[Vercel TTS] Edge TTS notice (trying fallback):', err);
    return null;
  }
}

function splitTextForTTS(text: string, maxLen = 140): string[] {
  const clean = text.replace(/\s+/g, ' ').replace(/[\r\n]+/g, '. ').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const regex = /([.?!:;,]+|\n)/;
  const rawParts = clean.split(regex);
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
  return chunks.filter((c) => c.length > 0);
}

async function fetchGoogleTTSChunk(chunk: string): Promise<Buffer> {
  const encoded = encodeURIComponent(chunk);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encoded}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Referer: 'https://translate.google.com/',
    },
  });
  if (!resp.ok) throw new Error(`Google TTS HTTP ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
  res: ServerResponse
) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const text = (url.searchParams.get('text') || '').trim();
    const voice = (url.searchParams.get('voice') || 'Aoede').trim();

    if (!text) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Text query parameter is required' }));
      return;
    }

    const cacheKey = `${voice}:${text}`;
    const cached = ttsAudioCache.get(cacheKey);
    if (cached) {
      res.statusCode = 200;
      res.setHeader('Content-Type', cached.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('Content-Length', cached.buffer.length.toString());
      res.end(cached.buffer);
      return;
    }

    const isMale = ['puck', 'zephyr', 'male'].includes(voice.toLowerCase());

    // For male voice: Always prioritize NamMinhNeural (100% native Vietnamese Male MC voice, zero English persona)
    if (isMale) {
      const edgeAudio = await generateEdgeSpeech(text, voice);
      if (edgeAudio) {
        const entry = { buffer: edgeAudio, mimeType: 'audio/mpeg' };
        ttsAudioCache.set(cacheKey, entry);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.setHeader('Content-Length', edgeAudio.length.toString());
        res.end(edgeAudio);
        return;
      }
    }

    // 1. High-fidelity Gemini Studio AI TTS (Aoede, Kore, etc.)
    const geminiWav = await generateGeminiSpeech(text, voice);
    if (geminiWav) {
      const entry = { buffer: geminiWav, mimeType: 'audio/wav' };
      ttsAudioCache.set(cacheKey, entry);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('Content-Length', geminiWav.length.toString());
      res.end(geminiWav);
      return;
    }

    // 2. High-Fidelity Neural MC Voices (HoaiMy / NamMinh Neural) - Lively, energetic MC tone
    const edgeAudio = await generateEdgeSpeech(text, voice);
    if (edgeAudio) {
      const entry = { buffer: edgeAudio, mimeType: 'audio/mpeg' };
      ttsAudioCache.set(cacheKey, entry);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('Content-Length', edgeAudio.length.toString());
      res.end(edgeAudio);
      return;
    }

    // 3. Last-resort fallback: Google TTS chunks
    const chunks = splitTextForTTS(text);
    const audioBuffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await fetchGoogleTTSChunk(chunk);
      audioBuffers.push(buf);
    }

    if (audioBuffers.length === 0) {
      res.statusCode = 500;
      res.end('Failed to synthesize audio');
      return;
    }

    const combined = Buffer.concat(audioBuffers);
    const entry = { buffer: combined, mimeType: 'audio/mpeg' };
    ttsAudioCache.set(cacheKey, entry);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Length', combined.length.toString());
    res.end(combined);
  } catch (err: any) {
    console.error('[TTS Handler Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'TTS generation error' }));
  }
}
