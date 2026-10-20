export interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: ShopifyMoney;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  tags: string[];
  priceRange: { minVariantPrice: ShopifyMoney };
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: ShopifyVariant }> };
  options: Array<{ name: string; values: string[] }>;
}

interface ShopifyGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

const SHOPIFY_API_VERSION = "2026-10";
const SHOPIFY_STORE_DOMAIN = "reference-landing-page-oiqbm-n1qssnrs.myshopify.com";
const SHOPIFY_STOREFRONT_TOKEN = "2a4ef27512e0798ce3bdda205e9b45fc";
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

export const SHOPIFY_PRODUCT_FIELDS = `
  id
  title
  description
  handle
  productType
  tags
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 5) { edges { node { url altText } } }
  variants(first: 20) {
    edges {
      node {
        id
        title
        price { amount currencyCode }
        availableForSale
        selectedOptions { name value }
      }
    }
  }
  options { name values }
`;

export async function storefrontRequest<T>(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 402
        ? "Shop checkout is not available yet. Please try again later."
        : "The shop could not be reached. Please try again.",
    );
  }

  const payload = (await response.json()) as ShopifyGraphqlResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "The shop could not be reached.");
  }
  if (!payload.data) throw new Error("The shop returned an empty response.");
  return payload.data;
}

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first, sortKey: TITLE) {
      edges { node { ${SHOPIFY_PRODUCT_FIELDS} } }
    }
  }
`;

const PRODUCT_QUERY = `
  query GetProduct($handle: String!) {
    product(handle: $handle) { ${SHOPIFY_PRODUCT_FIELDS} }
  }
`;

export async function getShopifyProducts() {
  const data = await storefrontRequest<{
    products: { edges: Array<{ node: ShopifyProduct }> };
  }>(PRODUCTS_QUERY, { first: 100 });
  return data.products.edges.map((edge) => edge.node);
}

export async function getShopifyProduct(handle: string) {
  const data = await storefrontRequest<{ product: ShopifyProduct | null }>(PRODUCT_QUERY, { handle });
  return data.product;
}

export function formatShopifyMoney(money: ShopifyMoney) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: money.currencyCode,
    maximumFractionDigits: 2,
  }).format(Number(money.amount));
}

export function isSpiceProduct(product: ShopifyProduct) {
  const category = `${product.productType} ${product.tags.join(" ")} ${product.title}`.toLowerCase();
  return /spice|masala|turmeric|chilli|chili|cumin|pepper|coriander powder|mustard|cardamom|cinnamon|clove|bay leaf|fenugreek|ajwain|fennel/.test(
    category,
  );
}

export function getVegetableCategory(product: ShopifyProduct) {
  const category = `${product.productType} ${product.tags.join(" ")} ${product.title}`.toLowerCase();
  if (/leafy|spinach|palak|lettuce|saag/.test(category)) return "Leafy vegetables";
  if (/root|potato|onion|carrot|beet|radish|ginger|garlic|turmeric/.test(category)) {
    return "Root vegetables";
  }
  if (/herb|coriander|cilantro|mint|parsley|dill/.test(category)) return "Fresh herbs";
  return "All vegetables";
}