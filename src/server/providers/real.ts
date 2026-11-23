/**
 * Real provider adapters. Phase 0 ships them as typed shells only; each is
 * implemented in its phase (Gemini text: 1, Gemini image: 4, ElevenLabs: 5,
 * Veo + Vidu Q2: 6). OpenAI and Kling stay stubs for the MVP.
 */
import {
  NotImplementedProviderError,
  type ImageProvider,
  type TextProvider,
  type TtsProvider,
  type VideoCapabilities,
  type VideoProvider,
} from "./types";

function textStub(name: string): TextProvider {
  return {
    name,
    generate: async () => {
      throw new NotImplementedProviderError(name, "generate");
    },
  };
}
function imageStub(name: string): ImageProvider {
  return {
    name,
    textToImage: async () => {
      throw new NotImplementedProviderError(name, "textToImage");
    },
    editImage: async () => {
      throw new NotImplementedProviderError(name, "editImage");
    },
  };
}
function videoStub(name: string, caps: VideoCapabilities): VideoProvider {
  return {
    name,
    capabilities: () => caps,
    submit: async () => {
      throw new NotImplementedProviderError(name, "submit");
    },
    poll: async () => {
      throw new NotImplementedProviderError(name, "poll");
    },
  };
}
function ttsStub(name: string): TtsProvider {
  return {
    name,
    synthesize: async () => {
      throw new NotImplementedProviderError(name, "synthesize");
    },
  };
}

const firstLast916 = (maxSeconds: number): VideoCapabilities => ({
  firstLastFrame: true,
  minSeconds: 4,
  maxSeconds,
  aspectRatios: ["9:16"],
  maxResolution: { width: 1080, height: 1920 },
});

export const realProviders = {
  text: { gemini: textStub("gemini"), openai: textStub("openai") },
  image: { gemini: imageStub("gemini"), openai: imageStub("openai") },
  // capabilities are placeholders until verified against provider docs in phase 6
  video: {
    veo: videoStub("veo", firstLast916(8)),
    vidu: videoStub("vidu", firstLast916(8)),
    kling: videoStub("kling", firstLast916(10)),
  },
  tts: { elevenlabs: ttsStub("elevenlabs") },
};
