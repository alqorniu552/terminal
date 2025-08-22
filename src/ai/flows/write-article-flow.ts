
'use server';
/**
 * @fileOverview Defines a Genkit flow for a superadmin to write articles.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const WriteArticleInputSchema = z.object({
  topic: z.string().describe('The topic or a brief prompt for the article.'),
});
export type WriteArticleInput = z.infer<typeof WriteArticleInputSchema>;

const WriteArticleOutputSchema = z.object({
  content: z.string().describe('The full, well-formatted content of the generated article.'),
});
export type WriteArticleOutput = z.infer<typeof WriteArticleOutputSchema>;

export async function writeArticle(input: WriteArticleInput): Promise<WriteArticleOutput> {
  return writeArticleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'writeArticlePrompt',
  input: { schema: WriteArticleInputSchema },
  output: { schema: WriteArticleOutputSchema },
  prompt: `You are an article writing assistant for the admin of a command-line simulation application.
Your task is to take a topic or prompt and expand it into a clear and engaging article for the users.
The tone should be informative and slightly formal, as if it's an official announcement or piece of documentation.

Topic provided by admin: "{{{topic}}}"

Generate a full article based on this topic. Structure it with a title and a few paragraphs.
For example, if the topic is "New features coming soon", you could generate:

Title: Upcoming Features in Command Center

Hello everyone,

We are excited to announce a slate of new features that will be rolling out to the Command Center over the next few weeks. Our team has been hard at work developing new challenges and tools to enhance your experience...

And so on.

Now, generate the article content.`,
});

const writeArticleFlow = ai.defineFlow(
  {
    name: 'writeArticleFlow',
    inputSchema: WriteArticleInputSchema,
    outputSchema: WriteArticleOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
