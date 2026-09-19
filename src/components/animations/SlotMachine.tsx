import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { playTick, playWinnerFanfare } from '../../utils/soundFx';

interface SlotProps {
  candidateClasses?: string[];
  targetClass: string;
  targetSTTorName: string;
  onComplete: () => void;
}

const SAMPLE_CLASSES = [
  '10A1', '10A2', '10A3', '10A5', '10A8', '10A11',
  '11A1', '11A2', '11A4', '11A7', '11A9', '11A11',
  '12A1', '12A3', '12A6', '12A8', '12A10', '12A12'
];

export default function SlotMachine({
  candidateClasses = SAMPLE_CLASSES,
  targetClass,
  targetSTTorName,
  onComplete,
}: SlotProps) {
  const [reel1Spinning, setReel1Spinning] = useState(true);
  const [reel2Spinning, setReel2Spinning] = useState(true);
  const [displayClass, setDisplayClass] = useState(candidateClasses[0] || '10A1');
  const [displaySTT, setDisplaySTT] = useState('STT 01');
  const [isJackpot, setIsJackpot] = useState(false);

  const classesPool = candidateClasses.length > 0 ? candidateClasses : SAMPLE_CLASSES;

  useEffect(() => {
    let tickTimer: NodeJS.Timeout;
    let ticks = 0;

    // Fast cycling for Reel 1
    const reel1Interval = setInterval(() => {
      if (reel1Spinning) {
        const randCls = classesPool[Math.floor(Math.random() * classesPool.length)];
        setDisplayClass(randCls);
        playTick(600 + Math.random() * 200);
      }
    }, 70);

    // Fast cycling for Reel 2
    const reel2Interval = setInterval(() => {
      if (reel2Spinning) {
        // Random STT or sample name
        const randNum = Math.floor(Math.random() * 40) + 1;
        setDisplaySTT(targetSTTorName.includes('STT') || !isNaN(Number(targetSTTorName)) 
          ? `STT ${randNum < 10 ? '0' + randNum : randNum}`
          : `Học sinh #${randNum}`
        );
      }
    }, 70);

    // Stop Reel 1 after 3.2s
    const stopReel1Timeout = setTimeout(() => {
      setReel1Spinning(false);
      setDisplayClass(targetClass);
      playTick(300); // Thud sound
    }, 3200);

    // Stop Reel 2 after 5.0s
    const stopReel2Timeout = setTimeout(() => {
      setReel2Spinning(false);
      setDisplaySTT(targetSTTorName);
      setIsJackpot(true);
      playWinnerFanfare();

      setTimeout(() => {
        onComplete();
      }, 1500);
    }, 5000);

    return () => {
      clearInterval(reel1Interval);
      clearInterval(reel2Interval);
      clearTimeout(stopReel1Timeout);
      clearTimeout(stopReel2Timeout);
    };
  }, [reel1Spinning, reel2Spinning, targetClass, targetSTTorName, onComplete]);

  return (
    <div className="flex flex-col items-center select-none w-full max-w-4xl">
      {/* Vegas Machine Cabinet */}
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-amber-500 via-rose-600 to-indigo-950 p-6 sm:p-8 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-8 border-yellow-400">
        {/* Flashing Marquee Bulbs */}
        <div className="flex justify-between items-center mb-6 px-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full border border-yellow-100 ${i % 2 === 0 ? 'bg-yellow-300 animate-ping' : 'bg-amber-100 animate-pulse'} shadow-[0_0_10px_#fef08a]`} 
            />
          ))}
        </div>

        {/* Machine Header */}
        <div className="text-center mb-6">
          <span className="inline-block px-8 py-2 rounded-full bg-slate-900 border-2 border-yellow-300 shadow-inner">
            <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 tracking-widest uppercase">
              🎰 VTS JACKPOT ROLLER 🎰
            </h2>
          </span>
        </div>

        {/* The 2 Reels Display */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 bg-slate-900 p-4 sm:p-6 rounded-3xl border-4 border-yellow-500 shadow-2xl relative overflow-hidden">
          {/* Reel 1: CLASS */}
          <div className="relative bg-gradient-to-b from-slate-800 via-white to-slate-800 rounded-2xl p-4 sm:p-6 text-center border-2 border-yellow-300 shadow-inner h-40 flex flex-col justify-center items-center overflow-hidden">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cột Đơn Vị Lớp</span>
            <div className={`text-3xl sm:text-5xl font-black text-indigo-950 transition-transform ${reel1Spinning ? 'blur-[1px] scale-105' : 'scale-100'}`}>
              {displayClass}
            </div>
            {!reel1Spinning && (
              <span className="mt-2 text-xs font-bold px-3 py-0.5 rounded-full bg-emerald-500 text-white animate-bounce">
                ĐÃ KHÓA
              </span>
            )}
          </div>

          {/* Reel 2: STT OR STUDENT NAME */}
          <div className="relative bg-gradient-to-b from-slate-800 via-white to-slate-800 rounded-2xl p-4 sm:p-6 text-center border-2 border-yellow-300 shadow-inner h-40 flex flex-col justify-center items-center overflow-hidden">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cột Số Thứ Tự / Tên</span>
            <div className={`text-2xl sm:text-4xl font-black text-rose-600 transition-transform ${reel2Spinning ? 'blur-[1px] scale-105' : 'scale-100'}`}>
              {displaySTT}
            </div>
            {!reel2Spinning && (
              <span className="mt-2 text-xs font-bold px-3 py-0.5 rounded-full bg-emerald-500 text-white animate-bounce">
                ĐÃ KHÓA
              </span>
            )}
          </div>
        </div>

        {/* Win Light Banner */}
        <div className="mt-6 text-center">
          {isJackpot ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.1, 1], opacity: 1 }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 font-black text-2xl tracking-wider shadow-lg border-2 border-white"
            >
              🌟 TRÚNG JACKPOT LỰA CHỌN! 🌟
            </motion.div>
          ) : (
            <div className="text-yellow-200 font-bold text-lg animate-pulse tracking-wide">
              Đang quay cuồng tìm kiếm người may mắn...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
