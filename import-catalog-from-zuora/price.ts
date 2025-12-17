import type { BillingModel, PriceInput, PriceModel, ZuoraPlan, ZuoraPrice, PriceResponse } from './types.js';
import { sendGraphQLRequest } from './graphql.js';

import { environmentId, isDryRun } from './arguments.js';

function createPrice(variables: PriceInput) {
  const query = `mutation SetPackagePricing($input: PackagePricingInput!) {
    setPackagePricing(input: $input) {
      packageId
      pricingType
    }
  }`;

  const body = JSON.stringify({ query, variables });
  return sendGraphQLRequest<PriceResponse>(body);
}

export function getDiscountPercentage(zuoraPlan: ZuoraPlan) {
  const discountCharge = zuoraPlan.prices.find(
    (price) => `${price.chargeModel}`.toLowerCase() === 'discount_percentage',
  );
  if (!discountCharge) {
    return 0;
  }
  return discountCharge.discountPercent || 0;
}

function getPriceModel(zuoraPrice: ZuoraPrice, zuoraPlan: ZuoraPlan): PriceModel | null {
  const discountPercentage = getDiscountPercentage(zuoraPlan);
  const discountedAmount = (zuoraPrice.amount || 0) * (1 - discountPercentage / 100);

  const { billingPeriod } = zuoraPrice;
  let billingModel: BillingModel;
  if (zuoraPrice.chargeModel.toLowerCase() === 'flat_fee') {
    billingModel = 'FLAT_FEE';
  } else {
    console.log('Skipping price creation. Unsupported charge model:', zuoraPrice.chargeModel);
    return null;
  }

  return {
    billingId: zuoraPrice.id,
    billingCadence: 'RECURRING',
    billingModel,
    pricePeriods: [
      {
        billingPeriod,
        price: {
          amount: discountedAmount,
          currency: 'USD',
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
      pricingType: 'PAID',
    },
  };
  return priceInput;
}

export async function createPricesForPlan(zuoraPlan: ZuoraPlan, stiggPlanId: string) {
  const priceInput: PriceInput | null = getPriceInputV2(zuoraPlan, stiggPlanId);
  if (!priceInput) {
    return;
  }

  if (isDryRun) {
    console.log(`Dry run: would create PRICE with next input\n`, JSON.stringify(priceInput, null, 2), '\n');
    return;
  }

  const priceCreateResponse = await createPrice(priceInput);
  if (priceCreateResponse.errors) {
    throw new Error(
      `Failed to create price in Stigg for Zuora Prices for the plan: ${zuoraPlan.id}, Errors: ${JSON.stringify(
        priceCreateResponse.errors,
      )}`,
    );
  }
  console.log(
    `Created price for plan ID: ${stiggPlanId}, Price type: ${priceCreateResponse.data?.setPackagePricing?.pricingType}`,
  );
}
