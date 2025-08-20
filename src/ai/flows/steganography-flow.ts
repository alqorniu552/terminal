'use server';
/**
 * @fileOverview A flow for embedding and revealing secret messages in images using AI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input for concealing a message
const ConcealMessageInputSchema = z.object({
  imageDataUri: z.string().describe("The original image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  message: z.string().describe('The secret message to hide in the image.'),
});
export type ConcealMessageInput = z.infer<typeof ConcealMessageInputSchema>;

// Output for concealing a message (the new image)
const ConcealMessageOutputSchema = z.object({
  newImageDataUri: z.string().describe('The new image with the secret message embedded, as a data URI.'),
});
export type ConcealMessageOutput = z.infer<typeof ConcealMessageOutputSchema>;

// Input for revealing a message
const RevealMessageInputSchema = z.object({
  imageDataUri: z.string().describe("An image that may contain a secret message, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type RevealMessageInput = z.infer<typeof RevealMessageInputSchema>;

// Output for revealing a message
const RevealMessageOutputSchema = z.object({
  revealedMessage: z.string().describe('The secret message found in the image, or a "No message found." string.'),
});
export type RevealMessageOutput = z.infer<typeof RevealMessageOutputSchema>;

// Exported function for concealing
export async function concealMessage(input: ConcealMessageInput): Promise<ConcealMessageOutput> {
  return concealMessageFlow(input);
}

// Exported function for revealing
export async function revealMessage(input: RevealMessageInput): Promise<RevealMessageOutput> {
  return revealMessageFlow(input);
}

// Conceal Flow
const concealMessageFlow = ai.defineFlow(
  {
    name: 'concealMessageFlow',
    inputSchema: ConcealMessageInputSchema,
    outputSchema: ConcealMessageOutputSchema,
  },
  async ({ imageDataUri, message }) => {
    // This is a simplified simulation. A real implementation would use a more sophisticated model or library.
    // We'll append the message to the end of the data URI, base64 encoded.
    const secretPayload = `::secret::${Buffer.from(message).toString('base64')}`;
    const newImageDataUri = imageDataUri + Buffer.from(secretPayload).toString('base64');
    
    return { newImageDataUri };
  }
);

// Reveal Flow
const revealMessageFlow = ai.defineFlow(
  {
    name: 'revealMessageFlow',
    inputSchema: RevealMessageInputSchema,
    outputSchema: RevealMessageOutputSchema,
  },
  async ({ imageDataUri }) => {
    // This is a simplified simulation to match the conceal flow.
    try {
      const b64Marker = ';base64,';
      const b64StartIndex = imageDataUri.indexOf(b64Marker);
      if (b64StartIndex === -1) {
        return { revealedMessage: 'No message found.' };
      }

      // Find our appended secret payload
      const potentialPayload = imageDataUri.substring(b64StartIndex + b64Marker.length);
      const decodedPayload = Buffer.from(potentialPayload, 'base64').toString('utf-8');

      const secretMarker = '::secret::';
      const secretMarkerIndex = decodedPayload.lastIndexOf(secretMarker);

      if (secretMarkerIndex !== -1) {
        const extractedMessageBase64 = decodedPayload.substring(secretMarkerIndex + secretMarker.length);
        const revealedMessage = Buffer.from(extractedMessageBase64, 'base64').toString('utf-8');
        return { revealedMessage };
      }

    } catch (e) {
      // Ignore errors, just means no message found
      console.error("Reveal error:", e);
    }

    return { revealedMessage: 'No message found.' };
  }
);
