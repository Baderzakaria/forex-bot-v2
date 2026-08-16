type KnownMethod =
  | "paypal"
  | "card"
  | "manual"
  | "crypto"
  | "bitcoin"
  | "wish-money"
  | "whish"
  | "whish-money"
  | "moneygram"
  | "western-union"
  | "webmoney";

const paymentMethodIconSrc: Record<string, string> = {
  paypal: "/payment-methods/paypal.svg",
  card: "/payment-methods/credit-debit-card.svg",
  credit: "/payment-methods/credit-debit-card.svg",
  debit: "/payment-methods/credit-debit-card.svg",
  crypto: "/payment-methods/bitcoin.svg",
  bitcoin: "/payment-methods/bitcoin.svg",
  cryptocurrency: "/payment-methods/bitcoin.svg",
  "wish-money": "/payment-methods/whish-money.svg",
  whish: "/payment-methods/whish-money.svg",
  "whish-money": "/payment-methods/whish-money.svg",
  moneygram: "/payment-methods/moneygram.svg",
  "western-union": "/payment-methods/western-union.svg",
  westernunion: "/payment-methods/western-union.svg",
  webmoney: "/payment-methods/webmoney.svg",
  manual: "/payment-methods/credit-debit-card.svg"
};

function normalizeMethod(method: string) {
  return method.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

export function paymentMethodLabel(method: string) {
  const key = normalizeMethod(method);
  if (key === "paypal") return "PayPal";
  if (key === "card" || key === "credit" || key === "debit") return "Credit & Debit Cards";
  if (key === "wish-money" || key === "whish" || key === "whish-money") return "Whish Money";
  if (key === "moneygram") return "MoneyGram";
  if (key === "western-union" || key === "westernunion") return "Western Union";
  if (key === "crypto" || key === "bitcoin" || key === "cryptocurrency") return "Cryptocurrency";
  if (key === "webmoney") return "WebMoney";
  if (key === "manual") return "Manual";
  return method;
}

export function PaymentMethodIcon({
  method,
  className
}: {
  method: string;
  className?: string;
}) {
  const src = paymentMethodIconSrc[normalizeMethod(method)];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt="" aria-hidden="true" />
  );
}

export function PaymentMethodCell({ method }: { method: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <PaymentMethodIcon method={method} className="h-5 w-auto max-w-[4.5rem] object-contain" />
      <span className="capitalize">{paymentMethodLabel(method)}</span>
    </span>
  );
}

export type { KnownMethod };
