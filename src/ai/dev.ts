
'use server';

import { config } from 'dotenv';
config();

import '@/ai/flows/generate-command-help.ts';
import '@/ai/flows/database-query-flow.ts';
import '@/ai/flows/ai-sidekick-flow.ts';
import '@/ai/flows/scan-file-flow.ts';
import '@/ai/flows/warlock-threat-flow.ts';
import '@/ai/flows/steganography-flow.ts';
import '@/ai/flows/osint-investigation-flow.ts';
import '@/ai/flows/craft-phish-flow.ts';
import '@/ai/flows/analyze-image-flow.ts';
import '@/ai/flows/forge-tool-flow.ts';
import '@/ai/flows/generate-image-flow.ts';
import '@/ai/flows/generate-video-flow.ts';
import '@/ai/flows/animate-image-flow.ts';
