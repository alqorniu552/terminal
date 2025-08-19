"use client";

import { useState, useEffect } from 'react';
import { generateImage, GenerateImageOutput } from '@/ai/flows/generate-image-flow';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

interface ImageDisplayProps {
  prompt: string;
  onFinished: () => void;
}

const ImageDisplay = ({ prompt, onFinished }: ImageDisplayProps) => {
  const [result, setResult] = useState<GenerateImageOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const generate = async () => {
      try {
        const output = await generateImage({ prompt });
        setResult(output);
      } catch (e: any) {
        console.error("Image generation error:", e);
        const errorMessage = e.message || "An unknown error occurred during image generation.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Image Generation Failed",
          description: errorMessage,
        });
      } finally {
        onFinished();
      }
    };
    generate();
  }, [prompt, onFinished, toast]);

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  if (!result) {
    return (
        <div className="flex flex-col space-y-2 py-2">
            <p>Generating image for: "{prompt}"...</p>
            <Skeleton className="h-64 w-64 rounded-md" />
        </div>
    );
  }

  return (
    <div className="py-2">
      <p>Result for: "{prompt}"</p>
      <Image
        src={result.imageUrl}
        alt={prompt}
        width={256}
        height={256}
        className="mt-2 rounded-md border"
      />
    </div>
  );
};

export default ImageDisplay;
