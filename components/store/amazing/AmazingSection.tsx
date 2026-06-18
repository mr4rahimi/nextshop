"use client";

import { useEffect, useState } from "react";
import Countdown from "./Countdown";
import AmazingCard from "./AmazingCard";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  image: string | null;
}

interface Props {
  productIds?: string[];
  endsAt?: string;
}

export default function AmazingSection({ productIds = [], endsAt }: Props) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (productIds.length === 0) return;
    fetch(`/api/store/amazing-products?productIds=${productIds.join(",")}`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {});
  }, [productIds.join(",")]);

  if (products.length === 0) return null;

  return (
    <section className="overflow-hidden dark:bg-[#030712] transition-colors duration-500">
      <div className="container">
        <div className="relative bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl rounded-[4rem] p-2 overflow-hidden border border-white/80 dark:border-white/10 shadow-2xl">
          <div className="relative z-10 flex flex-col lg:flex-row">

            {}
            <div className="w-full lg:w-1/3 xl:w-1/4 p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-l border-gray-100 dark:border-white/5">
              <div>
                <span className="text-secondary-500 text-[11px] font-black uppercase">Special Offers</span>
                <h2 className="text-5xl font-black mt-6 mb-6">
                  تایم <br />
                  <span className="text-secondary-500">طلایی</span>
                </h2>
                <p className="text-gray-500 text-sm mb-10">
                  تخفیف‌های باورنکردنی فقط برای مدت محدود
                </p>
              </div>
              <Countdown endsAt={endsAt} />
              <button className="mt-10 py-4 bg-gray-900 text-white rounded-[2rem] font-black">
                مشاهده همه
              </button>
            </div>

            {}
            <div className="w-full lg:w-2/3 xl:w-3/4 p-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map(p => (
                <AmazingCard key={p.id} {...p} />
              ))}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
