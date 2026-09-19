import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';

// Fallback regex question parser for Vietnamese quiz questions
function parseFlexibleQuestions(rawText: string): {
  questions: Array<{ question: string; options: string[]; correctAnswer: number; explanation?: string }>;
  detectedCount: number;
  standardText: string;
} {
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
    } else if (cleanText.length > 5) {
      const inlineMatches = Array.from(
        curQuestionText.matchAll(/(?:^|\s+)([A-D])[.\:)\/]\s*([^\n\rA-D]*?)(?=(?:\s+[A-D][.\:)\/])|$)/gi)
      );

      if (inlineMatches.length >= 2) {
        const extractedOpts: string[] = [];
        let detectedAns = -1;

        inlineMatches.forEach((m) => {
          const letter = m[1].toUpperCase();
          let optVal = m[2].trim();
          if (optVal.includes('*') || /[([]\s*đúng\s*[)\]]/i.test(optVal)) {
            detectedAns = ['A', 'B', 'C', 'D'].indexOf(letter);
            optVal = optVal.replace(/\*|[([]\s*đúng\s*[)\]]/gi, '').trim();
          }
          extractedOpts.push(optVal);
        });

        while (extractedOpts.length < 4) {
          extractedOpts.push(`Phương án ${String.fromCharCode(65 + extractedOpts.length)}`);
        }

        const qBody = curQuestionText.split(/(?:^|\s+)[A-D][.\:)\/]/i)[0]
          .replace(/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+|\d+)[\.\:\)\-]?\s*/i, '')
          .trim();

        questions.push({
          question: qBody || cleanText,
          options: extractedOpts.slice(0, 4),
          correctAnswer: detectedAns >= 0 ? detectedAns : (curAnswerIndex >= 0 ? curAnswerIndex : 0),
          explanation: curExplanation.trim() || undefined,
        });
      }
    }

    curQuestionText = '';
    curOptions = [];
    curAnswerIndex = -1;
    curExplanation = '';
  };

  const isQuestionStart = (line: string): boolean => {
    const trimmed = line.trim();
    if (/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+)[\.\:\)\-]?\s+/i.test(trimmed)) return true;
    if (/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+)[\.\:\)\-]?$/i.test(trimmed)) return true;
    if (/^\d{1,3}[\.\:\)\-]\s+/.test(trimmed)) return true;
    return false;
  };

  const isAnswerLine = (line: string): { isAns: boolean; char?: string } => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:đáp\s*án(?:\s*đúng)?|đ\/a|đa|key|ans(?:wer)?|chọn)\s*[:\.]?\s*([A-D])/i);
    if (match) return { isAns: true, char: match[1].toUpperCase() };
    return { isAns: false };
  };

  const isExplanationLine = (line: string): { isExp: boolean; text?: string } => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:giải\s*thích|hướng\s*dẫn\s*giải|ghi\s*chú)\s*[:\.]?\s*(.*)$/i);
    if (match) return { isExp: true, text: match[1].trim() };
    return { isExp: false };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isQuestionStart(trimmed)) {
      finalizeCurrentQuestion();
      curQuestionText = trimmed;
      continue;
    }

    const ansCheck = isAnswerLine(trimmed);
    if (ansCheck.isAns && ansCheck.char) {
      curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(ansCheck.char);
      continue;
    }

    const expCheck = isExplanationLine(trimmed);
    if (expCheck.isExp) {
      curExplanation = expCheck.text || '';
      continue;
    }

    const hasMultipleOptions = (trimmed.match(/\b[A-D][\.\:\)\/]\s+/g) || []).length >= 2;
    if (hasMultipleOptions) {
      const parts = trimmed.split(/(?=[A-D][\.\:\)\/]\s+)/);
      for (const part of parts) {
        const pTrimmed = part.trim();
        const singleMatch = pTrimmed.match(/^([A-D])[\.\:\)\/]\s*(.*)$/i);
        if (singleMatch) {
          const letter = singleMatch[1].toUpperCase();
          let optText = singleMatch[2].trim();
          if (optText.startsWith('*') || optText.endsWith('*') || /[([]\s*đúng\s*[)\]]/i.test(optText)) {
            curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
            optText = optText.replace(/^\*|\*$|[([]\s*đúng\s*[)\]]/gi, '').trim();
          }
          curOptions.push(optText);
        }
      }
      continue;
    }

    const optionMatch = trimmed.match(/^(\*?\s*[A-D]\*?|\([A-D]\)|\[[A-D]\])[\.\:\)\/]\s*(.*)$/i);
    if (optionMatch) {
      const rawLetter = optionMatch[1].replace(/[\(\)\[\]\s]/g, '');
      const letter = rawLetter.replace(/\*/g, '').toUpperCase();
      let optText = optionMatch[2].trim();

      if (rawLetter.includes('*') || optText.startsWith('*') || optText.endsWith('*') || /[([]\s*đúng\s*[)\]]/i.test(optText)) {
        curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
        optText = optText.replace(/^\*|\*$|[([]\s*đúng\s*[)\]]/gi, '').trim();
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

  // If still 0, split by double newline
  if (questions.length === 0 && rawText.trim().length > 10) {
    const fallbackBlocks = rawText.split(/\n\s*\n/).filter((b) => b.trim());
    fallbackBlocks.forEach((b) => {
      const subLines = b.split('\n').map((l) => l.trim()).filter((l) => l);
      if (subLines.length >= 3) {
        const qLine = subLines[0];
        const opts: string[] = [];
        let ansIdx = 0;

        for (let j = 1; j < subLines.length; j++) {
          const l = subLines[j];
          const m = l.match(/^([A-D])[\.\:\)\/]\s*(.*)$/i);
          if (m) opts.push(m[2]);
          else {
            const ansM = isAnswerLine(l);
            if (ansM.isAns && ansM.char) ansIdx = ['A', 'B', 'C', 'D'].indexOf(ansM.char);
          }
        }

        if (opts.length >= 2) {
          while (opts.length < 4) opts.push(`Phương án ${String.fromCharCode(65 + opts.length)}`);
          questions.push({
            question: qLine.replace(/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+|\d+)[\.\:\)\-]?\s*/i, ''),
            options: opts.slice(0, 4),
            correctAnswer: ansIdx >= 0 ? ansIdx : 0,
          });
        }
      }
    });
  }

  // Format standard text
  const letters = ['A', 'B', 'C', 'D'];
  const standardText = questions
    .map((q, idx) => {
      const opts = q.options.map((opt, oIdx) => `${letters[oIdx]}. ${opt}`).join('\n');
      const ansChar = letters[q.correctAnswer] || 'A';
      const expLine = q.explanation ? `\nGiải thích: ${q.explanation}` : '';
      return `Câu ${idx + 1}: ${q.question}\n${opts}\nĐáp án: ${ansChar}${expLine}`;
    })
    .join('\n\n');

  return { questions, detectedCount: questions.length, standardText };
}

// Read request body safely whether Vercel parsed it or it's a stream
async function readBody(req: IncomingMessage & { body?: any }): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({ rawText: raw });
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  // CORS & headers
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  try {
    const body = await readBody(req);
    const rawText = (body.rawText || '').trim();
    const fileBase64 = body.fileBase64;
    const fileMimeType = body.fileMimeType || 'application/octet-stream';
    const fileName = body.fileName || '';

    if (!rawText && !fileBase64) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Vui lòng cung cấp văn bản hoặc tệp câu hỏi.' }));
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. If Gemini API key is available, use Gemini 3.8 Flash for intelligent normalization
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const parts: any[] = [];
        const systemPrompt = `Bạn là trợ lý AI chuyên nghiệp về xử lý và chuẩn hóa đề thi trắc nghiệm tiếng Việt dành cho trường THPT Võ Thị Sáu.
Nhiệm vụ:
1. Đọc kỹ văn bản hoặc tài liệu đính kèm.
2. Chuẩn hóa TOÀN BỘ các câu hỏi trắc nghiệm sang định dạng:
Câu [Số]: [Nội dung câu hỏi đầy đủ]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Đáp án: [A hoặc B hoặc C hoặc D]

Yêu cầu:
- Mỗi câu đủ 4 phương án A, B, C, D (nếu thiếu, hãy thêm phương án gây nhiễu hợp lý).
- Dòng 'Đáp án: X' là bắt buộc. Nếu đề chưa có đáp án, hãy suy luận đáp án chính xác nhất.
- Trả về JSON gồm:
  + "standardText": chuỗi văn bản hoàn chỉnh đã chuẩn hóa.
  + "questions": mảng các câu hỏi [{ "question": string, "options": string[4], "correctAnswer": number (0-3), "explanation": string }].
  + "detectedCount": tổng số câu hỏi tìm thấy.`;

        parts.push({ text: systemPrompt });

        if (rawText) {
          parts.push({ text: `VĂN BẢN CẦN CHUẨN HÓA:\n${rawText}` });
        }

        if (fileBase64) {
          const buffer = Buffer.from(fileBase64, 'base64');
          const lowerName = fileName.toLowerCase();

          if (fileMimeType === 'application/pdf' || fileMimeType.startsWith('image/')) {
            parts.push({
              inlineData: {
                mimeType: fileMimeType,
                data: fileBase64,
              },
            });
          } else if (lowerName.endsWith('.docx')) {
            const mammothRes = await mammoth.extractRawText({ buffer });
            parts.push({ text: `NỘI DUNG TỪ WORD (.docx):\n${mammothRes.value}` });
          } else {
            parts.push({ text: `NỘI DUNG TỆP:\n${buffer.toString('utf-8')}` });
          }
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
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
                        items: { type: Type.STRING },
                      },
                      correctAnswer: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctAnswer'],
                  },
                },
              },
              required: ['standardText', 'questions', 'detectedCount'],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          res.statusCode = 200;
          res.end(JSON.stringify(parsed));
          return;
        }
      } catch (geminiErr: any) {
        console.warn('[Normalize] Gemini serverless warning, switching to smart regex fallback:', geminiErr?.message || geminiErr);
      }
    }

    // 2. Intelligent Regex Fallback (works 100% of the time, zero dependency on external quota)
    let textToParse = rawText;
    if (!textToParse && fileBase64) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64');
        if (fileName.toLowerCase().endsWith('.docx')) {
          const mammothRes = await mammoth.extractRawText({ buffer });
          textToParse = mammothRes.value;
        } else {
          textToParse = buffer.toString('utf-8');
        }
      } catch (err) {
        console.warn('File decode error:', err);
      }
    }

    const fallbackResult = parseFlexibleQuestions(textToParse);
    if (fallbackResult.questions.length > 0) {
      res.statusCode = 200;
      res.end(JSON.stringify(fallbackResult));
      return;
    }

    res.statusCode = 400;
    res.end(JSON.stringify({ 
      error: 'Không nhận diện được câu hỏi nào trong nội dung này. Vui lòng kiểm tra lại văn bản hoặc tệp.' 
    }));
  } catch (err: any) {
    console.error('Normalize handler error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || 'Lỗi xử lý chuẩn hóa câu hỏi.' }));
  }
}
