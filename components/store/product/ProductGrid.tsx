"use client"
import { useState } from "react"
import ProductCard from "./ProductCard"
import ProductFilter from "./ProductFilter"

type Product = {
  id: number
  title: string
  brand: string
  category: string
  price: number
  oldPrice?: number
  image: string
}

type Props = {
  products: Product[]
}

export default function ProductGrid({ products }: Props) {


  const [active, setActive] = useState("all")

  const filteredProducts =
    active === "all"
      ? products
      : products.filter((p: Product) => p.category === active)

  return (
    <>
      <ProductFilter active={active} setActive={setActive} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mt-8">
        {filteredProducts.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  )
}