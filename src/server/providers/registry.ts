import { env } from "@/server/env";
import { MockImageProvider, MockTextProvider, MockTtsProvider, MockVideoProvider } from "./mock";
import { realProviders } from "./real";
import type { ImageProvider, TextProvider, TtsProvider, VideoProvider } from "./types";

export type TextProviderName = keyof typeof realProviders.text;
export type ImageProviderName = keyof typeof realProviders.image;
export type VideoProviderName = keyof typeof realProviders.video;
export type TtsProviderName = keyof typeof realProviders.tts;

let mocks:
  | { text: TextProvider; image: ImageProvider; video: VideoProvider; tts: TtsProvider }
  | undefined;
function mockSet() {
  mocks ??= {
    text: new MockTextProvider(),
    image: new MockImageProvider(),
    video: new MockVideoProvider(),
    tts: new MockTtsProvider(),
  };
  return mocks;
}

/** Resolve a provider; MOCK_MODE=true always returns the offline mock. */
export const providers = {
  text(name: TextProviderName = "gemini"): TextProvider {
    return env().MOCK_MODE ? mockSet().text : realProviders.text[name];
  },
  image(name: ImageProviderName = "gemini"): ImageProvider {
    return env().MOCK_MODE ? mockSet().image : realProviders.image[name];
  },
  video(name: VideoProviderName = "veo"): VideoProvider {
    return env().MOCK_MODE ? mockSet().video : realProviders.video[name];
  },
  tts(name: TtsProviderName = "elevenlabs"): TtsProvider {
    return env().MOCK_MODE ? mockSet().tts : realProviders.tts[name];
  },
};
