import Link from "next/link";
import AddToCartButton from "@/components/store/cart/AddToCartButton";

interface Props {
  title: string;
  slug: string;
  image: string | null;
  price: string;       // serialized BigInt → string
  salePrice: string | null;
}

function formatPrice(val: string | null | undefined): string {
  if (!val) return "۰";
  const n = Number(val);
  return isNaN(n) ? "۰" : n.toLocaleString("fa-IR");
}

function discountPercent(price: string, salePrice: string | null): number | null {
  if (!salePrice) return null;
  const p = Number(price), s = Number(salePrice);
  if (!p || s >= p) return null;
  return Math.round(((p - s) / p) * 100);
}

export default function AmazingCard({ title, slug, image, price, salePrice }: Props) {
  const discount = discountPercent(price, salePrice);
  const displayPrice = salePrice ?? price;

  return (
    <Link href={`/products/${slug}`} className="group relative h-full pt-10 block">
      <div className="absolute inset-0 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] border border-white dark:border-white/10 shadow-xl transition-all duration-500 group-hover:border-secondary-400/50 group-hover:shadow-secondary-500/10" />

      <div className="relative p-8 flex flex-col h-full z-10 transition-transform duration-500 group-hover:-translate-y-4">

        {}
        {discount && (
          <div className="absolute -top-4 -right-2 z-20">
            <div className="bg-gradient-to-br from-secondary-400 to-secondary-600 text-white text-[11px] font-black w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
              {discount}٪
            </div>
          </div>
        )}

        {}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute w-32 h-32 bg-secondary-500/20 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          {image ? (
            <img
              src={image}
              alt={title}
              className="relative z-10 w-full h-48 object-contain transition-all duration-700 group-hover:scale-110 group-hover:-rotate-3"
            />
          ) : (
            <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          )}
        </div>

        {}
        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-6 line-clamp-2 h-14 group-hover:text-secondary-600 transition-colors">
          {title}
        </h3>

        {}
        <div className="flex items-center justify-between mt-auto pt-6 border-t border-black/5 dark:border-white/5">
          <div className="flex flex-col">
            {salePrice && (
              <span className="text-[10px] text-gray-400 line-through">
                {formatPrice(price)} تومان
              </span>
            )}
            <div className="flex items-center gap-1">
              <span className="text-xl font-black text-gray-900 dark:text-white">
                {formatPrice(displayPrice)}
              </span>
              <span className="text-[10px] text-gray-500 font-bold">تومان</span>
            </div>
          </div>
          <div className="w-14 h-14 bg-secondary-600 text-white rounded-[1.2rem] flex items-center justify-center shadow-xl hover:scale-110 transition-all text-xl font-black">
            +
          </div>
        </div>
      </div>
    </Link>
  );
}
