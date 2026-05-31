export function buildMetaMaskUniversalLink(uri: string): string {
  return `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`;
}

export function buildMetaMaskDeepLink(uri: string): string {
  return `metamask://wc?uri=${encodeURIComponent(uri)}`;
}
