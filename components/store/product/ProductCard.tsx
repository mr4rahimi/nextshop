import { Product } from "@/types/product"

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="swiper-slide h-auto p-4">
      <div className="group relative h-full pt-12">
        <div className="absolute inset-0 bg-white/80 dark:bg-[#0a0a0a]/40 backdrop-blur-[20px] rounded-[3rem] border border-gray-100 dark:border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.02)] transition-all duration-700 group-hover:border-primary-500/50"></div>

        <div className="relative p-7 flex flex-col h-full z-10 transition-transform duration-500 group-hover:-translate-y-4">

          {/* Discount */}
          {product.discount && (
            <div className="absolute -top-6 -right-2 z-20">
              <div className="bg-secondary-500 text-white text-[12px] font-black w-12 h-12 rounded-[1.2rem] flex items-center justify-center rotate-12 group-hover:rotate-0 transition-all">
                {product.discount}٪
              </div>
            </div>
          )}

          {/* Image */}
          <div className="relative mb-8 flex items-center justify-center min-h-[180px]">
            <img
              src={product.image}
              className="w-full h-44 object-contain transition-all duration-700 group-hover:scale-110"
              alt={product.title}
            />
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-black text-gray-800 dark:text-zinc-100 mb-6 line-clamp-2 leading-7 h-14 group-hover:text-primary-600 transition-colors">
            {product.title}
          </h3>

          {/* Price */}
          <div className="flex items-center justify-between mt-auto pt-5 border-t border-gray-100 dark:border-white/5">
            <div className="flex flex-col gap-1">
              {product.oldPrice && (
                <span className="text-[11px] text-gray-400 line-through">
                  {product.oldPrice.toLocaleString()}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {product.price.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-400">تومان</span>
              </div>
            </div>

            <button className="w-14 h-14 bg-primary-500 text-white rounded-[1.5rem] flex items-center justify-center hover:scale-110 transition-all">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}