import { z } from "zod";

/** Reel format constants (spec: 20-35 s, 9:16, 4-8 s beats). */
export const REEL = {
  width: 1080,
  height: 1920,
  fps: 30,
  minSeconds: 20,
  maxSeconds: 35,
  minBeatSeconds: 4,
  maxBeatSeconds: 8,
} as const;

export const BriefSchema = z.object({
  topic: z.string().min(3),
  audience: z.string().default("general"),
  platforms: z.array(z.enum(["tiktok", "instagram", "youtube"])).min(1).default(["tiktok"]),
  tone: z.string().default("curious, friendly"),
});
export type Brief = z.infer<typeof BriefSchema>;

export const ProducerPlanSchema = z.object({
  workingTitle: z.string(),
  angle: z.string(),
  targetSeconds: z.number().min(REEL.minSeconds).max(REEL.maxSeconds),
  beatCount: z.number().int().min(3).max(8),
});
export type ProducerPlan = z.infer<typeof ProducerPlanSchema>;

/** "you do X, but problem Y, so you add Z" loop - one object added per beat. */
export const BeatSchema = z.object({
  index: z.number().int().min(0),
  you_do: z.string(),
  problem: z.string(),
  so_you_add: z.string(),
  narration: z.string().min(3),
  seconds: z.number().min(REEL.minBeatSeconds).max(REEL.maxBeatSeconds),
});
export const ScriptSchema = z
  .object({
    title: z.string(),
    hook: z.string(),
    beats: z.array(BeatSchema).min(3).max(8),
  })
  .refine(
    (s) => {
      const total = s.beats.reduce((a, b) => a + b.seconds, 0);
      return total >= REEL.minSeconds && total <= REEL.maxSeconds;
    },
    { message: `total beat seconds must be within ${REEL.minSeconds}-${REEL.maxSeconds}` },
  );
export type Script = z.infer<typeof ScriptSchema>;

/** K0 is text-to-image; each later keyframe is an edit adding exactly one object. N beats -> N+1 keyframes. */
export const ArtPlanSchema = z.object({
  style: z.string(),
  k0Prompt: z.string(),
  edits: z.array(z.object({ beatIndex: z.number().int().min(0), addObject: z.string(), instruction: z.string() })),
});
export type ArtPlan = z.infer<typeof ArtPlanSchema>;

export const PlatformPostSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  caption: z.string().min(1),
  hashtags: z.array(z.string().regex(/^#\w+$/)).min(3).max(5),
  aiDisclosure: z.string().min(5),
  aiLabelFlag: z.boolean(),
});
export const SocialSchema = z.object({ posts: z.array(PlatformPostSchema).min(1) });
export type Social = z.infer<typeof SocialSchema>;
