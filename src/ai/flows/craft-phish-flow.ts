'use server';
/**
 * @fileOverview Defines a Genkit flow for crafting a convincing phishing email for a social engineering challenge.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CraftPhishInputSchema = z.object({
  targetEmail: z.string().email().describe('The email address of the target.'),
  topic: z.string().describe('The subject or topic of the phishing email (e.g., "Account Security Update").'),
  context: z.string().optional().describe('Optional context about the target from an OSINT investigation, like their name, interests, or recent activities.'),
});
export type CraftPhishInput = z.infer<typeof CraftPhishInputSchema>;

const CraftPhishOutputSchema = z.object({
  phishingEmail: z.string().describe('The full text of the crafted phishing email, including headers (To, From, Subject) and a persuasive body.'),
});
export type CraftPhishOutput = z.infer<typeof CraftPhishOutputSchema>;

export async function craftPhish(input: CraftPhishInput): Promise<CraftPhishOutput> {
  return craftPhishFlow(input);
}

const prompt = ai.definePrompt({
  name: 'craftPhishPrompt',
  input: { schema: CraftPhishInputSchema },
  output: { schema: CraftPhishOutputSchema },
  prompt: `You are 'Ghost', a master of social engineering. Your task is to craft a highly convincing phishing email for a CTF challenge.
The email should be tailored to the target and topic provided.

Target Email: {{{targetEmail}}}
Email Topic: "{{{topic}}}"
{{#if context}}
OSINT Context on Target: {{{context}}}
Use this context to make the email more personal and believable. For example, mention a recent project, a known colleague, or a personal interest.
{{/if}}

Generate the full email text. It should look professional and legitimate, designed to trick the target into taking an action (like clicking a link or revealing information).
Make the sender's email address look plausible (e.g., 'security-alerts@company-domain.com').

Craft the email now.`,
});

const craftPhishFlow = ai.defineFlow(
  {
    name: 'craftPhishFlow',
    inputSchema: CraftPhishInputSchema,
    outputSchema: CraftPhishOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
