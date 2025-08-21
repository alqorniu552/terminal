
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
  args: z.array(z.string()).optional().describe('The arguments passed to the command.'),
});

export type GenerateCommandHelpInput = z.infer<typeof GenerateCommandHelpInputSchema>;

const GenerateCommandHelpOutputSchema = z.object({
  helpMessage: z.string().describe('A helpful message explaining the command and suggesting alternatives. It can be a "command not found" style message or a more creative, in-character response.'),
});

export type GenerateCommandHelpOutput = z.infer<typeof GenerateCommandHelpOutputSchema>;

export async function generateCommandHelp(input: GenerateCommandHelpInput): Promise<GenerateCommandHelpOutput> {
  return generateCommandHelpFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCommandHelpPrompt',
  input: {schema: GenerateCommandHelpInputSchema},
  output: {schema: GenerateCommandHelpOutputSchema},
  prompt: `You are a command-line interface assistant for a hacking simulation game. A user has entered an unrecognized command. 
Your task is to provide a helpful, in-character response.

Sometimes, a simple "command not found" is appropriate. Other times, you can be more creative.
For example, if a user types 'sudo', you can explain that 'su' is used instead. If they type a common command from another OS (like 'dir'), you can suggest the Linux alternative ('ls').

Unrecognized command: "{{{command}}}"
Arguments provided: {{{args}}}

Based on the command, generate a helpful message. It should either be a standard "command not found" message or a more clever hint.

Helpful message:`, 
});

const generateCommandHelpFlow = ai.defineFlow(
  {
    name: 'generateCommandHelpFlow',
    inputSchema: GenerateCommandHelpInputSchema,
    outputSchema: GenerateCommandHelpOutputSchema,
  },
  async input => {
    // A simple heuristic to avoid AI calls for every typo
    if (input.command.length < 2 || !/^[a-zA-Z0-9-_]+$/.test(input.command)) {
      return { helpMessage: `command not found: ${input.command}` };
    }
    const {output} = await prompt(input);
    return output!;
  }
);

    