/** The 8 AI employees. Order = pipeline order = desk order. */
export const ROLES = [
  "producer",
  "scriptwriter",
  "artDirector",
  "illustrator",
  "animator",
  "voiceActor",
  "editor",
  "socialManager",
] as const;

export type Role = (typeof ROLES)[number];

export interface RosterEntry {
  id: Role;
  name: string;
  title: string;
  /** placeholder sprite colour until a real character pack is configured */
  color: string;
  /** provider kind this employee mainly uses */
  kind: "text" | "image" | "video" | "tts" | "ffmpeg";
}

export const ROSTER: readonly RosterEntry[] = [
  { id: "producer", name: "Pia", title: "Producer", color: "#e4572e", kind: "text" },
  { id: "scriptwriter", name: "Sam", title: "Scriptwriter", color: "#f3a712", kind: "text" },
  { id: "artDirector", name: "Ada", title: "Art Director", color: "#a8c686", kind: "text" },
  { id: "illustrator", name: "Ivo", title: "Illustrator", color: "#29335c", kind: "image" },
  { id: "animator", name: "Ani", title: "Animator", color: "#669bbc", kind: "video" },
  { id: "voiceActor", name: "Val", title: "Voice Actor", color: "#b56576", kind: "tts" },
  { id: "editor", name: "Eda", title: "Editor", color: "#6d597a", kind: "ffmpeg" },
  { id: "socialManager", name: "Soc", title: "Social Manager", color: "#2a9d8f", kind: "text" },
];

export const EMPLOYEE_STATUSES = ["idle", "thinking", "working", "done", "error", "waiting"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
