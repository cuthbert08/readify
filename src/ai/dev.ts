import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-pdf.ts';
import '@/ai/flows/voice-selection.ts';
import '@/ai/flows/tts-flow.ts';
import '@/ai/flows/preview-speech.ts';
import '@/ai/flows/chat-with-pdf.ts';
