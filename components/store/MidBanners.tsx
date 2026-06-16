import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Banner = {
  id: string;
  title: string;
  subtitle?: string;
  imageSrc: string;
  href: string;
};

function BannerCard({ banner, variant }: { banner: Banner; variant: "large" | "small" }) {
  return (
    <Link
      href={banner.href}
      className="
        group relative block overflow-hidden rounded-3xl border
        bg-zinc-100 shadow-sm hover:shadow-md transition
      "
    >
      <div className={variant === "large" ? "relative h-[220px] md:h-[360px]" : "relative h-[170px] md:h-[170px]"}>
        <Image
          src={banner.imageSrc}
          alt={banner.title}
          fill
          sizes={variant === "large" ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority={false}
        />

        {/* subtle overlay */}
        <div
          className="
            absolute inset-0
            bg-gradient-to-t
            from-black/55 via-black/10 to-transparent
            opacity-90
          "
        />
      </div>

      {/* text */}
      <div className="absolute bottom-0 right-0 left-0 p-4 md:p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-extrabold text-white line-clamp-1">
              {banner.title}
            </h3>
            {banner.subtitle && (
              <p className="mt-1 text-xs md:text-sm text-white/85 line-clamp-1">
                {banner.subtitle}
              </p>
            )}
          </div>

          <span
            className="
              shrink-0 inline-flex items-center gap-1
              rounded-full bg-white/90 px-3 py-1
              text-xs font-extrabold text-zinc-900
              shadow
              group-hover:bg-white transition
            "
          >
            مشاهده
            <ArrowLeft size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function MidBanners() {
  const large: Banner = {
    id: "b1",
    title: "ساخت ست شیرآلات یکپارچه",
    subtitle: "هم‌رنگ، هم‌متتومان، آماده خرید",
    imageSrc: "/mid-banners/01.webp",
    href: "/configurator",
  };

  const small1: Banner = {
    id: "b2",
    title: "پیشنهاد ویژه امروز",
    subtitle: "تخفیف‌های محدود",
    imageSrc: "/mid-banners/02.webp",
    href: "/store/offers",
  };

  const small2: Banner = {
    id: "b3",
    title: "محصولات جدید",
    subtitle: "تازه‌رسیده‌ها",
    imageSrc: "/mid-banners/03.webp",
    href: "/products?sort=newest",
  };

  return (
    <section className="w-full">
      <div className="container mx-auto pt-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
          {/* large (2/3) */}
          <div className="md:col-span-8">
            <BannerCard banner={large} variant="large" />
          </div>

          {/* two small (1/3) */}
          <div className="md:col-span-4 grid grid-cols-1 gap-4 md:gap-5">
            <BannerCard banner={small1} variant="small" />
            <BannerCard banner={small2} variant="small" />
          </div>
        </div>
      </div>
    </section>
  );
}
