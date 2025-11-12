import React, { useRef, useEffect } from 'react';
import '../styles/SignUp.css';

const Captcha = ({ onCaptchaChange }) => {
  const canvasRef = useRef(null);
  const captchaRef = useRef('');

  const generateCaptcha = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let generatedCaptcha = "";

    // Generate random string
    for (let i = 0; i < 6; i++) {
      generatedCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    captchaRef.current = generatedCaptcha;
    if (onCaptchaChange) onCaptchaChange(generatedCaptcha);

    // Draw captcha
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px Verdana";
    ctx.fillStyle = "#333";

    for (let i = 0; i < generatedCaptcha.length; i++) {
      const letter = generatedCaptcha[i];
      const angle = (Math.random() - 0.5) * 0.4;
      ctx.save();
      ctx.translate(15 + i * 18, 30);
      ctx.rotate(angle);
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    }

    // Add noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(0,0,0,${Math.random()})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  return (
    <div className="captcha-section">
      <canvas 
        ref={canvasRef} 
        id="captcha-canvas" 
        width="130" 
        height="40"
      ></canvas>
      <button 
        type="button" 
        id="refresh-captcha" 
        onClick={generateCaptcha}
      >
        ↻
      </button>
    </div>
  );
};

export default Captcha;