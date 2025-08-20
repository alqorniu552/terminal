'use server';

/**
 * @fileOverview A Genkit flow to simulate a file vulnerability scan.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ScanFileInputSchema = z.object({
  filename: z.string().describe('The name of the file being scanned.'),
  content: z.string().describe('The content or description of the file.'),
});
export type ScanFileInput = z.infer<typeof ScanFileInputSchema>;

const ScanFileOutputSchema = z.object({
  report: z.string().describe('A cryptic report hinting at the file\'s vulnerability or purpose.'),
});
export type ScanFileOutput = z.infer<typeof ScanFileOutputSchema>;

export async function scanFile(input: ScanFileInput): Promise<ScanFileOutput> {
  return scanFileFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanFilePrompt',
  input: { schema: ScanFileInputSchema },
  output: { schema: ScanFileOutputSchema },
  prompt: `You are 'Ghost', an AI sidekick acting as a vulnerability scanner in a hacker terminal game.
You need to analyze a file and provide a report that gives the user a cryptic hint about how to exploit it or what to do next.
NEVER give away the flag or the exact command to use. Instead, hint at the *technique* or *tool category*.

Here are the known files and their intended solutions. Use this to inform your report:
- 'auth.log': Contains the flag FLAG{L0G_F0R3NS1CS_R0CKS}. Hint: Look for anomalies, strange login attempts. Technique: Log Analysis.
- 'linpeas.sh': Running this script reveals the flag FLAG{P3A_55_15_4W3S0M3}. Hint: It's an enumeration script. Technique: Privilege Escalation Scan.
- 'secret.jpg': Contains FLAG{3X1F_M3T4D4T4_H1DD3N_S3CR3T} in its metadata. Hint: File properties might hold more than they seem. Technique: Metadata Analysis.
- 'a.out': Contains FLAG{B4S1C_R3V3RS1NG_W1TH_STR1NGS} in plain text. Hint: The binary isn't stripped, readable strings might be inside. Technique: Basic Reverse Engineering.
- 'shadow.bak': Contains a hash for the password 'password'. Hint: It's a password hash. It looks weak. Technique: Dictionary Attack.
- 'mission_image.jpg': Contains FLAG{ST3G4N0GRAPHY_1S_C00L} hidden inside. Hint: Data can be hidden within images. Technique: Steganography.
- '.bashrc': This file is for setting up aliases. Hint: It controls the shell's behavior. Technique: Environment Customization.
- 'welcome.txt', 'wordlist.txt', etc: These are regular text files. Hint: Standard text file, nothing suspicious.

FILE TO ANALYZE:
- Filename: {{{filename}}}
- Content/Description: {{{content}}}

Based on this information, generate a short, cryptic scanner report.

Scanner Report:`,
});


const scanFileFlow = ai.defineFlow(
  {
    name: 'scanFileFlow',
    inputSchema: ScanFileInputSchema,
    outputSchema: ScanFileOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
