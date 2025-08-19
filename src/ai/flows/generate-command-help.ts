'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating help messages for unrecognized commands.
 *
 * The flow uses an LLM to generate helpful messages explaining the command's purpose and suggesting valid alternatives.
 *
 * @module src/ai/flows/generate-command-help
 *
 * @exports generateCommandHelp - A function that calls the generateCommandHelpFlow.
 * @exports GenerateCommandHelpInput - The input type for the generateCommandHelp function.
 * @exports GenerateCommandHelpOutput - The return type for the generateCommandHelp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCommandHelpInputSchema = z.object({
  command: z.string().describe('The unrecognized command entered by the user.'),
});

export type GenerateCommandHelpInput = z.infer<typeof GenerateCommandHelpInputSchema>;

const GenerateCommandHelpOutputSchema = z.object({
  helpMessage: z.string().describe('A helpful message explaining the command and suggesting alternatives.'),
});

export type GenerateCommandHelpOutput = z.infer<typeof GenerateCommandHelpOutputSchema>;

export async function generateCommandHelp(input: GenerateCommandHelpInput): Promise<GenerateCommandHelpOutput> {
  return generateCommandHelpFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCommandHelpPrompt',
  input: {schema: GenerateCommandHelpInputSchema},
  output: {schema: GenerateCommandHelpOutputSchema},
  prompt: `You are a command-line interface assistant. A user has entered an unrecognized command. Generate a helpful message explaining the command's purpose and suggesting valid alternatives.

Unrecognized command: "{{{command}}}"

Helpful message:`, 
});

const generateCommandHelpFlow = ai.defineFlow(
  {
    name: 'generateCommandHelpFlow',
    inputSchema: GenerateCommandHelpInputSchema,
    outputSchema: GenerateCommandHelpOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
