import { useState, type FormEvent } from 'react';
import { X, Save, BookmarkPlus, Check } from 'lucide-react';

interface SaveSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultDescription?: string;
  onSave: (title: string, description: string) => void;
}

export default function SaveSessionDialog({
  isOpen,
  onClose,
  defaultTitle = '',
  defaultDescription = '',
  onSave,
}: SaveSessionDialogProps) {
  const [title, setTitle] = useState(defaultTitle || `Chuyên đề sinh hoạt ${new Date().toLocaleDateString('vi-VN')}`);
  const [description, setDescription] = useState(defaultDescription);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên chuyên đề sinh hoạt');
      return;
    }
    onSave(title.trim(), description.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-red-600 to-rose-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <BookmarkPlus className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Lưu Chuyên Đề Sinh Hoạt</h3>
              <p className="text-xs text-red-100">Lưu lại bộ câu hỏi và cài đặt để dùng cho buổi sinh hoạt</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên Chuyên Đề / Sự Kiện *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder="VD: Sinh hoạt dưới cờ Tuần 25 - Chủ đề An toàn giao thông"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              autoFocus
            />
            {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi Chú / Thời Gian Tổ Chức (Tùy chọn)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Áp dụng cho buổi sinh hoạt chuyên đề khối 10 và 11 vào sáng thứ 2..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-medium resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Save size={15} /> <span>Lưu Chuyên Đề</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
