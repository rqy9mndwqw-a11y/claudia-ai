export async function linksCommand(ctx: any): Promise<void> {
  await ctx.reply(
    `\u{1F517} CLAUDIA Links\n\n\u{1F310} app: app.claudia.wtf\n\u{1F916} bot: t.me/CLAUDIA_wtf_bot\n\u{1F4AC} group: t.me/askclaudia\n\u{1F426} x: x.com/0xCLAUDIA_wtf\n\u{1F4B1} buy: aerodrome.finance/swap?inputCurrency=ETH&outputCurrency=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B\n\u{1F4CA} chart: dexscreener.com/base/0xe6be7cc04136ddada378175311fbd6424409f997\n\u{1F525} contract: basescan.org/token/0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B`,
    { link_preview_options: { is_disabled: true } }
  );
}
