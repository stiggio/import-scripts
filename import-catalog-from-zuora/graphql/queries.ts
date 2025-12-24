import { error } from "console";
import {
  BillingProductsResponse,
  productFields,
  SearchIntegrationsResponse,
  SearchProductsResponse,
  Package,
  packageFields,
  PackageType,
  SearchAddonsResponse,
  SearchPlansResponse,
} from "../types";
import { sendGraphQLRequest } from "./request";
import { isDryRun } from "../arguments";

type PackageResponse<T extends PackageType> = T extends "Plan"
  ? SearchPlansResponse
  : T extends "Addon"
  ? SearchAddonsResponse
  : never;

export async function queryPackage<T extends PackageType>(
  type: T,
  refId: string,
  productId: string,
  versionNumber?: number,
  isLatest?: boolean
): Promise<Package | null> {
  const query = `query ${type}s($filter: ${type}Filter) {
    ${type.toLowerCase()}s(filter: $filter) {
      edges {
        node {
          ${packageFields}
        }
      }
    }
  }`;

  const variables = {
    filter: {
      refId: { eq: refId },
      productId: { eq: productId },
      ...(versionNumber !== undefined
        ? { versionNumber: { eq: versionNumber } }
        : {}),
      ...(isLatest ? { isLatest: { is: isLatest } } : {}),
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<PackageResponse<T>>(body);
  if (response.errors) {
    if (isDryRun) {
      return null;
    }
    throw new Error(
      `Error fetching ${type} with refId: ${refId}, productId: ${productId}. Errors: ${JSON.stringify(
        response.errors
      )}`
    );
  }
  const aPackage =
    response.data?.[type === "Plan" ? "plans" : "addons"].edges[0]?.node;
  if (!aPackage) {
    return null;
  }
  aPackage.type = type;
  return aPackage;
}

export async function queryProduct(refId: string) {
  const query = `query Products($filter: ProductFilter) {
  products(filter: $filter) {
    edges {
      node {
        ${productFields}
      }
    }
  }
}`;
  const variables = {
    filter: {
      refId: {
        eq: refId,
      },
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<SearchProductsResponse>(body);
  if (response.errors) {
    throw new Error(
      `Error fetching product with refId: ${refId}. Errors: ${JSON.stringify(
        response.errors
      )}`
    );
  }
  return response;
}

export async function queryBillingProducts(
  zuoraProductId: string,
  integrationId: string
) {
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
  if (response.errors) {
    throw new Error(
      `Error fetching billing products from Zuora for product ID: ${zuoraProductId}. Errors: ${JSON.stringify(
        response.errors
      )}`
    );
  }
  return response;
}

export async function queryZuoraIntegration(environmentId: string) {
  const query = `query Integrations($filter: IntegrationFilter) {
  integrations(filter: $filter) {
    edges {
      node {
        environment {
          id
        }
        integrationId
        id
      }
    }
  }
}`;
  const variables = {
    filter: {
      environmentId: {
        eq: environmentId,
      },
      vendorIdentifier: {
        eq: "ZUORA",
      },
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<SearchIntegrationsResponse>(body);
  if (response.errors) {
    throw new Error(
      `Error fetching Zuora integration for environment ID: ${environmentId}. Errors: ${JSON.stringify(
        response.errors
      )}`
    );
  }
  return response;
}
