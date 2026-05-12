import { getIntegrationId } from "./integration.js";
import { createPrices } from "./price.js";
import { fetchOrCreateProduct } from "./product.js";
import { fetchAllProductsFromZuora, splitToAddonAndPlans } from "./zuora.js";
import {
  customPlans,
  deleteExisting,
  isDryRun,
  publishMode,
  updateMode,
} from "./arguments.js";
import {
  fetchOrCreatePackage,
  groupZuoraPlansByName,
  publishPackage,
} from "./package.js";
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
    const zuoraPlanMap = groupZuoraPlansByName(zuoraProduct.plans || []);

    const zuoraPlanNames = zuoraPlanMap.keys();
    for (const planName of zuoraPlanNames) {
      const zuoraPlans = zuoraPlanMap.get(planName);
      const zuoraPlanIds = zuoraPlans.map((plan) => plan.id);
      const primaryZuoraPlan = zuoraPlans[0];

      const plan = await fetchOrCreatePackage(
        "Plan",
        primaryZuoraPlan,
        mainProductId,
        zuoraProduct.id,
        zuoraPlanIds,
      );
      await createPrices(zuoraPlans, plan);
      stiggPlans.push(plan);
      console.log("");
    }
  }

  for (const zuoraProduct of addonProducts) {
    const zuoraAddonMap = groupZuoraPlansByName(zuoraProduct.plans || []);

    const zuoraAddonNames = zuoraAddonMap.keys();

    for (const addonName of zuoraAddonNames) {
      const zuoraAddons = zuoraAddonMap.get(addonName);
      const zuoraPlanIds = zuoraAddons.map((addon) => addon.id);
      const primaryZuoraAddon = zuoraAddons[0];

      const addon = await fetchOrCreatePackage(
        "Addon",
        primaryZuoraAddon,
        mainProductId,
        zuoraProduct.id,
        zuoraPlanIds,
      );
      await createPrices(zuoraAddons, addon);
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
    console.log("customPlansMode:", customPlans ? "ENABLED" : "DISABLED");
    console.log("deleteExisting:", deleteExisting ? "ENABLED" : "DISABLED");
    console.log("");

    await main();
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
})();
