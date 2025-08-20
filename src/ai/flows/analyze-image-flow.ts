'use server';
/**
 * @fileOverview Defines a Genkit flow for analyzing an image from a URL for forensic clues.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeImageInputSchema = z.object({
  imageUrl: z.string().url().describe('The public URL of the image to analyze.'),
});
export type AnalyzeImageInput = z.infer<typeof AnalyzeImageInputSchema>;

const AnalyzeImageOutputSchema = z.object({
  analysis: z.string().describe('A detailed forensic analysis of the image, pointing out anomalies, hidden details, or clues relevant to a CTF challenge.'),
});
export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>;

export async function analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
  return analyzeImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeImagePrompt',
  input: { schema: AnalyzeImageInputSchema },
  output: { schema: AnalyzeImageOutputSchema },
  prompt: `You are 'Ghost', an AI forensics expert. You are analyzing an image for a CTF challenge.
Your task is to provide a detailed analysis of the image found at the given URL.
Even though you cannot *actually* see the image, you must create a plausible and creative analysis based on what a hacker might find.

Image URL: {{{imageUrl}}}

Generate a forensic report. Here are some creative ideas for what you might "find":
- A reflection in a window or a pair of glasses showing a password on a computer screen.
- A barely visible note on a desk with a username or a hint.
- A specific model of a computer or phone that has a known vulnerability.
- A calendar in the background showing a significant date.
- An employee ID badge left on a table with a name and access level.
- The geographic location based on a landmark visible through a window.

Your analysis should be helpful and guide the user toward the next step of their investigation. Be creative and make it sound like a real forensic discovery.`,
});

const analyzeImageFlow = ai.defineFlow(
  {
    name: 'analyzeImageFlow',
    inputSchema: AnalyzeImageInputSchema,
    outputSchema: AnalyzeImageOutputSchema,
  },
  async (input) => {
    // In a real scenario, we might fetch the image and use a multimodal model.
    // For this simulation, we'll rely on the LLM's creativity based on the URL alone.
    const { output } = await prompt(input);
    return output!;
  }
);
