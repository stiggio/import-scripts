import { findZuoraIntegration } from "./integration.js";
import { fetchOrCreatePlan } from "./plan.js";
import { createPricesForPlan } from "./price.js";
import { fetchOrCreateProduct } from "./product.js";
import type { BillingProductsResponse, ZuoraProduct } from "./types.js";
import { getProductFromZuora } from "./zuora.js";

import { environmentId } from "./arguments.js";

async function main() {
  const integration = await findZuoraIntegration(environmentId);
  const integrationId = integration.data.integrations.edges[0].node.id;
  if (integration.errors) {
    throw new Error(
      `Error fetching Zuora integration: ${JSON.stringify(integration.errors)}`
    );
  }

  const billingProductsResponse: BillingProductsResponse =
    await getProductFromZuora(integrationId);
  if (billingProductsResponse.errors) {
    throw new Error(
      `Error fetching product from Zuora: ${JSON.stringify(
        billingProductsResponse.errors
      )}`
    );
  }
  const zuoraProducts =
    (billingProductsResponse.data?.billingProducts
      ?.products as ZuoraProduct[]) || [];
  if (zuoraProducts.length === 0) {
    console.log("No products found in Zuora for the given product ID.");
    return;
  }
  for (const zuoraProduct of zuoraProducts) {
    const productId = await fetchOrCreateProduct(zuoraProduct);
    for (const zuoraPlan of zuoraProduct.plans || []) {
      const planId = await fetchOrCreatePlan(zuoraPlan, productId);
      await createPricesForPlan(zuoraPlan, planId);
    }
  }
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
})();
