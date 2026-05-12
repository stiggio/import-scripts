import { isDryRun } from "../../arguments";
import {
  PackageEntitlement,
  PackageCreditEntitlement,
  PackageType,
} from "../../types/package";
import { sendGraphQLRequest } from "../request";

function isFeatureEntitlement(
  e: PackageEntitlement,
): e is import("../../types/package").PackageFeatureEntitlement {
  return "hasUnlimitedUsage" in e;
}

function isCreditEntitlement(
  e: PackageEntitlement,
): e is PackageCreditEntitlement {
  return "amount" in e;
}

export async function createPackageEntitlementsMutation(
  type: PackageType,
  packageId: string,
  entitlements: PackageEntitlement[],
): Promise<void> {
  if (isDryRun) {
    console.log(
      `[Dry Run]: Would copy ${entitlements.length} entitlements to ${type} with ID: ${packageId}`,
    );
    return;
  }

  if (entitlements.length === 0) {
    console.log(`No entitlements to copy for ${type} with ID: ${packageId}`);
    return;
  }

  const featureEntitlements = entitlements.filter(isFeatureEntitlement);
  const creditEntitlements = entitlements.filter(isCreditEntitlement);

  const entitlementInputs: Record<string, unknown>[] = [];

  for (const e of featureEntitlements) {
    entitlementInputs.push({
      featureId: e.feature.refId,
      hasUnlimitedUsage: e.hasUnlimitedUsage,
      usageLimit: e.usageLimit,
      resetPeriod: e.resetPeriod,
    });
  }

  for (const e of creditEntitlements) {
    entitlementInputs.push({
      featureId: e.feature.refId,
      amount: e.amount,
      cadence: e.cadence,
      customCurrencyId: e.customCurrencyId,
    });
  }

  const query = `mutation CreatePackageEntitlements($input: CreatePackageEntitlementsInput!) {
    createPackageEntitlements(input: $input) {
      ... on PackageFeatureEntitlement {
        feature { refId }
      }
      ... on PackageCreditEntitlement {
        feature { refId }
      }
    }
  }`;

  const variables = {
    input: {
      packageId,
      entitlements: entitlementInputs,
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<{ errors?: unknown }>(body);

  if (response.errors) {
    throw new Error(
      `Error creating entitlements for ${type} with ID: ${packageId}. Errors: ${JSON.stringify(response.errors)}`,
    );
  }

  console.log(
    `Copied ${entitlements.length} entitlements to ${type} with ID: ${packageId}`,
  );
}
