export async function callAgent(
  mainAppUrl: string,
  botSecret: string,
  agentId: string,
  message: string,
  walletAddress: string
): Promise<string> {
  const res = await fetch(`${mainAppUrl}/api/agents/${agentId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bot-Internal": botSecret,
    },
    body: JSON.stringify({
      message,
      walletAddress,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null) as any;
    if (res.status === 402) return "you're out of credits. top up at app.claudia.wtf/credits";
    return data?.error || "something broke on my end. try again.";
  }

  const data = await res.json() as any;
  return data.reply || "got nothing back. weird. try again.";
}
