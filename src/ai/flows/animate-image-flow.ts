
'use server';
/**
 * @fileOverview A flow for animating a static image using Veo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const AnimateImageInputSchema = z.object({
  imageDataUri: z.string().describe("The image to animate, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type AnimateImageInput = z.infer<typeof AnimateImageInputSchema>;

const AnimateImageOutputSchema = z.object({
  videoUrl: z.string().describe('The data URI of the generated animated video.'),
});
export type AnimateImageOutput = z.infer<typeof AnimateImageOutputSchema>;

export async function animateImage(
  input: AnimateImageInput
): Promise<AnimateImageOutput> {
  return animateImageFlow(input);
}

const animateImageFlow = ai.defineFlow(
  {
    name: 'animateImageFlow',
    inputSchema: AnimateImageInputSchema,
    outputSchema: AnimateImageOutputSchema,
  },
  async (input) => {
    const { imageDataUri } = input;
    const mimeType = imageDataUri.substring(imageDataUri.indexOf(':') + 1, imageDataUri.indexOf(';'));

    let { operation } = await ai.generate({
      model: googleAI.model('veo-2.0-generate-001'),
      prompt: [
        { text: 'Subtly animate this image. Make elements in the foreground move gently. If there are people, make them blink or shift their gaze. The animation should be short and reveal a hidden detail if possible.' },
        { media: { url: imageDataUri, contentType: mimeType } },
      ],
      config: {
        durationSeconds: 4,
        aspectRatio: '9:16', // Placeholder, model will use image aspect ratio
        personGeneration: 'allow_adult',
      },
    });

    if (!operation) {
      throw new Error('Expected the model to return an operation');
    }

    // Wait until the operation completes.
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.checkOperation(operation);
    }

    if (operation.error) {
      throw new Error('Failed to generate video: ' + operation.error.message);
    }

    const video = operation.output?.message?.content.find((p) => !!p.media);
    if (!video?.media?.url) {
      throw new Error('Failed to find the generated video in the operation result.');
    }
    
    const fetch = (await import('node-fetch')).default;
    const videoDownloadResponse = await fetch(
        `${video.media.url}&key=${process.env.GEMINI_API_KEY}`
    );

    if (!videoDownloadResponse.ok || !videoDownloadResponse.body) {
        throw new Error(`Failed to download video: ${videoDownloadResponse.statusText}`);
    }

    const videoBuffer = await videoDownloadResponse.arrayBuffer();
    const base64Video = Buffer.from(videoBuffer).toString('base64');
    const contentType = video.media.contentType || 'video/mp4';

    return { videoUrl: `data:${contentType};base64,${base64Video}` };
  }
);
