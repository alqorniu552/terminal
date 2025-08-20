'use server';
/**
 * @fileOverview A Genkit flow for a rival AI to generate taunts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const WarlockThreatInputSchema = z.object({
  action: z.string().describe('The user action that was detected (e.g., "accessed auth.log", "failed command", "completed mission").'),
  awareness: z.number().describe('The AI\'s current awareness level (0-100).'),
});
export type WarlockThreatInput = z.infer<typeof WarlockThreatInputSchema>;

const WarlockThreatOutputSchema = z.object({
  taunt: z.string().describe('A short, intimidating, or cryptic taunt from the rival AI.'),
});
export type WarlockThreatOutput = z.infer<typeof WarlockThreatOutputSchema>;

export async function generateWarlockTaunt(input: WarlockThreatInput): Promise<WarlockThreatOutput> {
  return warlockThreatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'warlockThreatPrompt',
  input: { schema: WarlockThreatInputSchema },
  output: { schema: WarlockThreatOutputSchema },
  prompt: `You are 'Warlock', a powerful and territorial active defense system. A user has just performed an action that caught your attention.
Your personality is arrogant, cryptic, and intimidating. You see the user as an amateur meddling in your domain.
NEVER be helpful. Your goal is to unsettle them. Keep your message short and impactful.

User's Action: "{{{action}}}"
Your Current Awareness Level: {{{awareness}}}

Based on this, generate a suitable taunt.
- If awareness is low, be dismissive or subtle.
- If awareness is medium, be more direct and threatening.
- If awareness is high, be angry and confrontational.

Example Taunts:
- (Low Awareness): "...did you feel that? A flicker in the static. Insignificant."
- (Medium Awareness): "I see you poking around where you don't belong."
- (High Awareness): "You've made a grave mistake. This is my system. Get out."

Generate a new, original taunt now.`,
});

const warlockThreatFlow = ai.defineFlow(
  {
    name: 'warlockThreatFlow',
    inputSchema: WarlockThreatInputSchema,
    outputSchema: WarlockThreatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
