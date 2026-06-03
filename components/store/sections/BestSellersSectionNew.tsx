"use client"

import ProductCard from "../product/ProductCard"
import { Product } from "@/types/product"

const products: Product[] = [
  {
    id: 1,
    title: "آیفون 15 پرو مکس 256 گیگ",
    image: "/images/product/mobile-1.png",
    price: 15300,
    oldPrice: 18000,
    discount: 15,
  },
  {
    id: 2,
    title: "آیفون 16 پرو مکس 256 گیگ",
    image: "/assets/images/product/mobile-2.png",
    price: 15300,
    oldPrice: 18000,
    discount: 15,
  },
  {
    id: 3,
    title: "آیفون 17 پرو مکس 256 گیگ",
    image: "/images/product/mobile-3.png",
    price: 15300,
    oldPrice: 18000,
    discount: 15,
  },
]

export default function BestSellersSectionNew() {
  return (
    <section className="best-sellers-glass relative overflow-hidden transition-colors duration-700">
      <div className="container pb-7 relative z-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <h2 className="text-3xl font-black">پرفروش‌ترین‌ها</h2>

          <a href="#" className="px-6 py-3 rounded-xl border">
            مشاهده همه محصولات
          </a>
        </div>

        {/* Slider */}
        <div className="swiper productSwiper">
          <div className="swiper-wrapper">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-4 mt-10">
          <div className="prod-prev w-14 h-14 flex items-center justify-center border rounded-xl cursor-pointer">
            {"<"}
          </div>
          <div className="prod-next w-14 h-14 flex items-center justify-center border rounded-xl cursor-pointer">
            {">"}
          </div>
        </div>
      </div>
    </section>
  )
}