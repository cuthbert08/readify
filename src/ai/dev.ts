
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-pdf.ts';
import '@/ai/flows/voice-selection.ts';
import '@/ai/flows/preview-speech.ts';
import '@/ai/flows/chat-with-pdf.ts';
import '@/ai/flows/glossary-flow.ts';
import '@/ai/flows/quiz-flow.ts';
import '@/ai/flows/clean-text-flow.ts';
import '@/ai/flows/generate-speech.ts';
import '@/ai/flows/format-text-for-speech.ts';
import '@/ai/flows/quiz-feedback-flow.ts';
import '@/ai/flows/speech-generation/amazon.ts';
import '@/ai/flows/speech-generation/openai.ts';
