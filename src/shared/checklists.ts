import type { Role } from "./roster";

/** Quality checklists per role, taken directly from docs/employee_skills.md. */
export const EMPLOYEE_CHECKLISTS: Record<Role, readonly string[]> = {
  producer: [
    "Topic not used in the last 60 days",
    "At least 3 problem to fix links, each with one visible object",
    "Feasibility and safety scores both 3 or higher",
    "No real brands, faces, or unverified numbers",
    "Facts that need checking are listed, not asserted",
  ],
  scriptwriter: [
    "Hook is 3 s or less and names the subject in the first 5 words",
    "Total 20 to 35 s, every beat 4 to 8 s",
    "Each beat has one problem, one fix, one visible object",
    "2.2 to 2.9 words per second",
    "No invented stats, brands, or faces",
    "Payoff matches the hook's promise",
  ],
  artDirector: [
    "N beats produce N+1 keyframes, K0 only from text",
    "Every Kn is an edit that adds exactly one object",
    "Style bible has hex palette and the negative prompt",
    "Every motion prompt forbids camera movement",
    "No text, logos, faces or hands requested anywhere",
  ],
  illustrator: [
    "K0 is the only text-to-image call",
    "Every later frame was made by editing the previous approved frame",
    "All frames share identical dimensions",
    "No text, logos, or artifacts",
    "Only the new object has the accent highlight",
  ],
  animator: [
    "Clip starts on the previous clip's last frame",
    "No camera move, no text, no new objects beyond the plan",
    "Duration within 0.3 s of target",
    "Draft tier used before any final-tier spend",
    "Degraded beats are flagged in the UI",
  ],
  voiceActor: [
    "Persona and voice id identical to previous reels",
    "Each beat within window plus or minus 0.3 s",
    "Word-level timing present for every word",
    "Loudness about -16 LUFS, true peak -1.5 dB",
    "Speech-to-text diff under 3 percent errors",
    "Synthetic voice is disclosed in the metadata",
  ],
  editor: [
    "20 to 35 s, 1080x1920, 30 fps",
    "Captions word-synced, 2 to 4 words per group, inside the safe area",
    "Voice at about -16 LUFS, music ducked",
    "No black frames or hard pops at cuts",
    "Thumbnail and SRT exported",
  ],
  socialManager: [
    "Hook in the first line, within the visible truncation window",
    "3 to 5 relevant hashtags only",
    "AI disclosure line present and the platform AI label flagged",
    "Times in Asia/Manila, labelled as hypotheses",
    "Nothing posted without human approval",
  ],
};
