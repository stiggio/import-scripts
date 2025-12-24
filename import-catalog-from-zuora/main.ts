import { getIntegrationId } from "./integration.js";
import { createPrices } from "./price.js";
import { fetchOrCreateProduct } from "./product.js";
import { fetchAllProductsFromZuora, splitToAddonAndPlans } from "./zuora.js";
import { isDryRun, publishMode, updateMode } from "./arguments.js";
import { fetchOrCreatePackage, publishPackage } from "./package.js";
import { assignAddonsToPlans } from "./addon.js";
import { Package } from "./types";

async function main() {
  const integrationId = await getIntegrationId();

  const stiggPlans: Package[] = [];
  const stiggAddons: Package[] = [];

  const zuoraProducts = await fetchAllProductsFromZuora(integrationId);
  if (zuoraProducts.length === 0) {
    console.log("No Zuora products found to import.");
    return;
  }
  const { addonProducts, planProducts } = splitToAddonAndPlans(zuoraProducts);

  const mainProductId = await fetchOrCreateProduct(zuoraProducts[0]);
  console.log("");

  for (const zuoraProduct of planProducts) {
    for (const zuoraPlan of zuoraProduct.plans || []) {
      const plan = await fetchOrCreatePackage(
        "Plan",
        zuoraPlan,
        mainProductId,
        zuoraProduct.id
      );
      await createPrices(zuoraPlan, plan);
      stiggPlans.push(plan);
      console.log("");
    }
  }

  for (const zuoraProduct of addonProducts) {
    for (const zuoraAddon of zuoraProduct.plans || []) {
      const addon = await fetchOrCreatePackage(
        "Addon",
        zuoraAddon,
        mainProductId,
        zuoraProduct.id
      );
      await createPrices(zuoraAddon, addon);
      stiggAddons.push(addon);
      console.log("");
    }
  }

  if (publishMode && !isDryRun) {
    await Promise.all(stiggAddons.map((addon) => publishPackage(addon)));
    console.log("");
    await assignAddonsToPlans(stiggPlans, stiggAddons);
    console.log("");
    await Promise.all(stiggPlans.map((plan) => publishPackage(plan)));
  }
}

(async () => {
  try {
    console.log("publishMode:", publishMode ? "ENABLED" : "DISABLED");
    console.log("updateMode:", updateMode ? "ENABLED" : "DISABLED");
    console.log("");

    await main();
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
})();
