import type { Role } from "@/shared/roster";
import type { ArtPlan, ProducerPlan, Script, Social } from "@/shared/schemas";

/**
 * Offline fixtures returned by the mock TextProvider, one per text role.
 * Shape matches the zod schemas in src/shared/schemas.ts.
 */
const producer: ProducerPlan = {
  workingTitle: "Building the perfect home office",
  angle: "Each fix creates the next need - an isometric room that fills up one object at a time.",
  targetSeconds: 24,
  beatCount: 4,
};

const script: Script = {
  title: "The Perfect Home Office (in 24 seconds)",
  hook: "Your home office is missing four things.",
  beats: [
    {
      index: 0,
      you_do: "sit down at an empty desk",
      problem: "your back hurts after an hour",
      so_you_add: "an ergonomic chair",
      narration: "You sit down at an empty desk, but your back hurts after an hour, so you add an ergonomic chair.",
      seconds: 6,
    },
    {
      index: 1,
      you_do: "work late into the night",
      problem: "the room is too dark",
      so_you_add: "a desk lamp",
      narration: "You work late into the night, but the room is too dark, so you add a desk lamp.",
      seconds: 6,
    },
    {
      index: 2,
      you_do: "jump on video calls",
      problem: "your voice echoes off the floor",
      so_you_add: "a thick rug",
      narration: "You jump on video calls, but your voice echoes off the floor, so you add a thick rug.",
      seconds: 6,
    },
    {
      index: 3,
      you_do: "stare at the screen all day",
      problem: "the air feels stale",
      so_you_add: "a big green plant",
      narration: "You stare at the screen all day, but the air feels stale, so you add a big green plant.",
      seconds: 6,
    },
  ],
};

const artPlan: ArtPlan = {
  style: "isometric 3D cutaway room, soft pastel lighting, clean low-poly",
  k0Prompt: "Isometric 3D cutaway of an empty home office room with a single wooden desk, 9:16, pastel palette",
  edits: [
    { beatIndex: 0, addObject: "ergonomic chair", instruction: "Add an ergonomic office chair at the desk. Change nothing else." },
    { beatIndex: 1, addObject: "desk lamp", instruction: "Add a warm desk lamp on the desk. Change nothing else." },
    { beatIndex: 2, addObject: "rug", instruction: "Add a thick round rug under the desk. Change nothing else." },
    { beatIndex: 3, addObject: "plant", instruction: "Add a big green potted plant in the corner. Change nothing else." },
  ],
};

const disclosure = "Made with AI: visuals and voice are AI-generated.";
const social: Social = {
  posts: [
    {
      platform: "tiktok",
      caption: "Your home office is missing 4 things 👀 Which one do you need?",
      hashtags: ["#homeoffice", "#wfh", "#deskSetup", "#productivity"],
      aiDisclosure: disclosure,
      aiLabelFlag: true,
    },
  ],
};

export const TEXT_FIXTURES: Partial<Record<Role, unknown>> = {
  producer,
  scriptwriter: script,
  artDirector: artPlan,
  socialManager: social,
};
