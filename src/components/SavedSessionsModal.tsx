import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { SavedSession, Question } from '../types';
import { 
  X, 
  FolderPlus, 
  Download, 
  Upload, 
  Search, 
  Calendar, 
  HelpCircle, 
  CheckCircle2, 
  Copy, 
  Trash2, 
  Sparkles,
  BookOpen,
  Volume2,
  FileCheck,
  Cloud,
  CloudUpload,
  CloudDownload,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { 
  getSavedSessions, 
  saveOrUpdateSession, 
  deleteSession, 
  duplicateSession, 
  exportSessionsToJSON, 
  importSessionsFromJSON,
  pushSessionsToCloud,
  pullSessionsFromCloud,
  getLastSyncTime,
  getStoredSyncKey,
  setStoredSyncKey
} from '../utils/sessionStorage';
import { auth, signInWithGoogle, signOutUser } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

interface SavedSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSessionId?: string;
  onSelectSession: (session: SavedSession) => void;
  onSaveCurrentAsNew: () => void;
}

export default function SavedSessionsModal({
  isOpen,
  onClose,
  activeSessionId,
  onSelectSession,
  onSaveCurrentAsNew,
}: SavedSessionsModalProps) {
  const [sessions, setSessions] = useState<SavedSession[]>(() => getSavedSessions());
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => getLastSyncTime());
  const [syncKeyInput, setSyncKeyInput] = useState(() => getStoredSyncKey());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (u?.email) {
        setSyncKeyInput(u.email);
        setStoredSyncKey(u.email);
      }
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const refreshList = () => {
    setSessions(getSavedSessions());
    setLastSyncTime(getLastSyncTime());
  };

  const handlePushToCloud = async () => {
    setIsSyncing(true);
    setImportStatus('Đang tải dữ liệu chuyên đề lên đám mây...');
    try {
      const res = await pushSessionsToCloud(sessions, syncKeyInput);
      setImportStatus(res.message);
      refreshList();
    } catch (e: any) {
      setImportStatus(`Lỗi đồng bộ: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setImportStatus(null), 4500);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncing(true);
    setImportStatus('Đang kết nối đám mây để tải câu hỏi và chuyên đề...');
    try {
      const res = await pullSessionsFromCloud(syncKeyInput);
      setImportStatus(res.message);
      if (res.success) {
        setSessions(res.sessions);
        setLastSyncTime(getLastSyncTime());
      }
    } catch (e: any) {
      setImportStatus(`Lỗi tải đám mây: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSyncing(true);
      const user = await signInWithGoogle();
      if (user) {
        setImportStatus(`Đã đăng nhập thành công: ${user.email}. Đang đồng bộ...`);
        await pullSessionsFromCloud(user.email || undefined);
        refreshList();
      }
    } catch (e: any) {
      setImportStatus(`Đăng nhập Google thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    setImportStatus('Đã đăng xuất.');
    setTimeout(() => setImportStatus(null), 2500);
  };

  const filtered = sessions.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  const handleDelete = (id: string) => {
    const updated = deleteSession(id);
    setSessions(updated);
    setDeleteConfirmId(null);
  };

  const handleDuplicate = (id: string) => {
    const updated = duplicateSession(id);
    setSessions(updated);
  };

  const handleExport = () => {
    const jsonStr = exportSessionsToJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VTS_Danh_Sach_Chuyen_De_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importSessionsFromJSON(content);
        if (res.success) {
          refreshList();
          setImportStatus(`Đã nhập thành công ${res.count} chuyên đề mới!`);
          setTimeout(() => setImportStatus(null), 3500);
        } else {
          setImportStatus(`Lỗi: ${res.error || 'Không thể đọc file'}`);
          setTimeout(() => setImportStatus(null), 4000);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <BookOpen className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Bộ Sưu Tập Chuyên Đề Sinh Hoạt
                <span className="text-xs bg-amber-400 text-amber-950 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  THPT Võ Thị Sáu
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-red-100 mt-0.5">
                Quản lý, lưu trữ và chọn sẵn nội dung sinh hoạt dưới cờ để chủ động thời gian
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cloud Sync Status & Multi-Computer Sync Controls */}
        <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-blue-50 border-b border-sky-200 px-4 sm:px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sky-950 text-sm">Đồng Bộ Đám Mây Giữa Các Máy Tính</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                  Firebase Cloud Active
                </span>
              </div>
              <div className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                {currentUser ? (
                  <span>Tài khoản: <strong className="text-sky-800">{currentUser.email}</strong></span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Mã đồng bộ:
                    <input
                      type="text"
                      value={syncKeyInput}
                      onChange={(e) => {
                        setSyncKeyInput(e.target.value);
                        setStoredSyncKey(e.target.value);
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md font-mono text-[11px] text-indigo-900 w-44 font-bold"
                      placeholder="Email hoặc mã đồng bộ"
                    />
                  </span>
                )}
                {lastSyncTime && (
                  <span className="text-slate-400">
                    • Lần cuối: {new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
            <button
              onClick={handlePushToCloud}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Đẩy dữ liệu chuyên đề và câu hỏi từ máy tính này lên đám mây"
            >
              <CloudUpload size={14} className={isSyncing ? "animate-spin" : ""} />
              <span>Đẩy Lên Đám Mây</span>
            </button>

            <button
              onClick={handlePullFromCloud}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Tải câu hỏi và chuyên đề từ đám mây về máy tính này"
            >
              <CloudDownload size={14} className={isSyncing ? "animate-bounce" : ""} />
              <span>Tải Về Từ Đám Mây</span>
            </button>

            {currentUser ? (
              <button
                onClick={handleSignOut}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold transition flex items-center gap-1"
                title="Đăng xuất tài khoản Google"
              >
                <LogOut size={13} />
                <span>Đăng xuất</span>
              </button>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
                title="Đăng nhập Google để đồng bộ tự động"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Action & Search Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm chuyên đề sinh hoạt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
            />
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onSaveCurrentAsNew}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Lưu các câu hỏi và cài đặt hiện tại thành một chuyên đề mới"
            >
              <FolderPlus size={16} /> <span>Lưu Chuyên Đề Mới</span>
            </button>

            <button
              onClick={handleExport}
              className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm rounded-2xl transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Xuất file JSON sao lưu danh sách chuyên đề"
            >
              <Download size={15} /> <span>Sao Lưu JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm rounded-2xl transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Nhập file JSON đã lưu từ máy"
            >
              <Upload size={15} /> <span>Nhập JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>

        {/* Status notification if imported */}
        {importStatus && (
          <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-5 py-2.5 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <FileCheck size={16} className="text-emerald-600" />
            <span>{importStatus}</span>
          </div>
        )}

        {/* Sessions List Scroll Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="text-base font-semibold text-slate-600">Không tìm thấy chuyên đề sinh hoạt nào</p>
              <p className="text-xs text-slate-400 mt-1">
                Hãy tạo hoặc lưu các câu hỏi chuẩn bị trước để sử dụng cho buổi sinh hoạt!
              </p>
            </div>
          ) : (
            filtered.map((sess) => {
              const isActive = sess.id === activeSessionId;
              const isDeleting = deleteConfirmId === sess.id;
              const qCount = sess.questions?.length || 0;

              return (
                <div
                  key={sess.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition relative flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive
                      ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-300 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Info block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 flex items-center gap-1">
                        <HelpCircle size={12} /> {qCount} câu hỏi
                      </span>
                      {sess.selectionMode === 'class_stt' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          Toàn trường ({sess.classConfig?.grade10 ? 'K10 ' : ''}{sess.classConfig?.grade11 ? 'K11 ' : ''}{sess.classConfig?.grade12 ? 'K12' : ''})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          Học sinh theo danh sách
                        </span>
                      )}
                      {sess.voicePref && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Volume2 size={11} /> {sess.voicePref}
                        </span>
                      )}
                      {sess.updatedAt && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
                          <Calendar size={11} /> Cập nhật: {formatDate(sess.updatedAt)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug flex items-center gap-2">
                      {sess.title}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-500 text-white font-bold px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} /> Đang chọn
                        </span>
                      )}
                    </h3>

                    {sess.description && (
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2">
                        {sess.description}
                      </p>
                    )}

                    {/* Preview first 2 questions */}
                    {sess.questions && sess.questions.length > 0 && (
                      <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1">
                        <p className="font-semibold text-slate-700">Ví dụ câu hỏi:</p>
                        <p className="truncate text-slate-600">
                          • {sess.questions[0].question}
                        </p>
                        {sess.questions[1] && (
                          <p className="truncate text-slate-600">
                            • {sess.questions[1].question}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions block */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => onSelectSession(sess)}
                      className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap ${
                        isActive
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      <Sparkles size={15} />
                      <span>{isActive ? 'Đang Nạp Sẵn' : 'Nạp Chuyên Đề Này'}</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(sess.id)}
                      className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                      title="Nhân bản chuyên đề này"
                    >
                      <Copy size={16} />
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                        <span className="text-[11px] text-red-600 font-bold px-1">Xóa?</span>
                        <button
                          onClick={() => handleDelete(sess.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-bold"
                        >
                          Có
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(sess.id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Xóa chuyên đề"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Tổng số: <strong>{sessions.length} chuyên đề</strong> đã lưu trên trình duyệt</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
