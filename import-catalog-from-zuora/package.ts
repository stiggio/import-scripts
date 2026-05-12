import { isDryRun, environmentId, updateMode } from "./arguments";
import { GRANDFATHERED_KEY, GRANDFATHERED_VALUE } from "./constants";
import {
  createPackageDraftMutation,
  createPackageMutation,
  createPackageEntitlementsMutation,
  publishPackageMutation,
  unarchiveAddonMutation,
  unarchivePlanMutation,
  updatePackageMutation,
} from "./graphql/mutations";
import { queryPackage, queryPackageByRefId } from "./graphql/queries";
import { getDiscountPercentage } from "./price";
import { ZuoraPlan } from "./types/integration";
import {
  CreatePackageInput,
  Package,
  PackageType,
  UpdatePackageInput,
} from "./types/package";

export async function getPackageDraftId(aPackage: Package) {
  if (aPackage.status === "DRAFT") {
    return aPackage.id;
  }
  if (!aPackage.draftSummary) {
    const draftResponse = await createPackageDraftMutation(
      aPackage.type,
      aPackage.id
    );
    return draftResponse!.id;
  }
  const version = aPackage.draftSummary.version;

  const draftPackage = await queryPackage(
    aPackage.type,
    aPackage.refId!,
    aPackage.productId,
    version,
    false
  );

  if (!draftPackage?.id) {
    throw new Error(
      `No addon draft found for package with refId: ${aPackage.refId}`
    );
  }
  return draftPackage.id;
}

function isGrandfathered(aPackage: Package): boolean {
  const meta = aPackage.additionalMetaData;
  if (!meta) return false;
  return Object.entries(meta).some(
    ([key, value]) =>
      key.toLowerCase() === GRANDFATHERED_KEY.toLowerCase() &&
      value.toLowerCase() === GRANDFATHERED_VALUE.toLowerCase()
  );
}

type ResolvedRefId = {
  refId: string;
  grandfatheredSource?: Package;
};

export async function resolveTargetRefId(
  type: PackageType,
  baseRefId: string,
  productId: string
): Promise<ResolvedRefId> {
  let currentRefId = baseRefId;
  let lastGrandfathered: Package | undefined;

  const existingBase = await queryPackage(
    type,
    currentRefId,
    productId,
    undefined,
    true
  );

  if (!existingBase || !isGrandfathered(existingBase)) {
    return { refId: currentRefId };
  }

  lastGrandfathered = existingBase;

  for (let version = 1; version <= 100; version++) {
    const versionedRefId = `${baseRefId}-copy-${version}`;
    const versionedPackage = await queryPackage(
      type,
      versionedRefId,
      productId,
      undefined,
      true
    );

    if (!versionedPackage) {
      return { refId: versionedRefId, grandfatheredSource: lastGrandfathered };
    }

    if (!isGrandfathered(versionedPackage)) {
      return { refId: versionedRefId };
    }

    lastGrandfathered = versionedPackage;
  }

  throw new Error(
    `Too many grandfathered versions for ${type} with base refId: ${baseRefId}`
  );
}

export async function copyEntitlements(
  type: PackageType,
  sourceRefId: string,
  targetPackageId: string
): Promise<void> {
  const sourceWithEntitlements = await queryPackageByRefId(
    type,
    sourceRefId,
    true,
    environmentId
  );

  console.log(
    `Source ${type} entitlements:`,
    JSON.stringify(sourceWithEntitlements?.packageEntitlements, null, 2)
  );

  if (!sourceWithEntitlements?.packageEntitlements?.length) {
    console.log(
      `No entitlements found on source ${type} with refId: ${sourceRefId}, skipping copy.`
    );
    return;
  }

  await createPackageEntitlementsMutation(
    type,
    targetPackageId,
    sourceWithEntitlements.packageEntitlements,
    environmentId
  );
}

export async function fetchOrCreatePackage(
  type: PackageType,
  zuoraPlan: ZuoraPlan,
  productId: string,
  zuoraProductId: string
): Promise<Package> {
  const packageInput = getCreatePackageInput(
    type,
    zuoraPlan,
    productId,
    zuoraProductId
  );

  const baseRefId = packageInput.input.refId!;
  const { refId: targetRefId, grandfatheredSource } = await resolveTargetRefId(
    type,
    baseRefId,
    productId
  );

  if (grandfatheredSource) {
    console.log(
      `${isDryRun ? "[Dry Run]: " : ""}${type} with refId ${grandfatheredSource.refId} is grandfathered, creating new version: ${targetRefId}`
    );
  }

  packageInput.input.refId = targetRefId;

  const existingPackage = await queryPackage(
    type,
    packageInput.input.refId!,
    productId,
    undefined,
    true
  );

  if (existingPackage) {
    if (existingPackage.status === "ARCHIVED") {
      if (existingPackage.type == "Plan") {
        await unarchivePlanMutation(existingPackage.refId, environmentId);
      } else {
        await unarchiveAddonMutation(existingPackage.refId, environmentId);
      }
    }
    console.log(
      `${
        isDryRun ? "[Dry Run]: " : ""
      }${type} already exists in Stigg with ID: ${
        existingPackage.refId
      }, proceeding to add prices.`
    );
    const updatedPackage = await updatePackageIfNeeded(
      type,
      existingPackage,
      packageInput
    );
    if (updatedPackage === undefined) {
      return existingPackage;
    }
    return updatedPackage;
  }

  const createdPackage = await createPackageMutation(type, packageInput);

  const packageId = createdPackage.id;

  if (!packageId) {
    throw new Error(
      `Failed to create or find ${type.toLowerCase()} in Stigg for Zuora ${type} ID: ${
        zuoraPlan.id
      }`
    );
  }

  console.log(
    `${
      isDryRun ? "[Dry Run]: " : ""
    }Created new ${type} in Stigg with Ref Id: ${createdPackage.refId}`
  );

  if (grandfatheredSource) {
    await copyEntitlements(type, grandfatheredSource.refId, createdPackage.id);
  }

  return createdPackage;
}

function getCreatePackageInput(
  type: PackageType,
  zuoraPlan: ZuoraPlan,
  productId: string,
  zuoraProductId: string
): CreatePackageInput {
  if (isDryRun) {
    return {
      input: {
        refId: `dry-run-${type.toLowerCase()}-${zuoraPlan.id}`,
        displayName: zuoraPlan.name,
        description: zuoraPlan.description || "",
        productId: productId,
        additionalMetaData: {},
        billingId: zuoraProductId,
        environmentId,
        pricingType: "PAID",
        status: "DRAFT",
      },
    };
  }
  const nameWithoutBillingPeriod = removeBillingPeriodFromName(zuoraPlan.name);
  const refId = `${nameWithoutBillingPeriod
    .trim()
    .replace(/ - /g, " ")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.\-]/g, "")}`;

  const discountPercentage = getDiscountPercentage(zuoraPlan);

  const isPaid =
    type === "Plan"
      ? zuoraPlan.prices?.some((price) => (price.amount || 0) > 0) ?? false
      : true;

  const additionalMetaData: Record<string, string> = {
    ZUORA__SYNC_SKIP_UPDATE: "true",
  };
  if (discountPercentage && discountPercentage > 0) {
    additionalMetaData.ZUORA__DISCOUNT_PERCENTAGE = `${discountPercentage}`;
  }

  return {
    input: {
      refId,
      displayName: nameWithoutBillingPeriod,
      description: zuoraPlan.description || "",
      productId,
      additionalMetaData,
      billingId: zuoraProductId,
      environmentId,
      pricingType: isPaid ? "PAID" : "FREE",
      status: "DRAFT",
    },
  };
}

function removeBillingPeriodFromName(name: string): string {
  const cleanedName = name
    .replace(/(Monthly|Yearly|Annually|Annual)/i, "")
    .trim();
  return cleanedName.replace(/--/g, "-").replace(/-\s*-/g, "-");
}

export function groupZuoraPlansByName(
  zuoraPlans: ZuoraPlan[]
): Map<string, ZuoraPlan[]> {
  const planMap = new Map<string, ZuoraPlan[]>();
  zuoraPlans.forEach((plan) => {
    const nameWithoutBillingPeriod = removeBillingPeriodFromName(plan.name);

    const addedPlans = planMap.get(nameWithoutBillingPeriod) || [];
    planMap.set(nameWithoutBillingPeriod, [...addedPlans, plan]);
  });
  console.log(
    `Grouped ${zuoraPlans.length} Zuora plans into ${planMap.size} unique plan names.`
  );
  return planMap;
}

export async function updatePackageIfNeeded<T extends PackageType>(
  type: T,
  aPackage: Package,
  planInput: CreatePackageInput
): Promise<Package | undefined> {
  if (!updateMode) {
    return undefined;
  }

  const needsUpdate =
    aPackage.displayName !== planInput.input.displayName ||
    aPackage.description !== planInput.input.description;

  if (!needsUpdate) {
    console.log(`No updates needed for plan with Ref Id: ${aPackage.refId}`);
    return undefined;
  }

  const updatePlanInput: UpdatePackageInput = {
    input: {
      id: aPackage.id,
      billingId: planInput.input.billingId,
      displayName: planInput.input.displayName,
      description: planInput.input.description,
      additionalMetaData: planInput.input.additionalMetaData,
    },
  };

  console.log(`Updating ${type} with Ref Id: ${aPackage.refId} in Stigg...`);

  return updatePackageMutation<T>(type, updatePlanInput);
}

export function isAddon(name: string): boolean {
  const addonKeywords = ["addon", "add-on"];
  const lowerCaseName = name.toLowerCase();
  return addonKeywords.some((keyword) => lowerCaseName.includes(keyword));
}

export async function publishPackage(aPackage: Package) {
  if (aPackage.draftId) {
    await publishPackageMutation(aPackage.type, aPackage.draftId, aPackage.refId);
    return;
  }

  if (aPackage.status === "DRAFT") {
    await publishPackageMutation(aPackage.type, aPackage.id, aPackage.refId);
    return;
  }

  if (aPackage.draftSummary && aPackage.draftSummary.version > 0) {
    const draftPackage = await queryPackage(
      "Plan",
      aPackage.refId!,
      aPackage.productId,
      aPackage.draftSummary.version,
      false
    );
    if (!draftPackage?.id) {
      console.log(`No draft found for package with refId: ${aPackage.refId}`);
      return;
    }
    await publishPackageMutation(aPackage.type, draftPackage.id, aPackage.refId!);
    return;
  }

  console.log(
    `${aPackage.type} with Ref Id: ${aPackage.refId} is already published.`
  );
}
