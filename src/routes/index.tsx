import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Leaf, Sparkles } from "lucide-react";

import marketHero from "@/assets/market-hero.jpg";
import { Button } from "@/components/ui/button";
import { ProductCard, StoreHeader } from "@/components/storefront";
import { getShopifyProducts, getVegetableCategory, isSpiceProduct } from "@/lib/shopify-storefront";

const productsQuery = queryOptions({ queryKey: ["shopify-products"], queryFn: getShopifyProducts });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  head: () => ({
    meta: [
      { title: "Sabzi & Spice | Fresh Vegetables and Everyday Spices" },
      { name: "description", content: "Shop vegetables and spices from the Sabzi & Spice online market." },
      { property: "og:title", content: "Sabzi & Spice | Fresh Vegetables and Everyday Spices" },
      { property: "og:description", content: "A considered online market for vegetables and spices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

type ProductFilter = "all" | "vegetables" | "spices";

function HomePage() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const [filter, setFilter] = useState<ProductFilter>("all");
  const spices = useMemo(() => products.filter(isSpiceProduct), [products]);
  const vegetables = useMemo(() => products.filter((product) => !isSpiceProduct(product)), [products]);
  const visibleProducts = filter === "spices" ? spices : filter === "vegetables" ? vegetables : products;

  return <main>
    <StoreHeader />
    <section className="relative isolate min-h-[560px] overflow-hidden bg-foreground sm:min-h-[660px]" aria-labelledby="welcome-heading">
      <img src={marketHero} alt="Fresh vegetables, green herbs and colorful spices" className="absolute inset-0 -z-20 size-full object-cover object-[62%_center]" />
      <div className="absolute inset-0 -z-10 bg-foreground/40" />
      <div className="mx-auto flex min-h-[560px] max-w-7xl flex-col items-start justify-center px-5 py-20 text-background sm:min-h-[660px] sm:px-10">
        <p className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest"><Leaf className="size-4" aria-hidden="true" /> A little more colour for your kitchen</p>
        <h1 id="welcome-heading" className="max-w-3xl font-serif text-5xl leading-[1.06] sm:text-7xl">Everyday fresh.<br />Full of flavour.</h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-background/90 sm:text-lg">From crisp vegetables to the spices that bring a meal together. आपकी रसोई के लिए, प्यार से।</p>
        <Button asChild variant="secondary" size="lg" className="mt-9 gap-3"><a href="#shop">Explore the market <ArrowDown aria-hidden="true" /></a></Button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-accent" />
    </section>

    <section id="shop" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">The market</p><h2 className="font-serif text-4xl text-foreground sm:text-5xl">Good things, gathered.</h2><p className="mt-3 max-w-xl text-muted-foreground">ताज़ी सब्ज़ियाँ और रोज़मर्रा के मसाले — all in one place.</p></div>
        <div className="flex flex-wrap gap-2" aria-label="Filter products">{([ ["all", "Everything"], ["vegetables", "Vegetables"], ["spices", "Spices"] ] as const).map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}</div>
      </div>
      {products.length === 0 ? <div className="mt-12 grid min-h-72 place-items-center border-y border-border px-5 py-14 text-center"><div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-primary"><Sparkles aria-hidden="true" /></span><h3 className="mt-5 font-serif text-2xl">Our shelves are getting ready.</h3><p className="mt-2 text-muted-foreground">There are no products in the shop just yet. Real products will appear here once the catalog is stocked.</p></div></div> : visibleProducts.length ? <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-12 border-y border-border py-16 text-center"><p className="font-serif text-2xl">No {filter} found.</p><Button variant="link" className="mt-2" onClick={() => setFilter("all")}>See everything <ArrowRight aria-hidden="true" /></Button></div>}
    </section>

    <section className="border-y border-border bg-secondary/45"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-8 md:grid-cols-2 md:items-center md:py-20"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-background text-primary"><Leaf aria-hidden="true" /></span><div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Fresh picks</p><h2 className="mt-2 font-serif text-3xl">Vegetables for every day.</h2><p className="mt-3 max-w-lg text-muted-foreground">A colourful mix for your everyday cooking — from leafy greens to kitchen staples.</p></div></div><a href="#vegetables" className="inline-flex items-center gap-2 font-medium text-foreground transition-colors hover:text-primary">Browse vegetables <ArrowRight className="size-4" aria-hidden="true" /></a></div></section>

    <section id="vegetables" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-8 sm:py-20"><p className="text-sm font-semibold uppercase tracking-widest text-primary">Fresh from the market</p><h2 className="mt-2 font-serif text-4xl">Vegetables, your way.</h2>
      {vegetables.length ? <><div className="mt-8 flex flex-wrap gap-2 text-sm text-muted-foreground">{[...new Set(vegetables.map(getVegetableCategory))].map((category) => <span key={category} className="border-r border-border pr-2 last:border-0">{category}</span>)}</div><div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">{vegetables.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div></> : <p className="mt-4 text-muted-foreground">Fresh vegetable picks are coming soon.</p>}
    </section>

    <section id="spices" className="scroll-mt-24 bg-foreground text-background"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-8 sm:py-20 md:grid-cols-2 md:items-center"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent"><Sparkles className="size-4" aria-hidden="true" /> The finishing touch</p><h2 className="mt-4 font-serif text-4xl sm:text-5xl">A pinch of something special.</h2><p className="mt-4 max-w-lg text-background/75">Explore the spices that make everyday meals feel like home.</p>{spices.length ? <div className="mt-7 grid grid-cols-2 gap-5">{spices.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="mt-6 text-background/65">Our spice shelf is being filled. Check back soon.</p>}</div><div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-secondary"><img src={marketHero} alt="Colorful ground spices and fresh vegetables" className="size-full object-cover object-[80%_center]" loading="lazy" /><span className="absolute bottom-4 left-4 bg-background px-4 py-2 text-sm font-medium text-foreground">रसोई का असली स्वाद</span></div></div></section>

    <section id="our-story" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 text-center sm:px-8 sm:py-24"><p className="text-sm font-semibold uppercase tracking-widest text-primary">Our story</p><h2 className="mx-auto mt-4 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">A market that feels a little like home.</h2><p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">From familiar vegetables to the spices in your favourite recipes, find a little inspiration for whatever is cooking today.</p><a href="#shop" className="mt-7 inline-flex items-center gap-2 font-medium text-primary hover:underline">Back to the market <ArrowRight className="size-4" aria-hidden="true" /></a></section>
    <footer className="bg-secondary/50"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="font-serif text-lg text-foreground">Sabzi &amp; Spice</span><span>Made for kitchens that love good food. खाना बनेगा, दिल से।</span></div></footer>
  </main>;
}