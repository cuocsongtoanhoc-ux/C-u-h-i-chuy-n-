import { Question } from '../types';

/**
 * Ultra-forgiving parser for Vietnamese school quiz questions
 * Handles:
 * - "Câu 1:", "Câu 1.", "Câu 1 -", "Câu 1", "Câu hỏi 1:", "Bài 1:"
 * - "1.", "1:", "1)", "1 -", "[1]"
 * - Options on multiple lines or single line ("A. ... B. ... C. ... D. ...")
 * - Formats: "A.", "A:", "A)", "a.", "a)", "A/", "(A)"
 * - Answers: "Đáp án: A", "Đáp án A", "ĐA: A", "Đ/a: A", "Key: A", "Ans: A", "Chọn: A"
 * - Starred options: "*A.", "A.*", "A. ... (đúng)"
 */
export function parseFlexibleQuestions(rawText: string): {
  questions: Question[];
  warnings: string[];
} {
  if (!rawText || !rawText.trim()) {
    return { questions: [], warnings: [] };
  }

  const lines = rawText.split(/\r?\n/);
  const questions: Question[] = [];
  const warnings: string[] = [];

  // Temporary container for current building question
  let curQuestionText = '';
  let curOptions: string[] = [];
  let curAnswerIndex = -1;
  let curExplanation = '';

  const finalizeCurrentQuestion = () => {
    if (!curQuestionText.trim()) return;

    // Clean up question text
    let cleanText = curQuestionText
      .replace(/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+|\d+)[\.\:\)\-]?\s*/i, '')
      .trim();

    if (!cleanText) {
      cleanText = curQuestionText.trim();
    }

    // Ensure we have at least 2 options (ideally 4)
    if (curOptions.length >= 2) {
      // If only 2 or 3 options, pad or keep
      while (curOptions.length < 4) {
        // Option placeholder if missing D
        curOptions.push(`Phương án ${String.fromCharCode(65 + curOptions.length)}`);
      }
      // If more than 4, take first 4
      const finalOptions = curOptions.slice(0, 4);

      // Default to 0 if no answer specified
      const finalAns = curAnswerIndex >= 0 && curAnswerIndex < finalOptions.length ? curAnswerIndex : 0;

      questions.push({
        question: cleanText,
        options: finalOptions,
        correctAnswer: finalAns,
        explanation: curExplanation.trim() || undefined,
      });
    } else if (cleanText.length > 5) {
      // Question had text but options failed to parse - try inline option regex extraction
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

    // Reset container
    curQuestionText = '';
    curOptions = [];
    curAnswerIndex = -1;
    curExplanation = '';
  };

  // Helper to detect if a line starts a new question
  const isQuestionStart = (line: string): boolean => {
    const trimmed = line.trim();
    // E.g.: "Câu 1:", "Câu 1.", "Câu 1", "Câu hỏi 1:", "Bài 1:", "1.", "1:", "1)"
    if (/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+)[\.\:\)\-]?\s+/i.test(trimmed)) return true;
    if (/^(?:câu\s*(?:hỏi)?\s*\d+|bài\s*\d+)[\.\:\)\-]?$/i.test(trimmed)) return true;
    if (/^\d{1,3}[\.\:\)\-]\s+/.test(trimmed)) return true;
    return false;
  };

  // Helper to detect if a line is an answer line
  const isAnswerLine = (line: string): { isAns: boolean; char?: string } => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:đáp\s*án(?:\s*đúng)?|đ\/a|đa|key|ans(?:wer)?|chọn)\s*[:\.]?\s*([A-D])/i);
    if (match) {
      return { isAns: true, char: match[1].toUpperCase() };
    }
    return { isAns: false };
  };

  // Helper to detect explanation line
  const isExplanationLine = (line: string): { isExp: boolean; text?: string } => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:giải\s*thích|hướng\s*dẫn\s*giải|ghi\s*chú)\s*[:\.]?\s*(.*)$/i);
    if (match) {
      return { isExp: true, text: match[1].trim() };
    }
    return { isExp: false };
  };

  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Empty line - if curQuestion has text and 4 options, an empty line could separate questions
      continue;
    }

    // Check if new question starts
    if (isQuestionStart(trimmed)) {
      finalizeCurrentQuestion();
      curQuestionText = trimmed;
      continue;
    }

    // Check if answer line
    const ansCheck = isAnswerLine(trimmed);
    if (ansCheck.isAns && ansCheck.char) {
      curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(ansCheck.char);
      continue;
    }

    // Check if explanation line
    const expCheck = isExplanationLine(trimmed);
    if (expCheck.isExp) {
      curExplanation = expCheck.text || '';
      continue;
    }

    // Check if this line contains inline options like: "A. xxx B. yyy C. zzz D. ttt"
    // Or multi-option on one line like "A. xxx   B. yyy"
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

    // Check if single option line: "A. ...", "*A. ...", "A) ...", "A: ..."
    const optionMatch = trimmed.match(/^(\*?\s*[A-D]\*?|\([A-D]\)|\[[A-D]\])[\.\:\)\/]\s*(.*)$/i);
    if (optionMatch) {
      const rawLetter = optionMatch[1].replace(/[\(\)\[\]\s]/g, '');
      const letter = rawLetter.replace(/\*/g, '').toUpperCase();
      let optText = optionMatch[2].trim();

      // Check if marked with asterisk or (đúng)
      if (rawLetter.includes('*') || optText.startsWith('*') || optText.endsWith('*') || /[([]\s*đúng\s*[)\]]/i.test(optText)) {
        curAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
        optText = optText.replace(/^\*|\*$|[([]\s*đúng\s*[)\]]/gi, '').trim();
      }

      curOptions.push(optText);
      continue;
    }

    // If options are already started, this could be a continuation of the last option or explanation
    if (curOptions.length > 0) {
      curOptions[curOptions.length - 1] += ' ' + trimmed;
    } else if (curQuestionText) {
      // Continuation of question text
      curQuestionText += ' ' + trimmed;
    } else {
      // Freeform text at the beginning before any "Câu 1:" - treat as first question start
      curQuestionText = trimmed;
    }
  }

  // Finalize last question
  finalizeCurrentQuestion();

  // If still 0 questions found, try split by double newline as fallback
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
          if (m) {
            opts.push(m[2]);
          } else {
            const ansM = isAnswerLine(l);
            if (ansM.isAns && ansM.char) {
              ansIdx = ['A', 'B', 'C', 'D'].indexOf(ansM.char);
            }
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

  return { questions, warnings };
}

/**
 * Format questions list to standard text format for the textarea
 */
export function formatQuestionsToManualText(questions: Question[]): string {
  if (!questions || questions.length === 0) return '';

  return questions
    .map((q, idx) => {
      const letters = ['A', 'B', 'C', 'D'];
      const opts = q.options
        .map((opt, oIdx) => `${letters[oIdx]}. ${opt}`)
        .join('\n');
      const ansChar = letters[q.correctAnswer] || 'A';
      const expLine = q.explanation ? `\nGiải thích: ${q.explanation}` : '';
      return `Câu ${idx + 1}: ${q.question}\n${opts}\nĐáp án: ${ansChar}${expLine}`;
    })
    .join('\n\n');
}
