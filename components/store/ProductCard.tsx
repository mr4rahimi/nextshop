import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

export type ProductCardData = {
  id: string;
  title: string;
  imageSrc: string;
  href: string;

  price: number;
  compareAtPrice?: number;
  discountPercent?: number;

  rating: number;
  stock: number;
};

function formatToman(amount: number) {
  return `${amount.toLocaleString("fa-IR")} تومان`;
}

export default function ProductCard({ product }: { product: ProductCardData }) {
  const hasDiscount =
    typeof product.compareAtPrice === "number" &&
    product.compareAtPrice > product.price;

  const discount =
    typeof product.discountPercent === "number"
      ? product.discountPercent
      : hasDiscount && product.compareAtPrice
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : undefined;

  const stockLabel =
    product.stock <= 0 ? "ناموجود" : product.stock <= 5 ? "رو به اتمام" : "موجود";

  const stockClass =
    product.stock <= 0
      ? "bg-zinc-900 text-white"
      : product.stock <= 5
      ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";

  return (
    <Link
      href={product.href}
      className="
        group block h-full
        rounded-2xl border bg-white
        shadow-sm hover:shadow-md
        transition
      "
    >
      <div className="p-3 h-full flex flex-col">
        {/* image */}
        <div className="relative overflow-hidden rounded-2xl bg-zinc-100">
          <div className="relative aspect-square w-full">
            <Image
              src={product.imageSrc}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>

          {/* discount */}
          {typeof discount === "number" && discount > 0 && (
            <div className="absolute top-3 right-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow">
              %{discount}-
            </div>
          )}

          {/* rating */}
          <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow">
            <Star className="text-yellow-500" size={14} fill="currentColor" />
            <span>{product.rating.toFixed(1)}</span>
          </div>

          {/* stock */}
          <div
            className={`absolute bottom-3 right-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stockClass}`}
          >
            {stockLabel}
            {product.stock > 0 ? `: ${product.stock}` : ""}
          </div>
        </div>

        {/* content */}
        <div className="mt-3 flex-1 flex flex-col justify-between">
          {}
          <h3 className="text-sm font-bold text-zinc-900 leading-6 line-clamp-2 min-h-[48px]">
            {product.title}
          </h3>

          {/* price */}
          <div className="mt-2">
            <div className="text-base font-extrabold text-zinc-900">
              {formatToman(product.price)}
            </div>

            {hasDiscount && product.compareAtPrice != null && (
              <div className="text-xs font-medium text-zinc-500 line-through">
                {formatToman(product.compareAtPrice)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
