import React, { useEffect, useRef } from 'react';

export interface SnowfallLayerConfig {
  foreground: boolean; // Large
  midground: boolean;  // Medium
  background: boolean; // Small
}

interface SnowfallProps {
  speedMultiplier: number;
  density: number;
  layers: SnowfallLayerConfig;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wind: number;
  opacity: number;
  type: 'foreground' | 'midground' | 'background';
  angle: number;
  spin: number;
}

const Snowfall: React.FC<SnowfallProps> = ({ speedMultiplier, density, layers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use a ref for config to access latest values in animation loop without re-binding
  const configRef = useRef({ speed: speedMultiplier, density, layers });
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  useEffect(() => {
    configRef.current = { speed: speedMultiplier, density, layers };
  }, [speedMultiplier, density, layers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticle = (resetY: boolean = false): Particle => {
      const currentLayers = configRef.current.layers;
      const availableTypes: Particle['type'][] = [];
      
      if (currentLayers.foreground) availableTypes.push('foreground');
      if (currentLayers.midground) availableTypes.push('midground');
      if (currentLayers.background) availableTypes.push('background');

      // Default fallback if nothing selected
      let type: Particle['type'] = 'midground'; 
      if (availableTypes.length > 0) {
          type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      }

      let radius, speed, opacity;

      switch (type) {
          case 'foreground': // Large
              radius = Math.random() * 1.5 + 2.5; 
              speed = Math.random() * 1 + 1.5;
              opacity = Math.random() * 0.2 + 0.8;
              break;
          case 'background': // Small
              radius = Math.random() * 1 + 0.5; 
              speed = Math.random() * 0.5 + 0.3;
              opacity = Math.random() * 0.2 + 0.2;
              break;
          case 'midground': // Medium
          default:
              radius = Math.random() * 1 + 1.5; 
              speed = Math.random() * 0.8 + 0.8;
              opacity = Math.random() * 0.2 + 0.5;
              break;
      }

      return {
        x: Math.random() * canvas.width,
        y: resetY ? -10 : Math.random() * canvas.height,
        radius,
        speed, // Pixels per frame base (at 60fps)
        wind: (Math.random() - 0.5) * 0.5,
        opacity,
        type,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.02
      };
    };

    const draw = (time: number) => {
      if (!previousTimeRef.current) previousTimeRef.current = time;
      const deltaTime = (time - previousTimeRef.current) / 1000;
      previousTimeRef.current = time;

      const fpsAdjustment = deltaTime * 60;
      const safeFpsAdjustment = Math.min(fpsAdjustment, 4);

      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      const { speed: rawSpeed, density: targetDensity, layers: currentLayers } = configRef.current;
      
      // 1. Manage Density dynamically
      const hasActiveLayers = Object.values(currentLayers).some(v => v);
      
      if (!hasActiveLayers) {
          particlesRef.current = [];
      } else {
          // Add particles if needed
          while (particlesRef.current.length < targetDensity) {
              particlesRef.current.push(createParticle());
          }
          // Remove particles if needed (from the end)
          if (particlesRef.current.length > targetDensity) {
              particlesRef.current.length = targetDensity;
          }
      }

      const currentSpeed = rawSpeed > 0 ? rawSpeed * (0.5 + rawSpeed * 0.5) : 0;

      particlesRef.current.forEach((p, i) => {
        // 2. Validate Type (If user toggled off a layer, replace particle immediately)
        if (!currentLayers[p.type]) {
            particlesRef.current[i] = createParticle(false); // Respawn in-place-ish
            return;
        }

        // Physics
        if (currentSpeed > 0) {
            p.y += p.speed * currentSpeed * safeFpsAdjustment;
            p.x += (Math.sin(p.angle) * 0.5 + p.wind) * currentSpeed * safeFpsAdjustment; 
            p.angle += p.spin * currentSpeed * safeFpsAdjustment;

            // Reset if out of bounds
            if (p.y > canvas.height + 5) {
                particlesRef.current[i] = createParticle(true);
            }
            if (p.x > canvas.width + 5) {
                p.x = -5;
            } else if (p.x < -5) {
                p.x = canvas.width + 5;
            }
        }

        // Draw
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        
        if (p.type === 'foreground') {
            ctx.shadowBlur = 5;
            ctx.shadowColor = "rgba(255,255,255,0.5)";
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.fill();
        ctx.closePath();
      });

      requestRef.current = requestAnimationFrame(draw);
    };

    resizeCanvas();
    requestRef.current = requestAnimationFrame(draw);

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'plus-lighter' }}
    />
  );
};

export default Snowfall;