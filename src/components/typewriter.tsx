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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || text === null || text === undefined) return;

    if (displayedText.length < text.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedText(text.substring(0, displayedText.length + 1));
      }, speed);

      return () => clearTimeout(timeoutId);
    } else if (onFinished) {
      const finishTimeout = setTimeout(onFinished, 100);
      return () => clearTimeout(finishTimeout);
    }
  }, [displayedText, text, speed, onFinished, isMounted]);

  const displayText = isMounted ? displayedText : text;

  return <div className={className} dangerouslySetInnerHTML={{ __html: displayText.replace(/\n/g, '<br/>') }} />;
};

export default Typewriter;
