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
  envId: string,
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

  for (let i = 0; i < featureEntitlements.length; i++) {
    const e = featureEntitlements[i];
    entitlementInputs.push({
      feature: {
        featureId: e.feature.refId,
        hasUnlimitedUsage: e.hasUnlimitedUsage,
        hasSoftLimit: e.hasSoftLimit,
        usageLimit: e.usageLimit,
        resetPeriod: e.resetPeriod,
        isGranted: e.isGranted ?? true,
        order: e.order ?? i + 1,
        behavior: e.behavior,
        description: e.description,
        displayNameOverride: e.displayNameOverride,
      },
    });
  }

  for (let i = 0; i < creditEntitlements.length; i++) {
    const e = creditEntitlements[i];
    entitlementInputs.push({
      credit: {
        customCurrencyId: e.customCurrencyId!,
        amount: e.amount,
        cadence: e.cadence!,
        isGranted: e.isGranted ?? true,
        order: e.order ?? featureEntitlements.length + i + 1,
        behavior: e.behavior,
        description: e.description,
        displayNameOverride: e.displayNameOverride,
      },
    });
  }

  const query = `mutation CreatePackageEntitlements($input: CreatePackageEntitlementsInput!) {
    createPackageEntitlements(input: $input) {
      ... on PackageFeatureEntitlement {
        feature { refId }
      }
      ... on PackageCreditEntitlement {
        amount
      }
    }
  }`;

  const variables = {
    input: {
      packageId,
      environmentId: envId,
      entitlements: entitlementInputs,
    },
  };

  console.log(
    `Creating entitlements input:`,
    JSON.stringify(variables, null, 2)
  );

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<{ data?: unknown; errors?: unknown }>(body);
  console.log(`CreatePackageEntitlements response:`, JSON.stringify(response, null, 2));

  if (response.errors) {
    throw new Error(
      `Error creating entitlements for ${type} with ID: ${packageId}. Errors: ${JSON.stringify(response.errors)}`,
    );
  }

  console.log(
    `Copied ${entitlements.length} entitlements to ${type} with ID: ${packageId}`,
  );
}
