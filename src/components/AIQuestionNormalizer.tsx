import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Check, 
  Copy, 
  ArrowRight, 
  FileCheck, 
  AlertCircle, 
  RefreshCw,
  X,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { Question } from '../types';
import { parseFlexibleQuestions, formatQuestionsToManualText } from '../utils/questionParser';

interface AIQuestionNormalizerProps {
  onApplyQuestions: (formattedText: string, questionsList: Question[]) => void;
  onCancel?: () => void;
}

export default function AIQuestionNormalizer({
  onApplyQuestions,
  onCancel,
}: AIQuestionNormalizerProps) {
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [resultQuestions, setResultQuestions] = useState<Question[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'cards'>('text');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  // Helper to convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Helper to read text file if applicable
  const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file, 'utf-8');
    });
  };

  const handleNormalize = async () => {
    if (!rawText.trim() && !selectedFile) {
      setError('Vui lòng dán văn bản hoặc tải lên tệp câu hỏi (Word, PDF, Ảnh).');
      return;
    }

    setIsLoading(true);
    setError(null);

    let extractedFileText = '';
    let fileBase64 = '';

    if (selectedFile) {
      const isTextFile = selectedFile.type.startsWith('text/') || selectedFile.name.endsWith('.txt');
      if (isTextFile) {
        extractedFileText = await fileToText(selectedFile);
      }
      try {
        fileBase64 = await fileToBase64(selectedFile);
      } catch (e) {
        console.warn('File read warning:', e);
      }
    }

    const textPayload = (rawText.trim() + (extractedFileText ? `\n\n${extractedFileText}` : '')).trim();

    try {
      // 1. First attempt: call server endpoint /api/normalize-questions with JSON payload
      // JSON is 100% compatible with both Vercel Serverless Functions and Express backend!
      let serverSuccess = false;

      try {
        const payload: any = {
          rawText: textPayload,
        };

        if (selectedFile && fileBase64) {
          payload.fileBase64 = fileBase64;
          payload.fileName = selectedFile.name;
          payload.fileMimeType = selectedFile.type || 'application/octet-stream';
        }

        const res = await fetch('/api/normalize-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data.standardText && data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
              setResultText(data.standardText);
              setResultQuestions(data.questions);
              serverSuccess = true;
              return;
            }
          }
        }
      } catch (apiErr) {
        console.warn('Backend normalize endpoint notice:', apiErr);
      }

      // 2. If server was unreachable, returned 404/500, or static web hosting:
      // Seamlessly fall back to client-side intelligent regex parser!
      if (!serverSuccess && textPayload) {
        const parsed = parseFlexibleQuestions(textPayload);
        if (parsed.questions.length > 0) {
          const formatted = formatQuestionsToManualText(parsed.questions);
          setResultText(formatted);
          setResultQuestions(parsed.questions);
          return;
        }
      }

      // 3. If still not resolved
      if (selectedFile && !textPayload) {
        throw new Error('Máy chủ web chưa kích hoạt khóa AI để đọc trực tiếp hình ảnh/PDF. Thầy/cô vui lòng copy dán văn bản câu hỏi vào ô bên trên để chuẩn hóa tức thì!');
      }

      throw new Error('Không thể nhận diện được câu hỏi nào trong nội dung này. Vui lòng kiểm tra lại văn bản hoặc dán các câu hỏi rõ ràng hơn.');
    } catch (err: any) {
      console.error('Normalization error:', err);
      setError(err.message || 'Không thể chuẩn hóa câu hỏi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleApply = () => {
    if (!resultText || resultQuestions.length === 0) return;
    onApplyQuestions(resultText, resultQuestions);
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return <FileSpreadsheet className="w-5 h-5 text-blue-500" />;
    if (lower.match(/\.(png|jpe?g|webp)$/)) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    return <FileText className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Notice Banner */}
      <div className="p-3.5 bg-gradient-to-r from-amber-50 via-sky-50 to-indigo-50 border border-sky-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">Tính năng AI Chuẩn Hóa Tự Động:</span> Dán văn bản câu hỏi thô từ bất kỳ nguồn nào hoặc tải tệp tài liệu (<span className="font-semibold text-blue-700">.doc, .docx, PDF</span> hoặc <span className="font-semibold text-emerald-700">Ảnh chụp đề thi</span>). Trợ lý AI sẽ tự động sắp xếp chuẩn từng câu, tạo đủ 4 đáp án A-B-C-D và tự động tìm đáp án chính xác.
        </div>
      </div>

      {/* Input Section (if no result yet or want to re-run) */}
      {!resultText ? (
        <div className="space-y-4">
          {/* Textarea for pasting */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Dán nội dung văn bản câu hỏi thô (tùy chọn)
              </label>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="text-[11px] text-slate-400 hover:text-red-500 transition"
                >
                  Xóa văn bản
                </button>
              )}
            </div>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Dán nội dung câu hỏi bất kỳ tại đây...
Ví dụ:
1/ Ai là người sáng tác bài hát Biết ơn chị Võ Thị Sáu?
A: Nhạc sĩ Văn Cao   B: Nhạc sĩ Nguyễn Đức Toàn
C: Nhạc sĩ Phong Nhã   D: Nhạc sĩ Lưu Hữu Phước
Đáp án: B

(Hoặc câu hỏi lộn xộn, thiếu chữ A-B-C-D, AI đều có thể tự sắp xếp lại)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 transition shadow-inner leading-relaxed"
            />
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              2. Hoặc tải tệp đề thi / ảnh chụp câu hỏi (.doc, .docx, PDF, Ảnh)
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-sky-500 bg-sky-50/80 scale-[1.01]'
                  : selectedFile
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 bg-slate-50/70 hover:border-sky-400 hover:bg-sky-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.webp,.txt"
                className="hidden"
                onChange={handleFileChange}
              />

              {selectedFile ? (
                <div className="flex items-center justify-between w-full max-w-md bg-white p-2.5 rounded-xl border border-emerald-300 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getFileIcon(selectedFile.name)}
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Sẵn sàng phân tích
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition"
                    title="Gỡ tệp"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                    <Upload size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Kéo thả hoặc bấm để chọn tệp tài liệu câu hỏi
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hỗ trợ Word (<strong className="text-blue-600">.doc, .docx</strong>), <strong className="text-rose-600">PDF</strong> hoặc <strong className="text-emerald-600">Ảnh chụp đề thi</strong>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            disabled={isLoading || (!rawText.trim() && !selectedFile)}
            onClick={handleNormalize}
            className={`w-full py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] ${
              isLoading || (!rawText.trim() && !selectedFile)
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-700 hover:to-purple-700 shadow-indigo-200'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI đang đọc và chuẩn hóa câu hỏi... (vui lòng chờ vài giây)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>⚡ AI Chuẩn Hóa Thành Định Dạng Chuẩn</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Results Section */
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <FileCheck size={16} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-emerald-900">
                  Chuẩn hóa thành công {resultQuestions.length} câu hỏi!
                </h4>
                <p className="text-[11px] text-emerald-700">
                  Đã tạo đủ 4 phương án A-B-C-D và tự động gắn đáp án chính xác
                </p>
              </div>
            </div>

            {/* Toggle View Mode */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-emerald-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  viewMode === 'text' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText size={13} /> <span>Văn bản</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  viewMode === 'cards' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Eye size={13} /> <span>Xem trước</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          {viewMode === 'text' ? (
            <div className="relative">
              <textarea
                rows={9}
                readOnly
                value={resultText}
                className="w-full px-3.5 py-2.5 bg-slate-900 text-emerald-300 font-mono text-xs rounded-2xl border border-slate-700 focus:outline-none shadow-inner leading-relaxed"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md flex items-center gap-1 transition active:scale-95"
              >
                {isCopied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
              {resultQuestions.map((q, idx) => {
                const letters = ['A', 'B', 'C', 'D'];
                return (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1.5 shadow-xs">
                    <p className="font-bold text-slate-900">
                      Câu {idx + 1}: {q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correctAnswer;
                        return (
                          <div
                            key={oIdx}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 ${
                              isCorrect
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {letters[oIdx]}
                            </span>
                            <span className="truncate">{opt}</span>
                            {isCorrect && <Check size={13} className="ml-auto text-emerald-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setResultText(null);
                setResultQuestions([]);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
            >
              <RefreshCw size={13} /> <span>Chuẩn hóa nội dung khác</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{isCopied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              >
                <ArrowRight size={14} />
                <span>Áp Dụng Vào Bộ Câu Hỏi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
