export async function buyCommand(ctx: any): Promise<void> {
  await ctx.reply(
    `\u{1F4B1} How to buy $CLAUDIA\n\n$CLAUDIA is on Base chain.\n\nbuy on Aerodrome:\nhttps://aerodrome.finance/swap?inputCurrency=ETH&outputCurrency=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B\n\ncontract:\n0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B\n\nneed Base ETH for gas?\nbridge at: bridge.base.org\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\naccess tiers:\n1M \u2192 dashboard\n5M \u2192 trading tools\n25M \u2192 creator\n100M \u2192 whale\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\nhold $CLAUDIA. burn supply. get smarter.`,
    { link_preview_options: { is_disabled: true } }
  );
}
