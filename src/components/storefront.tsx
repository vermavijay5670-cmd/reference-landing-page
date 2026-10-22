import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { checkoutCart, useCartStore } from "@/lib/shopify-cart";
import { formatShopifyMoney, type ShopifyProduct } from "@/lib/shopify-storefront";

export function StoreHeader() {
  const itemCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2" aria-label="Sabzi & Spice home">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">✳</span>
          <span className="min-w-0"><span className="block truncate font-serif text-xl leading-tight">Sabzi &amp; Spice</span><span className="hidden text-xs text-muted-foreground sm:block">सब्ज़ी भी, स्वाद भी</span></span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium md:flex">
          <a className="transition-colors hover:text-primary" href="#vegetables">Vegetables</a>
          <a className="transition-colors hover:text-primary" href="#spices">Spices</a>
          <a className="transition-colors hover:text-primary" href="#our-story">Our story</a>
        </nav>
        <CartSheet itemCount={itemCount} />
      </div>
    </header>
  );
}

function CartSheet({ itemCount }: { itemCount: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useCartStore((state) => state.items);
  const checkoutUrl = useCartStore((state) => state.checkoutUrl);
  const isLoading = useCartStore((state) => state.isLoading);
  const isSyncing = useCartStore((state) => state.isSyncing);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const syncCart = useCartStore((state) => state.syncCart);
  const total = items.reduce((sum, item) => sum + Number(item.price.amount) * item.quantity, 0);
  const currency = items[0]?.price.currencyCode;

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      await useCartStore.persist.rehydrate();
      if (active) await syncCart();
    };
    void hydrate();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncCart();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncCart]);

  useEffect(() => {
    if (open) void syncCart();
  }, [open, syncCart]);

  const runCartAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The cart could not be updated.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button variant="outline" className="relative shrink-0 gap-2" aria-label={`Shopping bag, ${itemCount} items`}><ShoppingBag aria-hidden="true" /><span className="hidden sm:inline">Bag</span><span className="grid size-5 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{itemCount}</span></Button></SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border pb-5 text-left"><SheetTitle className="font-serif text-2xl">Your bag</SheetTitle><SheetDescription>{itemCount === 0 ? "Your bag is waiting for something fresh." : `${itemCount} ${itemCount === 1 ? "item" : "items"} in your bag`}</SheetDescription></SheetHeader>
        {items.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><ShoppingBag className="size-10 text-muted-foreground" aria-hidden="true" /><p className="font-serif text-xl">Your bag is empty</p><Button variant="outline" onClick={() => setOpen(false)}>Keep browsing</Button></div> : <>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {items.map((item) => <div className="flex gap-4 py-5" key={item.variantId}>
              <div className="size-20 shrink-0 overflow-hidden rounded-sm bg-secondary">{item.imageUrl ? <img className="size-full object-cover" src={item.imageUrl} alt={item.title} /> : null}</div>
              <div className="min-w-0 flex-1"><Link to="/product/$handle" params={{ handle: item.handle }} className="line-clamp-2 font-medium hover:text-primary">{item.title}</Link>{item.variantTitle !== "Default Title" ? <p className="mt-1 text-sm text-muted-foreground">{item.variantTitle}</p> : null}<p className="mt-1 text-sm">{formatShopifyMoney(item.price)}</p>
                <div className="mt-3 flex items-center gap-2"><Button variant="outline" size="icon" className="size-8" aria-label={`Decrease ${item.title} quantity`} onClick={() => void runCartAction(() => updateQuantity(item.variantId, item.quantity - 1))} disabled={isLoading || isSyncing}><Minus aria-hidden="true" /></Button><span className="w-6 text-center text-sm" aria-live="polite">{item.quantity}</span><Button variant="outline" size="icon" className="size-8" aria-label={`Increase ${item.title} quantity`} onClick={() => void runCartAction(() => updateQuantity(item.variantId, item.quantity + 1))} disabled={isLoading || isSyncing}><Plus aria-hidden="true" /></Button><Button variant="ghost" size="icon" className="ml-auto size-8" aria-label={`Remove ${item.title}`} onClick={() => void runCartAction(() => removeItem(item.variantId))} disabled={isLoading || isSyncing}><Trash2 aria-hidden="true" /></Button></div>
              </div>
            </div>)}
          </div>
          <div className="space-y-4 border-t border-border pt-5">{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}<div className="flex justify-between font-medium"><span>Subtotal</span><span>{currency ? new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(total) : "—"}</span></div><Button className="w-full" size="lg" disabled={!checkoutUrl || isLoading || isSyncing} onClick={() => checkoutCart(checkoutUrl)}>{isLoading || isSyncing ? "Updating your bag…" : "Continue to checkout"}</Button></div>
        </>}
      </SheetContent>
    </Sheet>
  );
}

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const variant = product.variants.edges.map((edge) => edge.node).find((item) => item.availableForSale);
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);
  const [error, setError] = useState<string | null>(null);
  const image = product.images.edges[0]?.node;

  const addToBag = async () => {
    if (!variant) return;
    setError(null);
    try {
      await addItem(product, variant.id, 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The item could not be added.");
    }
  };

  return <article className="group min-w-0">
    <Link to="/product/$handle" params={{ handle: product.handle }} className="block"><div className="aspect-[4/5] overflow-hidden rounded-sm bg-secondary">{image ? <img className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" src={image.url} alt={image.altText ?? product.title} loading="lazy" /> : <div className="grid size-full place-items-center text-muted-foreground"><ShoppingBag aria-hidden="true" /></div>}</div><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-3"><h3 className="min-w-0 text-sm font-medium sm:text-base">{product.title}</h3><p className="shrink-0 text-sm text-muted-foreground">{formatShopifyMoney(product.priceRange.minVariantPrice)}</p></div></Link>
    <Button className="mt-3 w-full" variant="outline" size="sm" disabled={!variant || isLoading} onClick={() => void addToBag()}>{variant ? (isLoading ? "Adding…" : "Add to bag") : "Sold out"}</Button>
    {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
  </article>;
}