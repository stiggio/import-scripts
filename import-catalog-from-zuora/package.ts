import { isDryRun, environmentId, updateMode } from "./arguments";
import {
  createPackageDraftMutation,
  createPackageMutation,
  publishPackageMutation,
  updatePackageMutation,
} from "./graphql/mutations";
import { queryPackage } from "./graphql/queries";
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
    return draftResponse.id;
  }
  const version = aPackage.draftSummary.version;

  const draftPackage: Package = await queryPackage(
    aPackage.type,
    aPackage.refId!,
    aPackage.productId,
    version,
    false
  );

  const packageId = draftPackage.id;

  if (!packageId) {
    throw new Error(
      `No addon draft found for package with refId: ${aPackage.refId}`
    );
  }
  return packageId;
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

  const existingPackage: Package = await queryPackage(
    type,
    packageInput.input.refId,
    productId,
    undefined,
    true
  );

  if (existingPackage) {
    const existingPackageId = existingPackage.id;
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

  if (isDryRun) {
    console.log(
      `[Dry Run]: Would create ${type.toUpperCase()} with next input\n`,
      JSON.stringify(packageInput, null, 2),
      "\n"
    );
    return {
      id: "dry-run-id-placeholder",
      refId: packageInput.input.refId,
      type: type,
      productId: productId,
      description: packageInput.input.description,
      displayName: packageInput.input.displayName,
      prices: [],
    };
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
  const refId = `${zuoraPlan.name
    .trim()
    .replace(/ - /g, " ")
    .replace(/\s+/g, "_")
    .toLowerCase()}_${zuoraPlan.id.slice(-6)}`;

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
      displayName: zuoraPlan.name,
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

  if (isDryRun) {
    console.log(
      `Dry run: would update PLAN with next input\n`,
      JSON.stringify(planInput, null, 2),
      "\n"
    );
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
    publishPackageMutation(aPackage.type, aPackage.draftId, aPackage.refId);
  }

  if (aPackage.status === "DRAFT") {
    publishPackageMutation(aPackage.type, aPackage.id, aPackage.refId);
  }
  if (aPackage.draftSummary?.version > 0) {
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
    publishPackageMutation(aPackage.type, draftPackage.id, aPackage.refId!);
  }
  console.log(
    `${aPackage.type} with Ref Id: ${aPackage.refId} is already published.`
  );
}
