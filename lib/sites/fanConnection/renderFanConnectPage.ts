/** A single explicit acceptance action, followed by Spotify's own authorization screen. */
export function renderFanConnectPage(input: {
  name: string;
  returnUrl: string;
  marketingText: string;
  revision: number;
  csrf: string;
}) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connect with ${escape(input.name)}</title><style>:root{--background:#fff;--foreground:#0a0a0a;--muted:#626262}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:16px/1.6 system-ui,sans-serif}main{max-width:540px;margin:10vh auto;padding:32px}h1{font-size:38px;line-height:1.1;letter-spacing:-.04em}p{color:var(--muted)}section{padding:20px;box-shadow:0 0 0 1px #ddd;border-radius:12px;margin:24px 0}button{width:100%;padding:16px;border:0;border-radius:8px;background:var(--foreground);color:var(--background);font:600 16px system-ui;cursor:pointer}a{color:inherit}button:focus-visible,a:focus-visible{outline:3px solid #777;outline-offset:4px}</style></head><body><main><small>RECOUP · FAN CONNECTION</small><h1>Connect with ${escape(input.name)}</h1><p>Use Spotify to join this artist’s audience.</p><section><strong>By continuing, you agree to:</strong><p>Share your Spotify profile and available email address with this site’s artist through Recoup.</p><p>${escape(input.marketingText)}</p></section><form method="post"><input type="hidden" name="csrf" value="${escape(input.csrf)}"><input type="hidden" name="revision" value="${input.revision}"><button name="accept" value="yes">Agree and connect with Spotify</button></form><p><a href="${escape(input.returnUrl)}">Return without connecting</a></p></main></body></html>`;
}
