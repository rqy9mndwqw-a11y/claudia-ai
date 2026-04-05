import type { Env } from "../types.js";

export async function sendGroupMessage(env: Env, text: string): Promise<boolean> {
  if (!env.CLAUDIA_GROUP_CHAT_ID) {
    console.log("No CLAUDIA_GROUP_CHAT_ID set, skipping group message");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.CLAUDIA_GROUP_CHAT_ID,
          text,
          link_preview_options: { is_disabled: true },
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error("Failed to send group message:", (err as Error).message);
    return false;
  }
}
