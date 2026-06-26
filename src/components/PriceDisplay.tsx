export default function PriceDisplay({ price }: { price: number }) {
  const formatted = Number.isInteger(price) ? `¥${price}` : `¥${price}`;
  return <span className="font-medium tabular-nums">{formatted}</span>;
}
