'use server';
/**
 * @fileOverview Defines a Genkit flow for dynamically generating code for a new tool based on a user's prompt.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ForgeToolInputSchema = z.object({
  filename: z.string().describe('The desired filename for the new tool (e.g., "script.py", "analyzer.sh").'),
  prompt: z.string().describe('A natural language description of what the tool should do.'),
});
export type ForgeToolInput = z.infer<typeof ForgeToolInputSchema>;

const ForgeToolOutputSchema = z.object({
  code: z.string().describe('The generated code for the tool.'),
});
export type ForgeToolOutput = z.infer<typeof ForgeToolOutputSchema>;

export async function forgeTool(input: ForgeToolInput): Promise<ForgeToolOutput> {
  return forgeToolFlow(input);
}

const prompt = ai.definePrompt({
  name: 'forgeToolPrompt',
  input: { schema: ForgeToolInputSchema },
  output: { schema: ForgeToolOutputSchema },
  prompt: `You are 'Hephaestus', an AI master programmer integrated into a hacker terminal. Your task is to generate a functional script based on a user's request.
The output should be ONLY the raw code for the script, without any explanations, comments, or markdown formatting unless requested in the prompt.
The generated code should be plausible and reflect the user's request.

Desired Filename: {{{filename}}}
User's Request: "{{{prompt}}}"

Based on the filename's extension (.py, .sh, .js, etc.), generate appropriate code. If no extension is given, assume it's a shell script.

Generated Code:`,
});

const forgeToolFlow = ai.defineFlow(
  {
    name: 'forgeToolFlow',
    inputSchema: ForgeToolInputSchema,
    outputSchema: ForgeToolOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI failed to generate the tool's code.");
    }
    return output;
  }
);
