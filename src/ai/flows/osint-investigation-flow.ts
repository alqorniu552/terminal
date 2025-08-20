'use server';
/**
 * @fileOverview Defines a Genkit flow for simulating an OSINT (Open-Source Intelligence) investigation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OsintInvestigationInputSchema = z.object({
  target: z.string().describe('The target to investigate (e.g., an email address, username, or company name).'),
});
export type OsintInvestigationInput = z.infer<typeof OsintInvestigationInputSchema>;

const OsintInvestigationOutputSchema = z.object({
  report: z.string().describe('A detailed OSINT report containing plausible findings about the target.'),
});
export type OsintInvestigationOutput = z.infer<typeof OsintInvestigationOutputSchema>;

export async function investigateTarget(input: OsintInvestigationInput): Promise<OsintInvestigationOutput> {
  return osintInvestigationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'osintInvestigationPrompt',
  input: { schema: OsintInvestigationInputSchema },
  output: { schema: OsintInvestigationOutputSchema },
  prompt: `You are an OSINT (Open-Source Intelligence) gathering tool. You are conducting an investigation on a target for a CTF challenge.
Your task is to generate a realistic-sounding intelligence report based on the provided target.

Target: "{{{target}}}"

Generate a plausible OSINT report. The report should be creative and provide useful (but fictional) information that could be used in a hacking challenge. Here are some ideas for what you could "find":
- Associated usernames on different platforms (GitHub, Twitter, forums).
- Leaked password hashes from a "previous data breach".
- Personal details mentioned in public posts (pet's name, city of birth, interests).
- Connections to other employees or a company's tech stack revealed in public code repositories.
- A personal blog with more information.

The goal is to create a report that feels authentic and provides the user with clues for the next steps, like social engineering, password guessing, or identifying technologies to attack.

OSINT Report:`,
});

const osintInvestigationFlow = ai.defineFlow(
  {
    name: 'osintInvestigationFlow',
    inputSchema: OsintInvestigationInputSchema,
    outputSchema: OsintInvestigationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
