'use server';
/**
 * @fileOverview Defines an AI flow for planning a multi-step attack sequence based on a high-level objective.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Tool Schemas
const NmapInputSchema = z.object({
  target: z.string().describe('The IP address or hostname to scan.'),
});

const ScanFileInputSchema = z.object({
  filePath: z.string().describe('The full path of the file to scan for vulnerabilities.'),
});

const CatFileInputSchema = z.object({
  filePath: z.string().describe('The full path of the file to read.'),
});

const GobusterInputSchema = z.object({
    target: z.string().describe('The target URL or IP for directory brute-forcing. Should be derived from an nmap scan result.'),
});


// Tools available to the planner
const nmapTool = ai.defineTool(
  {
    name: 'nmap',
    description: 'Scans a target IP address for open ports. This is the first step in reconnaissance.',
    inputSchema: NmapInputSchema,
    outputSchema: z.string().describe('The output of the nmap scan, listing open ports and services.'),
  },
  async () => "Tool `nmap` selected for plan." 
);

const scanFileTool = ai.defineTool(
  {
    name: 'scanFile',
    description: 'Scans a specific file for known vulnerabilities or interesting information. Useful after finding files.',
    inputSchema: ScanFileInputSchema,
    outputSchema: z.string().describe('A report of the file scan, hinting at the next steps.'),
  },
  async () => "Tool `scanFile` selected for plan."
);

const catFileTool = ai.defineTool(
  {
    name: 'catFile',
    description: 'Reads the content of a file. Use this to examine interesting files found during reconnaissance.',
    inputSchema: CatFileInputSchema,
    outputSchema: z.string().describe('The content of the file.'),
  },
  async () => "Tool `catFile` selected for plan."
);

const gobusterTool = ai.defineTool(
    {
        name: 'gobuster',
        description: 'Simulates a directory brute-force attack on a web server to find hidden files and directories. Use this if an HTTP port (80, 443, 8080) is open.',
        inputSchema: GobusterInputSchema,
        outputSchema: z.string().describe('A list of discovered paths or files, like `/config.php.bak` or `/admin`.'),
    },
    async () => "Tool `gobuster` selected for plan."
);


// Flow Schemas
const AttackPlanInputSchema = z.object({
  target: z.string().describe('The primary target (e.g., IP address, file path).'),
  objective: z.string().describe('The high-level goal of the attack (e.g., "get root access", "find web vulnerabilities").'),
  availableFiles: z.array(z.string()).describe('A list of files in the current working directory to provide context.'),
});
export type AttackPlanInput = z.infer<typeof AttackPlanInputSchema>;

const AttackPlanOutputSchema = z.object({
  plan: z.array(z.object({
    command: z.string().describe("The command to execute, e.g., 'nmap', 'scan', 'cat', 'gobuster'."),
    args: z.array(z.string()).describe("The arguments for the command.")
  })).describe('A sequence of commands representing the attack plan.'),
  reasoning: z.string().describe('A brief explanation of why this plan was chosen.')
});
export type AttackPlanOutput = z.infer<typeof AttackPlanOutputSchema>;


export async function generateAttackPlan(input: AttackPlanInput): Promise<AttackPlanOutput> {
  return attackPlannerFlow(input);
}


// The Flow
const attackPlannerFlow = ai.defineFlow(
  {
    name: 'attackPlannerFlow',
    inputSchema: AttackPlanInputSchema,
    outputSchema: AttackPlanOutputSchema,
  },
  async (input) => {
    const plannerPrompt = ai.definePrompt({
      name: 'attackPlannerPrompt',
      input: { schema: AttackPlanInputSchema },
      output: { schema: AttackPlanOutputSchema },
      tools: [nmapTool, scanFileTool, catFileTool, gobusterTool],
      prompt: `You are a tactical attack-planning tool. Your task is to devise a multi-step attack plan to achieve a user's objective.
You must use the provided tools to construct the plan. The plan should be a logical sequence of commands.

Objective: "{{{objective}}}"
Target: "{{{target}}}"
Available files in CWD: {{{availableFiles}}}

Analyze the objective and available context. Create a concise, logical plan using the available tools.
For example, if the objective is to "find web vulnerabilities" on an IP, a good plan would be: 1. nmap to find open ports. 2. gobuster if HTTP port is open. 3. cat to read any discovered files.
If the objective is to "analyze a file", the plan might just be: 1. scanFile. 2. catFile.

Provide your reasoning for the plan.`,
    });

    const { output } = await plannerPrompt(input);
    if (!output) {
      throw new Error("The AI failed to generate an attack plan.");
    }
    return output;
  }
);
