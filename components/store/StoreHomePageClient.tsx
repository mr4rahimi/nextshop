"use client";

import dynamic from "next/dynamic";


const Story              = dynamic(() => import("@/components/store/Story"));
const Hero               = dynamic(() => import("@/components/store/Hero"));
const Categories         = dynamic(() => import("@/components/store/Categories"));
const AmazingSection     = dynamic(() => import("@/components/store/amazing/AmazingSection"));
const NewestProducts     = dynamic(() => import("@/components/store/NewestProductsSection"));
const ProductsByCategory = dynamic(() => import("@/components/store/ProductsByCategorySection"));
const ProductsByBrand    = dynamic(() => import("@/components/store/ProductsByBrandSection"));
const FullBanner         = dynamic(() => import("@/components/store/FullBannerSection"));
const DoubleBanner       = dynamic(() => import("@/components/store/DoubleBannerSection"));
const LatestArticles     = dynamic(() => import("@/components/store/LatestArticlesSection"));
const CallToAction       = dynamic(() => import("@/components/store/CallToActionSection"));
const SpecialOffers      = dynamic(() => import("@/components/store/SpecialOffersSection"));
const ImageContent       = dynamic(() => import("@/components/store/ImageContentSection"));

type WidgetType = string;

function renderWidget(type: WidgetType, config: Record<string, any>, key: string) {
  switch (type) {
    case "STORY":
      return <Story key={key} />;
    case "HERO_SLIDER":
      return <Hero key={key} />;
    case "CATEGORIES":
      return <Categories key={key} categoryIds={config.categoryIds ?? []} />;
    case "AMAZING_DEALS":
      return <AmazingSection key={key} productIds={config.productIds ?? []} endsAt={config.endsAt ?? undefined} />;
    case "NEWEST_PRODUCTS":
      return <NewestProducts key={key} categoryIds={config.categoryIds ?? []} perCategory={config.perCategory ?? 3} />;
    case "PRODUCTS_BY_CATEGORY":
      return <ProductsByCategory key={key} categoryId={config.categoryId} categoryTitle={config.categoryTitle} categorySlug={config.categorySlug} count={config.count ?? 8} />;
    case "PRODUCTS_BY_BRAND":
      return <ProductsByBrand key={key} brandId={config.brandId} brandTitle={config.brandTitle} brandSlug={config.brandSlug} brandLogoUrl={config.brandLogoUrl} count={config.count ?? 8} />;
    case "FULL_BANNER":
      return <FullBanner key={key} imageUrl={config.imageUrl} linkUrl={config.linkUrl} alt={config.alt} />;
    case "DOUBLE_BANNER":
      return <DoubleBanner key={key} banners={config.banners ?? []} />;
    case "LATEST_ARTICLES":
      return <LatestArticles key={key} />;
    case "CALL_TO_ACTION":
      return <CallToAction key={key} config={config} />;
    case "SPECIAL_OFFERS":
      return <SpecialOffers key={key} config={config} />;
    case "IMAGE_CONTENT":
      return <ImageContent key={key} config={config} />;
    default:
      return null;
  }
}

interface WidgetData {
  id: string;
  type: string;
  config: Record<string, any>;
}

interface Props {
  widgets: WidgetData[];
}

export default function StoreHomePageClient({ widgets }: Props) {
  if (widgets.length === 0) {
    return (
      <div className="pb-10 space-y-12">
        <Story />
        <Hero />
        <Categories />
        <AmazingSection />
        <NewestProducts categoryIds={[]} perCategory={3} />
      </div>
    );
  }

  return (
    <div className="pb-10 space-y-12">
      {widgets.map(w => renderWidget(w.type, w.config, w.id))}
    </div>
  );
}
