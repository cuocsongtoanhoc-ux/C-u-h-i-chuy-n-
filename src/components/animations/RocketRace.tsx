import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { playRocketBeep, playWinnerFanfare, playMagicWhoosh } from '../../utils/soundFx';

interface RocketProps {
  targetClass: string;
  targetSTTorName: string;
  onComplete: () => void;
}

export default function RocketRace({
  targetClass,
  targetSTTorName,
  onComplete,
}: RocketProps) {
  const [countdown, setCountdown] = useState<number | null>(3);
  const [isFlying, setIsFlying] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);

  useEffect(() => {
    // 3 - 2 - 1 Countdown
    playRocketBeep(false);

    const cd2 = setTimeout(() => {
      setCountdown(2);
      playRocketBeep(false);
    }, 1000);

    const cd1 = setTimeout(() => {
      setCountdown(1);
      playRocketBeep(false);
    }, 2000);

    const launch = setTimeout(() => {
      setCountdown(null);
      setIsFlying(true);
      playRocketBeep(true); // Final blastoff
      playMagicWhoosh();
    }, 3000);

    const land = setTimeout(() => {
      setIsFlying(false);
      setHasLanded(true);
      playWinnerFanfare();

      setTimeout(() => {
        onComplete();
      }, 1500);
    }, 6500);

    return () => {
      clearTimeout(cd2);
      clearTimeout(cd1);
      clearTimeout(launch);
      clearTimeout(land);
    };
  }, [onComplete]);

  return (
    <div className="relative w-full max-w-4xl h-[500px] flex flex-col items-center justify-center overflow-hidden bg-slate-950 rounded-[3rem] border-4 border-cyan-500/40 shadow-2xl p-6 select-none">
      {/* Dynamic Starfield particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: (i % 3) + 2,
              height: (i % 3) + 2,
              top: `${(i * 17) % 100}%`,
              left: `${(i * 23) % 100}%`,
              opacity: 0.6,
            }}
            animate={
              isFlying
                ? { x: [-50, -600], opacity: [0.2, 1, 0] }
                : { opacity: [0.3, 0.9, 0.3] }
            }
            transition={
              isFlying
                ? { repeat: Infinity, duration: 0.4 + (i % 5) * 0.1, ease: 'linear' }
                : { repeat: Infinity, duration: 2, ease: 'easeInOut' }
            }
          />
        ))}
      </div>

      {/* Header Badge */}
      <div className="absolute top-6 px-6 py-2 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 font-extrabold text-sm tracking-wider uppercase backdrop-blur-md flex items-center gap-2">
        <span>🚀</span> CHUYẾN TÀU VŨ TRỤ THPT VÕ THỊ SÁU <span>🚀</span>
      </div>

      {/* Countdown Stage */}
      {countdown !== null && (
        <motion.div
          key={countdown}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
          className="text-center z-20"
        >
          <span className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-orange-400 to-rose-500 drop-shadow-[0_0_35px_rgba(249,115,22,0.8)]">
            {countdown}
          </span>
          <p className="mt-4 text-cyan-300 text-xl font-bold uppercase tracking-widest">
            Chuẩn bị phóng tàu...
          </p>
        </motion.div>
      )}

      {/* Flying Rocket Stage */}
      {isFlying && (
        <div className="relative w-full flex flex-col items-center justify-center z-20">
          <motion.div
            animate={{
              y: [-12, 12, -12],
              rotate: [1, -2, 1],
            }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
            className="flex items-center gap-4"
          >
            {/* Fiery exhaust trail */}
            <motion.div
              animate={{ width: [120, 180, 100], opacity: [0.8, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 0.2 }}
              className="h-8 bg-gradient-to-l from-orange-500 via-yellow-300 to-transparent rounded-l-full blur-sm"
            />
            {/* Rocket ship icon */}
            <div className="text-8xl transform rotate-45 filter drop-shadow-[0_0_20px_#38bdf8]">
              🚀
            </div>
          </motion.div>

          {/* Speed telemetry */}
          <div className="mt-12 text-center">
            <span className="px-6 py-2 rounded-full bg-cyan-900/60 border border-cyan-400 text-cyan-200 font-bold text-lg animate-pulse">
              Đang du hành quét qua các lớp Khối 10, 11, 12...
            </span>
          </div>
        </div>
      )}

      {/* Landing / Target Reveal Stage */}
      {hasLanded && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center z-20 bg-slate-900/90 border-4 border-cyan-400 p-8 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.5)] backdrop-blur-xl"
        >
          <div className="text-6xl mb-3">🎯</div>
          <h3 className="text-2xl font-bold text-cyan-300 uppercase tracking-widest mb-2">
            ĐÃ ĐÁP XUỐNG VỊ TRÍ!
          </h3>
          <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400 my-3">
            Lớp {targetClass}
          </div>
          <div className="text-3xl font-extrabold text-white bg-cyan-600/50 py-3 px-8 rounded-full inline-block border border-cyan-300">
            {targetSTTorName}
          </div>
        </motion.div>
      )}
    </div>
  );
}
