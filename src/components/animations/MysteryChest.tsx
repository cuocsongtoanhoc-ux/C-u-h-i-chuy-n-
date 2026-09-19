import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { playMagicWhoosh, playTick, playWinnerFanfare } from '../../utils/soundFx';

interface ChestProps {
  targetClass: string;
  targetSTTorName: string;
  onComplete: () => void;
}

export default function MysteryChest({
  targetClass,
  targetSTTorName,
  onComplete,
}: ChestProps) {
  const [highlightedChest, setHighlightedChest] = useState<number>(0);
  const [isOpening, setIsOpening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const CHESTS = [
    { id: 0, label: 'Rương Hy Vọng' },
    { id: 1, label: 'Rương May Mắn' },
    { id: 2, label: 'Rương Vinh Quang' },
    { id: 3, label: 'Rương Thần Kỳ' },
  ];

  const TARGET_CHEST = 1; // Center-lucky chest

  useEffect(() => {
    playMagicWhoosh();

    // Chest hover cycle
    let step = 0;
    const cycleInterval = setInterval(() => {
      setHighlightedChest(step % CHESTS.length);
      playTick(700 + (step % 4) * 80);
      step++;
    }, 280);

    // Stop on target chest after 3.2s
    const chooseTimeout = setTimeout(() => {
      clearInterval(cycleInterval);
      setHighlightedChest(TARGET_CHEST);
      setIsOpening(true);
      playMagicWhoosh();

      // Open chest after 1.8s shake
      setTimeout(() => {
        setIsOpen(true);
        playWinnerFanfare();

        setTimeout(() => {
          onComplete();
        }, 1600);
      }, 1800);
    }, 3200);

    return () => {
      clearInterval(cycleInterval);
      clearTimeout(chooseTimeout);
    };
  }, [onComplete]);

  return (
    <div className="relative w-full max-w-4xl h-[520px] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-purple-950 rounded-[3rem] border-4 border-amber-400/50 shadow-2xl p-6 select-none">
      {/* Background Magic Sparkles */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.15)_0%,transparent_70%)] pointer-events-none" />

      {/* Header Badge */}
      <div className="absolute top-6 px-6 py-2 rounded-full bg-amber-950/80 border border-amber-400 text-amber-300 font-extrabold text-sm tracking-wider uppercase backdrop-blur-md flex items-center gap-2">
        <span>🎁</span> RƯƠNG BÍ ẨN MAY MẮN • THPT VÕ THỊ SÁU <span>🎁</span>
      </div>

      {/* Chests Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-12 z-20 w-full max-w-3xl">
        {CHESTS.map((chest) => {
          const isTarget = chest.id === TARGET_CHEST;
          const isSelected = highlightedChest === chest.id;

          return (
            <motion.div
              key={chest.id}
              className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6)] scale-105'
                  : 'bg-white/5 border-white/10 opacity-70 scale-95'
              }`}
              animate={
                isOpening && isTarget
                  ? {
                      x: [-4, 4, -4, 4, 0],
                      scale: [1.05, 1.15, 1.1],
                    }
                  : { y: isSelected ? [-5, 5, -5] : 0 }
              }
              transition={
                isOpening && isTarget
                  ? { repeat: Infinity, duration: 0.15 }
                  : { repeat: Infinity, duration: 2, ease: 'easeInOut' }
              }
            >
              <div className="text-6xl sm:text-7xl mb-2 filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                {isOpen && isTarget ? '✨' : '🎁'}
              </div>
              <span className="text-xs sm:text-sm font-bold text-amber-200 tracking-wider">
                {chest.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Chest Open / Winner Reveal Animation */}
      {isOpen && (
        <motion.div
          initial={{ scale: 0.3, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className="absolute z-30 bg-slate-900/95 border-4 border-amber-300 p-8 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.8)] text-center backdrop-blur-2xl max-w-lg w-full mx-4"
        >
          <div className="text-5xl mb-2">🎉🏆🎉</div>
          <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">
            Rương Kho Báu Đã Mở!
          </span>
          <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400 my-3">
            Lớp {targetClass}
          </div>
          <div className="text-3xl font-extrabold text-slate-900 bg-gradient-to-r from-yellow-300 to-amber-400 py-3 px-8 rounded-full inline-block shadow-md">
            {targetSTTorName}
          </div>
        </motion.div>
      )}

      {/* Status */}
      <div className="mt-8 z-20">
        <span className="text-lg font-bold text-amber-200 animate-pulse">
          {isOpen
            ? '🎊 Xin chúc mừng bạn đã được chiếc rương lựa chọn!'
            : isOpening
            ? '✨ Rương đang rung chuyển chuẩn bị mở...'
            : 'Đang lựa chọn chiếc rương định mệnh...'}
        </span>
      </div>
    </div>
  );
}
