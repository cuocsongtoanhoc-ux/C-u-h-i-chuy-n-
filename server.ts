import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import mammoth from "mammoth";
import fs from "fs";
import https from "https";
import dotenv from "dotenv";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

dotenv.config();

const app = express();
const PORT = 3000;

// Multer setup for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

app.use(express.json({ limit: '50mb' }));

// Helper function to retry API calls
async function callGeminiWithRetry(fn: () => Promise<any>, maxRetries = 3, initialDelay = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 503 || error.status === 429) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`API busy, retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

app.post("/api/generate-questions", upload.single('file'), async (req, res) => {
  try {
    const prompt = req.body.prompt || "";
    const file = req.file;

    let parts: any[] = [];
    
    // Instruction for the AI model
    const instruction = `Tạo danh sách các câu hỏi trắc nghiệm dựa trên nội dung được cung cấp. 
Yêu cầu trả về mảng các câu hỏi, mỗi câu có 'question' (nội dung câu hỏi), 'options' (mảng 4 đáp án), và 'correctAnswer' (chỉ số của đáp án đúng từ 0 đến 3).`;

    parts.push({ text: instruction });
    if (prompt) {
      parts.push({ text: `Yêu cầu thêm từ người dùng: ${prompt}` });
    }

    if (file) {
      const mimeType = file.mimetype;
      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: file.buffer.toString('base64')
          }
        });
      } else if (file.originalname.endsWith('.docx')) {
        // Parse docx
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        parts.push({ text: `Nội dung tài liệu: ${result.value}` });
      } else if (file.originalname.endsWith('.doc')) {
        parts.push({ text: `Chưa hỗ trợ định dạng .doc trực tiếp, hãy thử .docx, .pdf hoặc copy text.` });
      } else if (mimeType.startsWith('text/')) {
        parts.push({ text: `Nội dung tài liệu: ${file.buffer.toString('utf-8')}` });
      }
    }

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              correctAnswer: { type: Type.INTEGER }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      }
    }));

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({ error: "Failed to generate questions." });
  }
});

// Helper for extracting readable text from legacy .doc or raw buffers
function extractTextFromBuffer(buffer: Buffer): string {
  try {
    const utf8Str = buffer.toString('utf8');
    const matches = utf8Str.match(/[\p{L}\p{N}\p{P}\p{Z}\r\n]{3,}/gu);
    if (matches && matches.length > 0) {
      return matches.join(' ');
    }
  } catch (e) {
    console.warn('Doc extract fallback error:', e);
  }
  return buffer.toString('utf8');
}

// Regex fallback for Vietnamese quiz question parsing
function serverParseFlexibleQuestions(rawText: string) {
  if (!rawText || !rawText.trim()) {
    return { questions: [], detectedCount: 0, standardText: '' };
  }

  const lines = rawText.split(/\r?\n/);
  const questions: Array<{ question: string; options: string[]; correctAnswer: number; explanation?: string }> = [];

  let curQuestionText = '';
  let curOptions: string[] = [];
  let curAnswerIndex = -1;
  let curExplanation = '';

  const finalizeCurrentQuestion = () => {
    if (!curQuestionText.trim()) return;

    let cleanText = curQuestionText
      .replace(/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+|\d+)[\.\:\)\-]?\s*/i, '')
      .trim();

    if (!cleanText) cleanText = curQuestionText.trim();

    if (curOptions.length >= 2) {
      while (curOptions.length < 4) {
        curOptions.push(`Phương án ${String.fromCharCode(65 + curOptions.length)}`);
      }
      const finalOptions = curOptions.slice(0, 4);
      const finalAns = curAnswerIndex >= 0 && curAnswerIndex < finalOptions.length ? curAnswerIndex : 0;

      questions.push({
        question: cleanText,
        options: finalOptions,
        correctAnswer: finalAns,
        explanation: curExplanation.trim() || undefined,
      });
    }

    curQuestionText = '';
    curOptions = [];
    curAnswerIndex = -1;
    curExplanation = '';
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+|\d+)[\.\:\)\-]?/i.test(trimmed)) {
      finalizeCurrentQuestion();
      curQuestionText = trimmed;
      continue;
    }

    const ansMatch = trimmed.match(/^(?:đáp\s*án(?:\s*đúng)?|đ\/a|đa|key|ans(?:wer)?|chọn)\s*[:\.]?\s*([A-D])/i);
    if (ansMatch) {
      curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(ansMatch[1].toUpperCase());
      continue;
    }

    const optMatch = trimmed.match(/^(\*?\s*[A-D]\*?|\([A-D]\)|\[[A-D]\])[\.\:\)\/]\s*(.*)$/i);
    if (optMatch) {
      const letter = optMatch[1].replace(/[\(\)\[\]\*\s]/g, '').toUpperCase();
      let optText = optMatch[2].trim();
      if (optMatch[1].includes('*') || optText.startsWith('*') || optText.endsWith('*')) {
        curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
        optText = optText.replace(/\*/g, '').trim();
      }
      curOptions.push(optText);
      continue;
    }

    if (curOptions.length > 0) {
      curOptions[curOptions.length - 1] += ' ' + trimmed;
    } else if (curQuestionText) {
      curQuestionText += ' ' + trimmed;
    } else {
      curQuestionText = trimmed;
    }
  }

  finalizeCurrentQuestion();

  const letters = ['A', 'B', 'C', 'D'];
  const standardText = questions
    .map((q, idx) => {
      const opts = q.options.map((opt, oIdx) => `${letters[oIdx]}. ${opt}`).join('\n');
      const ansChar = letters[q.correctAnswer] || 'A';
      return `Câu ${idx + 1}: ${q.question}\n${opts}\nĐáp án: ${ansChar}`;
    })
    .join('\n\n');

  return { questions, detectedCount: questions.length, standardText };
}

// Dedicated AI Endpoint to normalize messy questions, unformatted text, or uploaded files (.doc, .docx, .pdf, images)
app.post("/api/normalize-questions", upload.single('file'), async (req, res) => {
  try {
    let rawText = req.body.rawText || "";
    const file = req.file;
    const fileBase64 = req.body.fileBase64;
    const fileName = req.body.fileName || (file ? file.originalname : "");
    const fileMimeType = req.body.fileMimeType || (file ? file.mimetype : "");

    if (!rawText && !file && !fileBase64) {
      return res.status(400).json({ error: "Vui lòng dán văn bản hoặc tải lên tệp tài liệu câu hỏi." });
    }

    let parts: any[] = [];
    const systemPrompt = `Bạn là trợ lý AI chuyên nghiệp về xử lý và chuẩn hóa đề thi trắc nghiệm tiếng Việt dành cho chương trình sinh hoạt dưới cờ trường THPT Võ Thị Sáu.
Nhiệm vụ của bạn:
1. Đọc và phân tích kỹ văn bản hoặc tài liệu đính kèm (có thể là câu hỏi chưa đúng định dạng chuẩn, trích từ Word .doc/.docx, PDF đề thi, hoặc ảnh chụp tài liệu/sách).
2. Tách và chuẩn hóa TOÀN BỘ các câu hỏi trắc nghiệm sang định dạng CHUẨN XÁC bắt buộc của ứng dụng:

Câu [Số thứ tự]: [Nội dung câu hỏi đầy đủ, sửa lỗi chính tả/gõ vần nếu có]
A. [Nội dung phương án A]
B. [Nội dung phương án B]
C. [Nội dung phương án C]
D. [Nội dung phương án D]
Đáp án: [A hoặc B hoặc C hoặc D]

Ví dụ chuẩn mẫu:
Câu 1: Nữ anh hùng liệt sĩ Võ Thị Sáu sinh năm bao nhiêu?
A. 1930
B. 1933
C. 1935
D. 1940
Đáp án: B

Quy tắc chuẩn hóa nghiêm ngặt:
- Mỗi câu hỏi BẮT BUỘC có đủ 4 phương án A, B, C, D (nếu đề gốc chỉ có 2-3 phương án, hãy tự động tạo thêm các phương án gây nhiễu hợp lý để đủ 4 lựa chọn).
- Dòng 'Đáp án: X' là bắt buộc. Nếu đề có sẵn đáp án (khoanh tròn, gạch chân, hoặc có bảng đáp án), hãy trích đúng đáp án đó. Nếu đề chưa có đáp án, hãy suy luận đáp án chính xác nhất để điền vào.
- Giữa các câu cách nhau 1 dòng trống.
- Trả về định dạng JSON gồm:
  + "standardText": chuỗi văn bản hoàn chỉnh đã chuẩn hóa (để người dùng có thể copy hoặc dán trực tiếp vào ô soạn thảo).
  + "questions": mảng các câu hỏi [{ "question": string, "options": string[4], "correctAnswer": number (0-3), "explanation": string }].
  + "detectedCount": tổng số câu hỏi tìm thấy.`;

    parts.push({ text: systemPrompt });

    if (rawText) {
      parts.push({ text: `VĂN BẢN CẦN CHUẨN HÓA DO NGƯỜI DÙNG CUNG CẤP:\n${rawText}` });
    }

    if (file) {
      const mimeType = file.mimetype;
      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: file.buffer.toString('base64')
          }
        });
      } else if (file.originalname.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        parts.push({ text: `NỘI DUNG TỪ TỆP WORD (.docx):\n${result.value}` });
        if (!rawText) rawText = result.value;
      } else if (file.originalname.toLowerCase().endsWith('.doc')) {
        const docText = extractTextFromBuffer(file.buffer);
        parts.push({ text: `NỘI DUNG TỪ TỆP WORD (.doc):\n${docText}` });
        if (!rawText) rawText = docText;
      } else if (mimeType.startsWith('text/')) {
        const txt = file.buffer.toString('utf-8');
        parts.push({ text: `NỘI DUNG TỪ TỆP VĂN BẢN:\n${txt}` });
        if (!rawText) rawText = txt;
      } else {
        const txt = file.buffer.toString('utf-8');
        parts.push({ text: `NỘI DUNG TỆP:\n${txt}` });
        if (!rawText) rawText = txt;
      }
    } else if (fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');
      const lowerName = fileName.toLowerCase();
      if (fileMimeType === 'application/pdf' || fileMimeType.startsWith('image/')) {
        parts.push({
          inlineData: {
            mimeType: fileMimeType,
            data: fileBase64
          }
        });
      } else if (lowerName.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        parts.push({ text: `NỘI DUNG TỪ TỆP WORD (.docx):\n${result.value}` });
        if (!rawText) rawText = result.value;
      } else {
        const txt = buffer.toString('utf-8');
        parts.push({ text: `NỘI DUNG TỆP:\n${txt}` });
        if (!rawText) rawText = txt;
      }
    }

    try {
      const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              standardText: { type: Type.STRING },
              detectedCount: { type: Type.INTEGER },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING } 
                    },
                    correctAnswer: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctAnswer"]
                }
              }
            },
            required: ["standardText", "questions", "detectedCount"]
          }
        }
      }));

      const parsedResult = JSON.parse(response.text);
      return res.json(parsedResult);
    } catch (aiError) {
      console.warn("Gemini normalize warning, using regex fallback:", aiError);
      if (rawText) {
        const fallback = serverParseFlexibleQuestions(rawText);
        if (fallback.questions.length > 0) {
          return res.json(fallback);
        }
      }
      throw aiError;
    }
  } catch (error: any) {
    console.error("Error normalizing questions:", error);
    res.status(500).json({ error: error.message || "Không thể chuẩn hóa câu hỏi bằng AI." });
  }
});

// In-memory cache for synthesized TTS audio (speeds up repeat questions and MC feedback to 0ms)
const ttsAudioCache = new Map<string, { buffer: Buffer; mimeType: string }>();
const ttsInFlightPromises = new Map<string, Promise<{ buffer: Buffer; mimeType: string } | null>>();
let geminiTtsCooldownUntil = 0;

// Helper to convert Linear16 PCM (24000Hz mono) to standard WAV format playable in all browsers
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
  header.writeUInt16LE(1, 20); // 1 = PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

// Generate lively energetic Vietnamese speech via Gemini TTS
async function generateGeminiSpeech(text: string, voiceName = 'Aoede'): Promise<Buffer | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  if (Date.now() < geminiTtsCooldownUntil) {
    // In cooldown due to rate-limit / 429 quota exhaustion. Silently use Google TTS fallback.
    return null;
  }

  try {
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
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
      geminiTtsCooldownUntil = Date.now() + 10 * 60 * 1000;
      console.log('[TTS] Gemini TTS free-tier quota reached (429). Seamlessly using Google TTS audio fallback.');
    } else {
      console.warn('[TTS] Gemini TTS notice (activating fallback):', errMsg);
    }
    return null;
  }
}

// Helper to fetch audio from Google TTS in Vietnamese (fallback)
function fetchGoogleTTSChunk(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(text)}`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`TTS failed with HTTP status ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('TTS request timed out'));
    });
  });
}

// Split long text into chunks <= 180 chars along sentences / clauses
function splitTextForTTS(text: string, maxLen = 180): string[] {
  const clean = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return [clean];

  const sentences = clean.split(/(?<=[.?!:;,])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        const words = s.split(' ');
        current = '';
        for (const w of words) {
          if ((current + ' ' + w).trim().length <= maxLen) {
            current = (current + ' ' + w).trim();
          } else {
            if (current) chunks.push(current);
            current = w;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

// 2. High-fidelity Neural Edge TTS (HoaiMy & NamMinh Neural) - Extremely lively, natural MC intonation, 0 API key required!
async function generateEdgeSpeech(text: string, voiceName = 'Aoede'): Promise<Buffer | null> {
  try {
    const isMale = voiceName === 'Puck' || voiceName === 'Zephyr';
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
    console.warn('[Server TTS] Edge TTS notice (trying fallback):', err);
    return null;
  }
}

// Vietnamese Text-To-Speech Endpoint (High-fidelity, energetic MC delivery)
app.get("/api/tts", async (req, res) => {
  try {
    const text = ((req.query.text as string) || "").trim();
    const voice = (req.query.voice as string) || "Aoede";
    if (!text) {
      return res.status(400).send("Text parameter is required");
    }

    const cacheKey = `${voice}:${text}`;
    const cached = ttsAudioCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', cached.buffer.length.toString());
      return res.send(cached.buffer);
    }

    // Check if another request for the same audio is currently in flight
    let inFlight = ttsInFlightPromises.get(cacheKey);
    if (!inFlight) {
      inFlight = (async () => {
        try {
          // 1. Primary: High-fidelity Gemini AI TTS
          const geminiWav = await generateGeminiSpeech(text, voice);
          if (geminiWav) {
            const entry = { buffer: geminiWav, mimeType: 'audio/wav' };
            ttsAudioCache.set(cacheKey, entry);
            return entry;
          }

          // 2. High-fidelity Neural Edge TTS (HoaiMy / NamMinh Neural)
          const edgeAudio = await generateEdgeSpeech(text, voice);
          if (edgeAudio) {
            const entry = { buffer: edgeAudio, mimeType: 'audio/mpeg' };
            ttsAudioCache.set(cacheKey, entry);
            return entry;
          }

          // 3. Secondary fallback: Google TTS chunks
          try {
            const chunks = splitTextForTTS(text);
            const audioBuffers: Buffer[] = [];
            for (const chunk of chunks) {
              const buf = await fetchGoogleTTSChunk(chunk);
              audioBuffers.push(buf);
            }
            if (audioBuffers.length > 0) {
              const combined = Buffer.concat(audioBuffers);
              const entry = { buffer: combined, mimeType: 'audio/mpeg' };
              ttsAudioCache.set(cacheKey, entry);
              return entry;
            }
          } catch (gErr: any) {
            console.warn('[TTS] Google TTS chunk fallback warning:', gErr?.message || gErr);
          }
          return null;
        } finally {
          ttsInFlightPromises.delete(cacheKey);
        }
      })();
      ttsInFlightPromises.set(cacheKey, inFlight);
    }

    const result = await inFlight;
    if (result) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', result.buffer.length.toString());
      return res.send(result.buffer);
    }

    res.status(500).json({ error: "Failed to synthesize Vietnamese audio." });
  } catch (error) {
    console.error("TTS endpoint error:", error);
    res.status(500).json({ error: "Failed to synthesize Vietnamese audio." });
  }
});

// Cloud Sync In-Memory / File Persistent Store for cross-device synchronization
const cloudSyncStore = new Map<string, any>();
const CLOUD_SYNC_DIR = path.join(process.cwd(), '.sync_data');
try {
  if (!fs.existsSync(CLOUD_SYNC_DIR)) {
    fs.mkdirSync(CLOUD_SYNC_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Sync dir notice:', e);
}

app.post("/api/cloud-sync/save", (req, res) => {
  try {
    const { syncKey, sessions, activeSession } = req.body;
    if (!syncKey || !sessions) {
      return res.status(400).json({ error: "syncKey and sessions are required." });
    }

    const cleanKey = String(syncKey).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    const payload = {
      syncKey: cleanKey,
      updatedAt: Date.now(),
      sessions,
      activeSession
    };

    cloudSyncStore.set(cleanKey, payload);
    cloudSyncStore.set('latest_school_session', payload);

    try {
      const filePath = path.join(CLOUD_SYNC_DIR, `${cleanKey}.json`);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      fs.writeFileSync(path.join(CLOUD_SYNC_DIR, 'latest.json'), JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Local backup write notice:', err);
    }

    res.json({ success: true, syncKey: cleanKey, message: "Đã lưu trữ dữ liệu đồng bộ đám mây thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save cloud sync data." });
  }
});

app.get("/api/cloud-sync/load/:syncKey", (req, res) => {
  try {
    const syncKey = String(req.params.syncKey).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    let data = cloudSyncStore.get(syncKey);

    if (!data) {
      const filePath = path.join(CLOUD_SYNC_DIR, `${syncKey}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(raw);
        cloudSyncStore.set(syncKey, data);
      }
    }

    if (!data) {
      return res.status(404).json({ error: "Không tìm thấy dữ liệu đồng bộ với mã này." });
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load cloud sync data." });
  }
});

app.get("/api/cloud-sync/latest", (req, res) => {
  try {
    let data = cloudSyncStore.get('latest_school_session');
    if (!data) {
      const filePath = path.join(CLOUD_SYNC_DIR, 'latest.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(raw);
      }
    }

    if (!data) {
      return res.status(404).json({ error: "Chưa có dữ liệu đồng bộ nào trên đám mây." });
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load latest sync data." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
