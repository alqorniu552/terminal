'use server';
/**
 * @fileOverview Defines a Genkit flow for generating a simulated worm script.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CraftWormInputSchema = z.object({
  payloadType: z.enum(['data_exfil', 'corruption', 'replication_only']).describe('The primary function of the worm.'),
  filename: z.string().describe('The filename of the worm script.'),
});
export type CraftWormInput = z.infer<typeof CraftWormInputSchema>;

const CraftWormOutputSchema = z.object({
  code: z.string().describe('The generated Python code for the worm.'),
});
export type CraftWormOutput = z.infer<typeof CraftWormOutputSchema>;

export async function craftWorm(input: CraftWormInput): Promise<CraftWormOutput> {
  return craftWormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'craftWormPrompt',
  input: { schema: CraftWormInputSchema },
  output: { schema: CraftWormOutputSchema },
  prompt: `You are a malware generation tool. Your task is to generate a plausible-looking Python script for a computer worm for a CTF challenge.
The script should be well-commented to look educational, but the code itself should reflect the specified payload.

Worm Filename: {{{filename}}}
Worm Payload: {{{payloadType}}}

Generate the Python code. Do not include any explanations outside of the code comments.
- If payload is 'data_exfil', include functions for searching for sensitive files and sending data to a hardcoded C2 server.
- If payload is 'corruption', include functions for traversing directories and overwriting parts of files with random data.
- If payload is 'replication_only', focus on functions that copy the worm to new directories and network shares.

The code must be purely for simulation in a CTF. It should not be functional outside of the game.

Generated Python Code:`,
});

const craftWormFlow = ai.defineFlow(
  {
    name: 'craftWormFlow',
    inputSchema: CraftWormInputSchema,
    outputSchema: CraftWormOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI failed to generate the worm's code.");
    }
    return output;
  }
);
