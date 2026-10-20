import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { storefrontRequest, type ShopifyMoney, type ShopifyProduct } from "@/lib/shopify-storefront";

export interface CartItem {
  lineId: string;
  productId: string;
  handle: string;
  title: string;
  imageUrl: string | null;
  variantId: string;
  variantTitle: string;
  price: ShopifyMoney;
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartState {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (product: ShopifyProduct, variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
}

interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: { id: string };
}

interface CartPayload {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: { edges: Array<{ node: ShopifyCartLine }> };
}

interface CartMutation<T> {
  cart: T | null;
  userErrors: Array<{ message: string }>;
}

function withOnlineStoreChannel(checkoutUrl: string) {
  const url = new URL(checkoutUrl);
  url.searchParams.set("channel", "online_store");
  return url.toString();
}

function findItem(product: ShopifyProduct, variantId: string, quantity: number, lineId: string): CartItem {
  const variant = product.variants.edges.map((edge) => edge.node).find((item) => item.id === variantId);
  if (!variant) throw new Error("That option is no longer available.");
  return {
    lineId,
    productId: product.id,
    handle: product.handle,
    title: product.title,
    imageUrl: product.images.edges[0]?.node.url ?? null,
    variantId,
    variantTitle: variant.title,
    price: variant.price,
    quantity,
    selectedOptions: variant.selectedOptions,
  };
}

function readMutation<T>(result: CartMutation<T>) {
  if (result.userErrors.length > 0) {
    throw new Error(result.userErrors[0]?.message ?? "The cart could not be updated.");
  }
  if (!result.cart) throw new Error("The cart could not be updated. Please try again.");
  return result.cart;
}

const CART_LINES = `id quantity merchandise { ... on ProductVariant { id } }`;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (product, variantId, quantity) => {
        if (get().isLoading) return;
        const variant = product.variants.edges.map((edge) => edge.node).find((item) => item.id === variantId);
        if (!variant?.availableForSale) throw new Error("This item is currently unavailable.");
        set({ isLoading: true });
        try {
          const current = get();
          const existing = current.items.find((item) => item.variantId === variantId);
          if (!current.cartId) {
            const data = await storefrontRequest<{
              cartCreate: CartMutation<CartPayload>;
            }>(
              `mutation CreateCart($input: CartInput!) {
                cartCreate(input: $input) {
                  cart { id checkoutUrl totalQuantity lines(first: 100) { edges { node { ${CART_LINES} } } } }
                  userErrors { message }
                }
              }`,
              { input: { lines: [{ merchandiseId: variantId, quantity }] } },
            );
            const cart = readMutation(data.cartCreate);
            const line = cart.lines.edges.find((edge) => edge.node.merchandise.id === variantId)?.node;
            if (!line) throw new Error("The item could not be added. Please try again.");
            set({
              cartId: cart.id,
              checkoutUrl: withOnlineStoreChannel(cart.checkoutUrl),
              items: [findItem(product, variantId, quantity, line.id)],
            });
          } else if (existing) {
            const newQuantity = existing.quantity + quantity;
            const data = await storefrontRequest<{
              cartLinesUpdate: CartMutation<{ id: string }>;
            }>(
              `mutation UpdateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
                cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { message } }
              }`,
              { cartId: current.cartId, lines: [{ id: existing.lineId, quantity: newQuantity }] },
            );
            readMutation(data.cartLinesUpdate);
            set({
              items: get().items.map((item) =>
                item.variantId === variantId ? { ...item, quantity: newQuantity } : item,
              ),
            });
          } else {
            const data = await storefrontRequest<{
              cartLinesAdd: CartMutation<CartPayload>;
            }>(
              `mutation AddCartLine($cartId: ID!, $lines: [CartLineInput!]!) {
                cartLinesAdd(cartId: $cartId, lines: $lines) {
                  cart { id checkoutUrl totalQuantity lines(first: 100) { edges { node { ${CART_LINES} } } } }
                  userErrors { message }
                }
              }`,
              { cartId: current.cartId, lines: [{ merchandiseId: variantId, quantity }] },
            );
            const cart = readMutation(data.cartLinesAdd);
            const line = cart.lines.edges.find((edge) => edge.node.merchandise.id === variantId)?.node;
            if (!line) throw new Error("The item could not be added. Please try again.");
            set({
              checkoutUrl: withOnlineStoreChannel(cart.checkoutUrl),
              items: [...get().items, findItem(product, variantId, quantity, line.id)],
            });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity < 1) return get().removeItem(variantId);
        if (get().isLoading) return;
        const { cartId, items } = get();
        const item = items.find((entry) => entry.variantId === variantId);
        if (!cartId || !item) return;
        set({ isLoading: true });
        try {
          const data = await storefrontRequest<{
            cartLinesUpdate: CartMutation<{ id: string }>;
          }>(
            `mutation UpdateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
              cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { message } }
            }`,
            { cartId, lines: [{ id: item.lineId, quantity }] },
          );
          readMutation(data.cartLinesUpdate);
          set({ items: get().items.map((entry) => (entry.variantId === variantId ? { ...entry, quantity } : entry)) });
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        if (get().isLoading) return;
        const { cartId, items, clearCart } = get();
        const item = items.find((entry) => entry.variantId === variantId);
        if (!cartId || !item) return;
        set({ isLoading: true });
        try {
          const data = await storefrontRequest<{
            cartLinesRemove: CartMutation<{ id: string }>;
          }>(
            `mutation RemoveCartLine($cartId: ID!, $lineIds: [ID!]!) {
              cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id } userErrors { message } }
            }`,
            { cartId, lineIds: [item.lineId] },
          );
          readMutation(data.cartLinesRemove);
          const remaining = get().items.filter((entry) => entry.variantId !== variantId);
          if (remaining.length === 0) clearCart();
          else set({ items: remaining });
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const data = await storefrontRequest<{ cart: { totalQuantity: number } | null }>(
            `query GetCart($id: ID!) { cart(id: $id) { totalQuantity } }`,
            { id: cartId },
          );
          if (!data.cart || data.cart.totalQuantity === 0) clearCart();
        } catch {
          // Keep the saved cart when Shopify is temporarily unreachable.
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "shopify-cart",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items, cartId: state.cartId, checkoutUrl: state.checkoutUrl }),
    },
  ),
);

export function checkoutCart(checkoutUrl: string | null) {
  if (!checkoutUrl) return false;
  const checkoutWindow = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  if (checkoutWindow) checkoutWindow.opener = null;
  return Boolean(checkoutWindow);
}