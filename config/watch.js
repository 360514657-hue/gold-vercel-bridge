// User-approved Preview branch alias; no credentials belong in this module.
export const PREVIEW_WATCH_URL='https://gold-vercel-bridge-git-codex-xauusd-signal-engine-jay-4402.vercel.app/api/watch/xauusd';
export function watchDestination(env=process.env){return env.WATCH_DESTINATION_URL||PREVIEW_WATCH_URL;}
