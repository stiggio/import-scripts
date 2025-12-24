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
    billingId: zuoraPrice.id,
    billingCadence: "RECURRING",
    billingModel,
    pricePeriods: [
      {
        billingPeriod,
        price: {
          amount: discountedAmount,
          currency: "USD",
        },
      },
    ],
  };
}

function getPriceInputV2(zuoraPlan: ZuoraPlan, stiggPlanId: string) {
  const priceModels = zuoraPlan.prices
    .map((price) => getPriceModel(price, zuoraPlan))
    .filter((pm) => pm !== null) as PriceModel[];

  const priceInput: PriceInput = {
    input: {
      environmentId,
      packageId: stiggPlanId!,
      priceGroupPackageBillingId: zuoraPlan.id,
      pricingModels: priceModels,
      pricingType: "PAID",
    },
  };
  return priceInput;
}

export function shouldSetNewPrice(priceInput: PriceInput, aPackage: Package) {
  const existingPrices: PackagePrice[] = aPackage.prices;
  if (!existingPrices || existingPrices.length === 0) {
    return true;
  }
  for (const priceInputModel of priceInput.input.pricingModels) {
    for (const billingModel of priceInputModel.pricePeriods) {
      const matchingExistingPrice = existingPrices.find(
        (existingPrice) =>
          existingPrice.billingId === priceInputModel.billingId &&
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

export async function createPrices(zuoraPlan: ZuoraPlan, aPackage: Package) {
  const priceInput: PriceInput | null = getPriceInputV2(zuoraPlan, aPackage.id);
  if (!priceInput || !shouldSetNewPrice(priceInput, aPackage)) {
    return;
  }

  if (isDryRun) {
    console.log(
      `[Dry Run]: would set PRICE with next input\n`,
      JSON.stringify(priceInput, null, 2),
      "\n"
    );
    return;
  }

  if (aPackage.type == undefined) {
    console.log(JSON.stringify(aPackage, null, 2));
    return;
  }

  let draftId = await getPackageDraftId(aPackage);
  aPackage.draftId = draftId;
  priceInput.input.packageId = draftId!;

  const priceCreateResponse = await createPriceMutation(priceInput);
  if (priceCreateResponse.errors) {
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
