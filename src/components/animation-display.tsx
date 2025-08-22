
"use client";

import { useState, useEffect } from 'react';
import { animateImage, AnimateImageOutput } from '@/ai/flows/animate-image-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface AnimationDisplayProps {
  imageDataUri: string;
  filename: string;
  onFinished: () => void;
}

const AnimationDisplay = ({ imageDataUri, filename, onFinished }: AnimationDisplayProps) => {
  const [result, setResult] = useState<AnimateImageOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(`Animating ${filename}...`);
  const { toast } = useToast();

  useEffect(() => {
    const generate = async () => {
      try {
        setStatus(`Initializing animation sequence for ${filename}... this may take a moment.`);
        const output = await animateImage({ imageDataUri });
        setResult(output);
      } catch (e: any)      {
        console.error("Animation generation error:", e);
        const errorMessage = e.message || "An unknown error occurred during animation generation.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Animation Failed",
          description: errorMessage,
        });
      } finally {
        onFinished();
      }
    };
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUri]);

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  if (!result) {
    return (
        <div className="flex flex-col space-y-2 py-2">
            <p>{status}</p>
            <Skeleton className="h-64 w-[35rem] rounded-md" />
        </div>
    );
  }

  return (
    <div className="py-2">
      <p>Animation sequence complete for: "{filename}"</p>
      <video
        src={result.videoUrl}
        controls
        autoPlay
        loop
        muted
        className="mt-2 rounded-md border max-w-md"
      />
    </div>
  );
};

export default AnimationDisplay;
