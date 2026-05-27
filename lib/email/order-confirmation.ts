/*
 * Order confirmation email.
 *
 * MVP renders inline-styled HTML directly (no React Email install yet —
 * follow-up wraps these in @react-email/components for richer composition).
 * Sent via Resend from an Inngest function on order.paid.
 *
 * Brand bar: Fraunces hero (Google Fonts CSS), tabular numerals on prices,
 * shop-floor terse copy.
 */

import type { Order, OrderItem } from "@/drizzle/schema";

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function renderOrderConfirmationHtml(input: {
  order: Order;
  items: OrderItem[];
  customerName: string | null;
  appUrl: string;
}): string {
  const { order, items, customerName, appUrl } = input;

  const itemRows = items
    .map((it) => {
      const snap = it.productSnapshot as { name?: string; variantName?: string };
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;font-size:18px;color:#1a1410;">
            ${escape(snap.name ?? "Product")}
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:0.18em;">
              ${escape(snap.variantName ?? "")} · ×${it.quantity}
            </div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;text-align:right;font-family:Georgia,serif;font-size:18px;font-variant-numeric:tabular-nums;color:#1a1410;">
            ${fmt(it.lineTotalCents)}
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Order ${escape(order.orderNumber)} · Salishforge</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,380..600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#fbf6ef;color:#1a1410;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fbf6ef;padding:48px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="background:#fff;padding:48px 40px;border:1px solid #eee;">
        <tr><td>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.22em;">
            Order confirmed · ${escape(order.orderNumber)}
          </div>
          <h1 style="margin:18px 0 0;font-family:'Fraunces',Georgia,serif;font-weight:380;font-size:48px;line-height:1.05;letter-spacing:-0.02em;color:#1a1410;">
            On the bench.
          </h1>
          <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#28201a;">
            ${customerName ? `${escape(customerName)}, ` : ""}your order is in.
            We'll start work on it within a day; you'll get a shipping note
            when it leaves the bench.
          </p>

          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:40px;">
            ${itemRows}
            <tr>
              <td style="padding:18px 0 0;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#666;">
                Subtotal
              </td>
              <td style="padding:18px 0 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(order.subtotalCents)}</td>
            </tr>
            ${order.taxCents > 0 ? `
            <tr>
              <td style="padding:6px 0 0;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#666;">
                Tax
              </td>
              <td style="padding:6px 0 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(order.taxCents)}</td>
            </tr>` : ""}
            ${order.shippingCents > 0 ? `
            <tr>
              <td style="padding:6px 0 0;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#666;">
                Shipping
              </td>
              <td style="padding:6px 0 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(order.shippingCents)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:18px 0 0;font-family:'Fraunces',Georgia,serif;font-size:18px;color:#1a1410;">
                Total
              </td>
              <td style="padding:18px 0 0;text-align:right;font-family:'Fraunces',Georgia,serif;font-size:24px;font-variant-numeric:tabular-nums;color:#1a1410;">
                ${fmt(order.totalCents)}
              </td>
            </tr>
          </table>

          <p style="margin:48px 0 0;text-align:center;">
            <a href="${escape(appUrl)}/account" style="display:inline-block;padding:14px 28px;background:#1a1410;color:#fbf6ef;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.22em;">
              View order
            </a>
          </p>

          <p style="margin:48px 0 0;font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.22em;color:#888;text-align:center;">
            Salishforge · Made in the Pacific Northwest
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
