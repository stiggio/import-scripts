import { PriceInput, PriceResponse } from "../../types/price";
import { sendGraphQLRequest } from "../request";

export function createPriceMutation(variables: PriceInput) {
  const query = `mutation SetPackagePricing($input: PackagePricingInput!) {
    setPackagePricing(input: $input) {
      packageId
      pricingType
    }
  }`;

  const body = JSON.stringify({ query, variables });
  return sendGraphQLRequest<PriceResponse>(body);
}
