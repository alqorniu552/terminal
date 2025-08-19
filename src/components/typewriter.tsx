"use client";

import { useState, useEffect } from 'react';

type TypewriterProps = {
  text: string;
  speed?: number;
  onFinished?: () => void;
  className?: string;
};

const Typewriter = ({ text, speed = 10, onFinished, className }: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (text === null || text === undefined) return;
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (text === null || text === undefined) return;
    
    if (currentIndex < text.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timeoutId);
    } else if (onFinished) {
      const finishTimeout = setTimeout(onFinished, 100);
      return () => clearTimeout(finishTimeout);
    }
  }, [currentIndex, text, speed, onFinished]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: displayedText.replace(/\n/g, '<br/>') }} />;
};

export default Typewriter;
