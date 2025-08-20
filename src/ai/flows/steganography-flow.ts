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

// This is a simplified simulation. A real implementation would use a more sophisticated model or library.
// We'll embed the message in a way that's not visible but is reversible. We'll use a simple marker and Base64 encoding.
const SECRET_MARKER = '::SECRET::';

// Conceal Flow
const concealMessageFlow = ai.defineFlow(
  {
    name: 'concealMessageFlow',
    inputSchema: ConcealMessageInputSchema,
    outputSchema: ConcealMessageOutputSchema,
  },
  async ({ imageDataUri, message }) => {
    // We append the message to the data URI payload.
    // This is a simulation and doesn't truly embed it in the image pixels.
    const b64Marker = ';base64,';
    const markerIndex = imageDataUri.indexOf(b64Marker);
    if (markerIndex === -1) {
        throw new Error("Invalid Data URI format for concealing message.");
    }
    
    // First, let's remove any pre-existing secret to avoid duplication
    let basePart = imageDataUri;
    const existingSecretIndex = imageDataUri.lastIndexOf(SECRET_MARKER);
    if (existingSecretIndex > markerIndex) {
        basePart = imageDataUri.substring(0, existingSecretIndex);
    }
    
    const secretPayload = `${SECRET_MARKER}${Buffer.from(message).toString('base64')}`;
    const newImageDataUri = basePart + secretPayload;
    
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
    try {
      const secretMarkerIndex = imageDataUri.lastIndexOf(SECRET_MARKER);

      if (secretMarkerIndex !== -1) {
        const extractedMessageBase64 = imageDataUri.substring(secretMarkerIndex + SECRET_MARKER.length);
        const revealedMessage = Buffer.from(extractedMessageBase64, 'base64').toString('utf-8');
        return { revealedMessage };
      }

    } catch (e) {
      console.error("Reveal error:", e);
    }

    return { revealedMessage: 'No message found.' };
  }
);