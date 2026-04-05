import { getClaudiaPrice } from "../lib/api.js";

export async function priceCommand(ctx: any): Promise<void> {
  try {
    const data = await getClaudiaPrice();
    if (!data) {
      await ctx.reply("price data temporarily unavailable.\n\ncheck: app.claudia.wtf/buy");
      return;
    }

    await ctx.reply(
      `$CLAUDIA\n\nprice: $${data.price}\n24h: ${data.change24h}\n\nbuy on Aerodrome \u2192 app.claudia.wtf/buy\napp.claudia.wtf`
    );
  } catch {
    await ctx.reply("price check failed. try again.\n\napp.claudia.wtf/buy");
  }
}
