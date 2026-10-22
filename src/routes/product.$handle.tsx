import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoreHeader } from "@/components/storefront";
import { useCartStore } from "@/lib/shopify-cart";
import { formatShopifyMoney, getShopifyProduct } from "@/lib/shopify-storefront";

function productQuery(handle: string) {
  return queryOptions({ queryKey: ["shopify-product", handle], queryFn: () => getShopifyProduct(handle) });
}

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ context, params }) => {
    const product = await context.queryClient.ensureQueryData(productQuery(params.handle));
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} | Sabzi & Spice` : "Product unavailable | Sabzi & Spice";
    const description = loaderData?.description || "Explore vegetables and spices at Sabzi & Spice.";
    const imageUrl = loaderData?.images.edges[0]?.node.url;
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      ...(imageUrl ? [{ property: "og:image", content: imageUrl }, { name: "twitter:image", content: imageUrl }] : []),
    ] };
  },
  component: ProductPage,
});

function ProductPage() {
  const { handle } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQuery(handle));
  const variants = useMemo(() => product.variants.edges.map((edge) => edge.node), [product]);
  const [selectedVariantId, setSelectedVariantId] = useState(() => variants.find((variant) => variant.availableForSale)?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const image = product.images.edges[0]?.node;

  const addToBag = async () => {
    if (!selectedVariant?.availableForSale) return;
    setError(null);
    try { await addItem(product, selectedVariant.id, 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The item could not be added."); }
  };

  return <main className="min-h-screen"><StoreHeader /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
    <p className="mb-6 text-sm text-muted-foreground"><a href="/" className="hover:text-primary">Market</a> <span aria-hidden="true">/</span> {product.title}</p>
    <div className="grid gap-8 md:grid-cols-2 md:gap-14"><div className="aspect-[4/5] overflow-hidden rounded-sm bg-secondary">{image ? <img className="size-full object-cover" src={image.url} alt={image.altText ?? product.title} /> : <div className="grid size-full place-items-center text-muted-foreground">No product image</div>}</div>
      <div className="flex flex-col justify-center py-2"><p className="text-sm font-semibold uppercase tracking-widest text-primary">Sabzi &amp; Spice</p><h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{product.title}</h1><p className="mt-5 text-xl font-medium">{formatShopifyMoney(selectedVariant?.price ?? product.priceRange.minVariantPrice)}</p>{product.description ? <p className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">{product.description}</p> : null}
        {variants.length > 1 ? <div className="mt-8 max-w-sm space-y-2"><label className="text-sm font-medium" htmlFor="product-variant">Choose an option</label><Select value={selectedVariantId} onValueChange={setSelectedVariantId}><SelectTrigger id="product-variant" aria-label="Choose a product option"><SelectValue /></SelectTrigger><SelectContent>{variants.map((variant) => <SelectItem key={variant.id} value={variant.id} disabled={!variant.availableForSale}>{variant.title} — {formatShopifyMoney(variant.price)}{variant.availableForSale ? "" : " (Sold out)"}</SelectItem>)}</SelectContent></Select></div> : null}
        <Button className="mt-8 w-full sm:max-w-sm" size="lg" disabled={!selectedVariant?.availableForSale || isLoading} onClick={() => void addToBag()}>{selectedVariant?.availableForSale ? (isLoading ? "Adding…" : "Add to bag") : "Sold out"}</Button>{error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}<p className="mt-5 text-sm text-muted-foreground">{selectedVariant?.availableForSale ? "Available now" : "Currently unavailable"}</p>
      </div>
    </div>
  </div></main>;
}