export type PilotWindow = Readonly<{
  enrollFromMs: number;
  enrollUntilMs: number;
  observeUntilMs: number;
}>;

export const POTION_PILOT_WINDOW: PilotWindow | null = null;
export const POTION_ALLOWED_ORIGIN = "https://moingfans.com";
