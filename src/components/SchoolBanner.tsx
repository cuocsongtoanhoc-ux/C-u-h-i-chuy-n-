import { Maximize2, Minimize2 } from 'lucide-react';

interface SchoolBannerProps {
  compact?: boolean;
  onToggleFullscreen?: () => void;
  isFullScreen?: boolean;
}

export default function SchoolBanner({ 
  compact = false,
  onToggleFullscreen,
  isFullScreen = false
}: SchoolBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-sky-100">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 via-blue-600 to-cyan-400 p-[2px] shadow-sm shrink-0">
          <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-black text-sky-700 text-xs">
            VTS
          </div>
        </div>
        <div>
          <h2 className="text-sm font-black text-sky-900 uppercase tracking-wide leading-tight">
            TRƯỜNG THPT VÕ THỊ SÁU
          </h2>
          <p className="text-[11px] text-sky-600 font-medium leading-none">
            Sinh Hoạt Chuyên Đề & Trình Chiếu Tương Tác
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-sky-500 via-blue-600 to-cyan-600 text-white shadow-xl border-4 border-sky-200/50 p-6 sm:p-8 mb-6 w-full">
      {/* Decorative background rays & lights */}
      <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-cyan-300/25 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute left-1/4 -top-10 w-60 h-60 bg-sky-200/25 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: School Emblem & Info */}
        <div className="flex items-center gap-5 text-center md:text-left">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-200 via-white to-sky-100 p-1 shadow-2xl flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-sky-600 to-blue-800 flex flex-col items-center justify-center text-center border-2 border-white/60">
                <span className="text-white text-xs font-black tracking-widest uppercase">THPT</span>
                <span className="text-cyan-100 text-xs sm:text-sm font-extrabold tracking-tight uppercase leading-tight mt-0.5">VÕ THỊ SÁU</span>
              </div>
            </div>
            {/* Small ribbon */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-blue-900 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap border border-sky-200">
              THPT VTS
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-black tracking-wider uppercase mb-1 border border-white/30">
              <span>🏫</span> TRƯỜNG THPT VÕ THỊ SÁU
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-wide uppercase drop-shadow-md">
              HỆ THỐNG TRÌNH CHIẾU SINH HOẠT CHUYÊN ĐỀ
            </h1>
            <p className="text-sky-100 text-sm sm:text-base font-medium mt-1">
              Vòng Quay May Mắn • Quả Cầu VTS • Đố Vui Có Thưởng • Sôi Động & Hào Hứng
            </p>
          </div>
        </div>

        {/* Right: Architectural Badge & Fullscreen Toggle */}
        <div className="flex items-center gap-3 flex-wrap justify-center shrink-0">
          <div className="flex items-center gap-3.5 bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/25 text-left shrink-0">
            <div className="text-3xl sm:text-4xl">🏫</div>
            <div>
              <div className="text-xs text-cyan-200 font-bold uppercase tracking-wider">Mô Hình Hoạt Động</div>
              <div className="text-sm sm:text-base font-black text-white">Toàn Trường & Từng Khối</div>
              <div className="text-[11px] text-white/90">Khối 10 • Khối 11 • Khối 12</div>
            </div>
          </div>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="px-4 py-3 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-2xl text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-amber-900/30 active:scale-95 whitespace-nowrap"
              title={isFullScreen ? 'Thu nhỏ cửa sổ (F11)' : 'Bật Toàn Màn Hình để hình ảnh tràn đầy toàn bộ máy chiếu / màn hình'}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{isFullScreen ? 'Thu Nhỏ Màn Hình' : 'Toàn Màn Hình (F11)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

