
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../App';

interface SantaFaceProps {
  isFrozen?: boolean;
}

const SantaFace: React.FC<SantaFaceProps> = ({ isFrozen = false }) => {
  const { lang } = useLanguage();
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [smileFactor, setSmileFactor] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  // Interaction State
  const [clickCount, setClickCount] = useState(0);
  const [showDialog, setShowDialog] = useState(false);

  const faceRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!faceRef.current) return;
      const rect = faceRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const rawDx = e.clientX - centerX;
      const rawDy = e.clientY - centerY;
      
      const maxDistX = window.innerWidth / 1.5;
      const maxDistY = window.innerHeight / 1.5;
      
      const dx = Math.max(-1, Math.min(1, rawDx / maxDistX));
      const dy = Math.max(-1, Math.min(1, rawDy / maxDistY));
      
      setLook({ x: dx, y: dy });

      const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
      const interactRadius = 400; 
      const proximity = Math.max(0, 1 - (dist / interactRadius)); 
      setSmileFactor(proximity);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (dialogTimeoutRef.current) clearTimeout(dialogTimeoutRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); 
      if (isActive || isFrozen) return;

      const nextCount = clickCount + 1;
      setClickCount(nextCount);
      setIsActive(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
          setIsActive(false);
      }, 2000);

      if (nextCount > 0 && nextCount % 3 === 0) {
          if (dialogTimeoutRef.current) clearTimeout(dialogTimeoutRef.current);
          setShowDialog(true);
          dialogTimeoutRef.current = setTimeout(() => {
              setShowDialog(false);
          }, 4000);
      }
  };

  const eyeX = look.x * 2.5; 
  const eyeY = look.y * 1.5;
  const rotX = look.y * -12; 
  const rotY = look.x * 18;  

  const effectiveSmile = isActive ? 1.2 : smileFactor;
  const tipY = 65 - (effectiveSmile * 10);
  const tipXOffset = effectiveSmile * 4;
  const controlY = 78 - (effectiveSmile * 8); 
  
  const mustachePath = `
    M 50 68 
    Q 38 ${controlY} ${28 - tipXOffset} ${tipY} 
    Q 35 ${60 - effectiveSmile * 2} 50 64 
    Q 65 ${60 - effectiveSmile * 2} ${72 + tipXOffset} ${tipY} 
    Q 62 ${controlY} 50 68
  `;

  return (
    <div 
        ref={faceRef}
        onClick={handleClick}
        style={{ 
            display: 'inline-block', 
            width: '0.65em',
            height: '0.65em',
            verticalAlign: '0', 
            position: 'relative',
            perspective: '400px',
            marginRight: '0.02em',
            marginLeft: '0.02em',
            zIndex: 20,
            cursor: (isActive || isFrozen) ? 'default' : 'pointer'
        }}
        aria-label="Character Face"
        title={(isActive || isFrozen) ? "Busy..." : "Click me!"}
    >
      <style>
        {`
          @keyframes tongueWiggle {
            0%, 100% { transform: rotate(0deg) translate(0, 0); }
            25% { transform: rotate(-8deg) translate(-1px, 0); }
            75% { transform: rotate(8deg) translate(1px, 0); }
          }
          @keyframes blinkAnim {
            0%, 45%, 55%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.1); }
          }
          @keyframes eyebrowBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes dialogGlow {
            0%, 100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.05), 0 20px 40px rgba(0,0,0,0.6); border-color: rgba(255, 255, 255, 0.1); }
            50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.15), 0 20px 40px rgba(0,0,0,0.6); border-color: rgba(255, 255, 255, 0.15); }
          }
        `}
      </style>

      {showDialog && (
        <div 
            className="absolute left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-700 slide-in-from-top-4"
            style={{ 
                top: '115%', 
                width: 'max-content',
                maxWidth: '240px',
                pointerEvents: 'none'
            }}
        >
             <div className="relative bg-[#0d1117]/95 backdrop-blur-3xl px-6 py-4 rounded-[1.25rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden" style={{ animation: 'dialogGlow 4s infinite ease-in-out' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0d1117] border-t border-l border-white/10 transform rotate-45"></div>
                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2.5 opacity-40">
                        <div className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                        <span className="text-[7px] font-black text-white uppercase tracking-[0.5em]">
                          {lang === 'ru' ? 'Поведенческий анализ' : 'Behavioral Analysis'}
                        </span>
                    </div>
                    <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-0.5"></div>
                    <p className="text-[14px] leading-snug font-medium text-center text-white tracking-tight">
                      <span className="opacity-90">{lang === 'ru' ? 'Остановитесь,' : 'Stop it,'}</span> <br/>
                      <span className="text-red-400 font-bold drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                        {lang === 'ru' ? 'обратитесь за помощью!' : 'get some help!'}
                      </span>
                    </p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none"></div>
             </div>
        </div>
      )}

      <svg
        viewBox="0 0 100 100"
        style={{
            width: '160%', 
            height: '160%',
            position: 'absolute',
            top: '-40%', 
            left: '-30%', 
            overflow: 'visible',
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${isActive ? 1.15 : 1})`,
            transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.25))'
        }}
      >
        <defs>
            <linearGradient id="skinGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffdecb" />
                <stop offset="100%" stopColor="#ffb89e" />
            </linearGradient>
            <linearGradient id="hairGradient" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
        </defs>
        <rect x="24" y="18" width="52" height="60" rx="26" fill="url(#skinGradient)" />
        <ellipse cx="38" cy="28" rx="10" ry="6" fill="white" opacity="0.4" transform="rotate(-20 38 28)" />
        <circle cx="22" cy="54" r="5" fill="#ffdecb" />
        <circle cx="78" cy="54" r="5" fill="#ffdecb" />
        <path d="M20 55 C 12 75, 30 98, 50 98 C 70 98, 88 75, 80 55 Q 77 48 72 52 Q 50 65 28 52 Q 23 48 20 55 Z" fill="url(#hairGradient)" />
        {isActive ? (
             <g>
                <path d="M 30 68 Q 50 95 70 68 Q 50 82 30 68 Z" fill="#4a1515" />
                <path d="M 40 76 Q 50 92 60 76" fill="#ff6b6b" stroke="#cc4444" strokeWidth="0.5" style={{ transformOrigin: '50px 76px', animation: 'tongueWiggle 0.165s infinite linear' }} />
             </g>
        ) : (
             <g opacity={smileFactor > 0.05 ? 1 : 0}>
                <path d={`M ${50 - smileFactor * 20} 70 Q 50 ${70 + (smileFactor * 35)} ${50 + smileFactor * 20} 70 Z`} fill="#4a1515" />
                <path d={`M ${50 - smileFactor * 8} ${70 + smileFactor * 10} Q 50 ${70 + smileFactor * 28} ${50 + smileFactor * 8} ${70 + smileFactor * 10}`} fill="#ff6b6b" opacity={smileFactor > 0.3 ? (smileFactor - 0.3) / 0.7 : 0} style={{ transformOrigin: '50px 75px' }} />
             </g>
        )}
        <path d={mustachePath} fill="#f1f5f9" />
        <circle cx="50" cy="62" r="5.5" fill="#fca5a5" />
        <g transform="translate(0, 1)">
            <g style={{ transformOrigin: '38px 48px', animation: isActive ? 'blinkAnim 0.8s infinite' : 'none' }}>
                <ellipse cx="38" cy="48" rx="4" ry="4.5" fill="white" />
                <g transform={`translate(${eyeX}, ${eyeY})`}>
                    <circle cx="38" cy="48" r="1.8" fill="#1e293b" />
                    <circle cx="39" cy="47" r="0.6" fill="white" opacity="0.9" />
                </g>
            </g>
            <g style={{ transformOrigin: '62px 48px', animation: isActive ? 'blinkAnim 0.8s infinite' : 'none' }}>
                <ellipse cx="62" cy="48" rx="4" ry="4.5" fill="white" />
                <g transform={`translate(${eyeX}, ${eyeY})`}>
                    <circle cx="62" cy="48" r="1.8" fill="#1e293b" />
                    <circle cx="63" cy="47" r="0.6" fill="white" opacity="0.9" />
                </g>
            </g>
        </g>
        <g fill="none" stroke="#fbbf24" strokeWidth="1.5">
            <circle cx="38" cy="49" r="6.5" />
            <circle cx="62" cy="49" r="6.5" />
            <path d="M44.5 49 L 55.5 49" />
            <path d="M31.5 49 L 22 47" />
            <path d="M68.5 49 L 78 47" />
        </g>
        <g style={{ animation: isActive ? 'eyebrowBounce 0.4s infinite alternate' : 'none' }}>
            <path d={`M33 ${38 - effectiveSmile * 3} Q 38 ${34 - effectiveSmile * 4} 43 ${38 - effectiveSmile * 3}`} stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d={`M57 ${38 - effectiveSmile * 3} Q 62 ${34 - effectiveSmile * 4} 67 ${38 - effectiveSmile * 3}`} stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  );
};

export default SantaFace;
