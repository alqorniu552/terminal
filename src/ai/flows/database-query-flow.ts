'use server';
/**
 * @fileOverview A database query AI agent.
 *
 * - databaseQuery - A function that handles the database query process.
 * - DatabaseQueryInput - The input type for the databaseQuery function.
 * - DatabaseQueryOutput - The return type for the databaseQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DatabaseQueryInputSchema = z.object({
  query: z.string().describe('The natural language query for the database.'),
});
export type DatabaseQueryInput = z.infer<typeof DatabaseQueryInputSchema>;

const DatabaseQueryOutputSchema = z.object({
  collection: z.string().describe('The collection to query.'),
  // Note: This is a simplified query generator. 
  // For a real app, you would want to support more complex queries.
  where: z.array(z.tuple([z.string(), z.enum(["==", "<", "<=", ">", ">=", "!=", "array-contains", "in", "not-in", "array-contains-any"]), z.string()])).describe('The where clauses for the query.'),
});
export type DatabaseQueryOutput = z.infer<typeof DatabaseQueryOutputSchema>;

export async function databaseQuery(input: DatabaseQueryInput): Promise<DatabaseQueryOutput> {
  return databaseQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'databaseQueryPrompt',
  input: {schema: DatabaseQueryInputSchema},
  output: {schema: DatabaseQueryOutputSchema},
  prompt: `You are a database query assistant. A user has entered a natural language query. Convert it to a structured query.
  
  User query: "{{{query}}}"
  
  You must provide a collection and where clauses. The where clauses must be an array of tuples, where each tuple is [field, operator, value].
  `,
});

const databaseQueryFlow = ai.defineFlow(
  {
    name: 'databaseQueryFlow',
    inputSchema: DatabaseQueryInputSchema,
    outputSchema: DatabaseQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
