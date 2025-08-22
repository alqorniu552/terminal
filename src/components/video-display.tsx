"use client";

import { useState, useEffect } from 'react';
import { generateVideo, GenerateVideoOutput } from '@/ai/flows/generate-video-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface VideoDisplayProps {
  prompt: string;
  onFinished: () => void;
}

const VideoDisplay = ({ prompt, onFinished }: VideoDisplayProps) => {
  const [result, setResult] = useState<GenerateVideoOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Generating video metadata...');
  const { toast } = useToast();

  useEffect(() => {
    const generate = async () => {
      try {
        // This process can take a while, we might add more status updates later
        setStatus('Generating video... this may take up to a minute.');
        const output = await generateVideo({ prompt });
        setResult(output);
      } catch (e: any)      {
        console.error("Video generation error:", e);
        const errorMessage = e.message || "An unknown error occurred during video generation.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Video Generation Failed",
          description: errorMessage,
        });
      } finally {
        onFinished();
      }
    };
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

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
      <p>Result for: "{prompt}"</p>
      <video
        src={result.videoUrl}
        controls
        className="mt-2 rounded-md border max-w-md"
      />
    </div>
  );
};

export default VideoDisplay;
