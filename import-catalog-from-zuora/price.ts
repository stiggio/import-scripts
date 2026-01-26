import type { BillingModel, PriceInput, PriceModel } from "./types/price.js";

import { environmentId, isDryRun } from "./arguments.js";
import { getPackageDraftId } from "./package.js";
import { ZuoraPlan, ZuoraPrice } from "./types/integration.js";
import { Package, PackagePrice } from "./types/package.js";
import { createPriceMutation } from "./graphql/mutations";

export function getDiscountPercentage(zuoraPlan: ZuoraPlan) {
  const discountCharge = zuoraPlan.prices.find(
    (price) => `${price.chargeModel}`.toLowerCase() === "discount_percentage"
  );
  if (!discountCharge) {
    return 0;
  }
  return discountCharge.discountPercent || 0;
}

function getPriceModel(
  zuoraPrice: ZuoraPrice,
  zuoraPlan: ZuoraPlan
): PriceModel | null {
  const discountPercentage = getDiscountPercentage(zuoraPlan);
  const discountedAmount =
    (zuoraPrice.amount || 0) * (1 - discountPercentage / 100);

  const { billingPeriod } = zuoraPrice;
  let billingModel: BillingModel;
  if (zuoraPrice.chargeModel.toLowerCase() === "flat_fee") {
    billingModel = "FLAT_FEE";
  } else {
    console.log(
      "Skipping price creation. Unsupported charge model:",
      zuoraPrice.chargeModel
    );
    return null;
  }

  return {
    billingCadence: "RECURRING",
    billingModel,
    pricePeriods: [
      {
        priceGroupPackageBillingId: zuoraPlan.id,
        billingId: zuoraPrice.id,
        billingPeriod,
        price: {
          amount: discountedAmount,
          currency: "USD",
        },
      },
    ],
  };
}

function getPriceInput(zuoraPlan: ZuoraPlan, stiggPlanId: string) {
  const priceModels = zuoraPlan.prices
    .map((price) => getPriceModel(price, zuoraPlan))
    .filter((pm) => pm !== null) as PriceModel[];

  const groupedPriceModels = groupPriceModels(priceModels);

  const priceInput: PriceInput = {
    input: {
      environmentId,
      packageId: stiggPlanId!,
      pricingModels: groupedPriceModels,
      pricingType: "PAID", // Will be determined in createPrices based on all grouped plans
    },
  };
  return priceInput;
}

function determinePricingType(priceInputs: PriceInput[]): "PAID" | "CUSTOM" {
  const allPrices = priceInputs.flatMap((pi) =>
    pi.input.pricingModels.flatMap((pm) =>
      pm.pricePeriods.map((pp) => pp.price.amount)
    )
  );

  const hasNonZeroPrice = allPrices.some((amount) => amount > 0);
  return hasNonZeroPrice ? "PAID" : "CUSTOM";
}

export function shouldSetNewPrice(priceInput: PriceInput, aPackage: Package) {
  const existingPrices: PackagePrice[] = aPackage.prices;
  if (priceInput.input.pricingModels.length === 0) {
    console.log(
      `No valid price models to set for package Ref Id: ${aPackage.refId}, skipping price update.`
    );
    return false;
  }
  if (!existingPrices || existingPrices.length === 0) {
    return true;
  }
  for (const priceInputModel of priceInput.input.pricingModels) {
    for (const billingModel of priceInputModel.pricePeriods) {
      const matchingExistingPrice = existingPrices.find(
        (existingPrice) =>
          existingPrice.billingId ===
            priceInputModel.pricePeriods[0]?.billingId &&
          existingPrice.billingPeriod === billingModel.billingPeriod &&
          existingPrice.price.amount === billingModel.price.amount &&
          existingPrice.billingModel === priceInputModel.billingModel &&
          existingPrice.billingCadence === priceInputModel.billingCadence
      );
      if (!matchingExistingPrice) {
        return true;
      }
    }
  }
  console.log(
    `Price with same models already exists for package Ref Id: ${aPackage.refId}, skipping price update.`
  );
  return false;
}

function groupPriceInputs(priceInputs: PriceInput[]): PriceInput {
  if (priceInputs.length === 0) {
    return null;
  }
  const priceModels = priceInputs.flatMap((pi) => pi.input.pricingModels);
  const groupedModels = groupPriceModels(priceModels);
  const groupedPriceInput: PriceInput = priceInputs[0];
  groupedPriceInput.input.pricingModels = groupedModels;
  groupedPriceInput.input.pricingType = determinePricingType(priceInputs);

  return groupedPriceInput;
}

function groupPriceModels(priceModels: PriceModel[]): PriceModel[] {
  const groupedModels: PriceModel[] = [];
  for (const priceModel of priceModels) {
    const index = groupedModels.findIndex(
      (pm) =>
        pm.billingModel === priceModel.billingModel &&
        pm.billingCadence === priceModel.billingCadence
    );
    if (index !== -1) {
      groupedModels[index].pricePeriods.push(...priceModel.pricePeriods);
    } else {
      groupedModels.push(priceModel);
    }
  }
  return groupedModels;
}

export async function createPrices(zuoraPlans: ZuoraPlan[], aPackage: Package) {
  const priceInputs = zuoraPlans
    .map((zuoraPlan) => getPriceInput(zuoraPlan, aPackage.id))
    .filter((pi) => pi !== null) as PriceInput[];

  const groupedPriceInput = groupPriceInputs(priceInputs);

  if (groupedPriceInput?.input.pricingType === "CUSTOM") {
    console.log(
      `Skipping price creation for custom plan: ${aPackage.refId} (all prices are $0)`
    );
    return;
  }

  if (!shouldSetNewPrice(groupedPriceInput, aPackage)) {
    return;
  }

  if (isDryRun) {
    console.log(
      `[Dry Run]: would set PRICE with next input\n`,
      JSON.stringify(groupedPriceInput, null, 2),
      "\n"
    );
    return;
  }

  let draftId = await getPackageDraftId(aPackage);
  aPackage.draftId = draftId;
  groupedPriceInput.input.packageId = draftId!;

  const priceCreateResponse = await createPriceMutation(groupedPriceInput);
  if (priceCreateResponse.errors) {
    console.error(
      "Failed to create price input:",
      JSON.stringify(groupedPriceInput, null, 2)
    );
    throw new Error(
      `Failed to create price in Stigg for the plan: ${
        aPackage.id
      }, Errors: ${JSON.stringify(priceCreateResponse.errors)}`
    );
  }
  console.log(
    `Created price for plan ID: ${aPackage.id}, Price type: ${priceCreateResponse.data?.setPackagePricing?.pricingType}`
  );
}
