import type { ZuoraProduct } from "./types/integration.js";
import { zuoraProductIds } from "./arguments.js";
import { isAddon } from "./addon.js";
import { queryBillingProducts } from "./graphql/queries.js";

export async function fetchAllProductsFromZuora(integrationId: string) {
  const productIds = zuoraProductIds.split(",").map((id) => id.trim());
  const products: ZuoraProduct[] = [];
  [];

  for (const productId of productIds) {
    const response = await queryBillingProducts(productId, integrationId);
    if (response.data.billingProducts.products.length === 0) {
      console.warn(`No product found in Zuora for ID: ${productId}`);
      continue;
    }
    products.push(...response.data.billingProducts.products);
  }

  return products;
}

export function splitToAddonAndPlans(zuoraProducts: ZuoraProduct[]) {
  const addonProducts: ZuoraProduct[] = [];
  const planProducts: ZuoraProduct[] = [];

  for (const product of zuoraProducts) {
    const addons = product.plans.filter((plan) => isAddon(plan.name));
    if (addons.length > 0) {
      const addonProduct: ZuoraProduct = {
        ...product,
        plans: addons,
      };
      addonProducts.push(addonProduct);
    }

    const regularPlans = product.plans.filter((plan) => !isAddon(plan.name));
    if (regularPlans.length > 0) {
      const planProduct: ZuoraProduct = {
        ...product,
        plans: regularPlans,
      };
      planProducts.push(planProduct);
    }
  }

  return { addonProducts, planProducts };
}
