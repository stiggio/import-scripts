import type { BillingProductsResponse } from "./types.js";
import { sendGraphQLRequest } from "./graphql.js";

import { zuoraProductId } from "./arguments.js";

export async function getProductFromZuora(integrationId: string) {
  const query = `query BillingProducts($input: BillingProductsInput!) {
  billingProducts(input: $input) {
      products {
        id
        name
        description
        plans {
          id
          name
          description
          active
          prices {
            id
            amount
            billingPeriod
            usage
            chargeModel
            discountPercent
          }
        }
      }
    }
  }`;
  const variables = {
    input: {
      productNameOrId: zuoraProductId,
      integrationId: integrationId,
    },
  };
  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<BillingProductsResponse>(body);
  return response;
}
