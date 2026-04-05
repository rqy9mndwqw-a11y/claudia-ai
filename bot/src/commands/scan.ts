import type { Context } from "grammy";
import type { Env } from "../types.js";
import { getLatestScan } from "../lib/db.js";
import { formatScanResults } from "../lib/format.js";

export function handleScan(env: Env) {
  return async (ctx: Context) => {
    const scan = await getLatestScan(env.DB);
    const message = formatScanResults(scan);
    await ctx.reply(message, { parse_mode: "HTML" });
  };
}
