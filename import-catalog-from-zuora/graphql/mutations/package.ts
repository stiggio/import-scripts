import { isDryRun } from "../../arguments";
import {
  CreateDraftResponse,
  CreatePackageInput,
  CreatePackageResponse,
  DraftResponse,
  Package,
  packageFields,
  PackageType,
  PublishResponse,
  UpdateAddonResponse,
  UpdatePackageInput,
  UpdatePlanResponse,
} from "../../types/package";

import { sendGraphQLRequest } from "../request";

export function publishPackageMutation<T extends PackageType>(
  type: T,
  packageId: string,
  packageRefId: string
) {
  const query = `mutation Publish${type}($input: PackagePublishInput!) {
  publish${type}(input: $input) {
    taskId
    __typename
  }
}`;

  const variables = {
    input: {
      id: packageId,
      migrationType: "NEW_CUSTOMERS",
    },
  };
  const body = JSON.stringify({ query, variables });
  console.log(`Publishing ${type} with Ref Id: ${packageRefId}...`);
  return sendGraphQLRequest<PublishResponse>(body);
}

export async function createPackageDraftMutation<T extends PackageType>(
  type: T,
  packageId: string
): Promise<DraftResponse | null> {
  if (isDryRun) {
    return null;
  }

  const query = `mutation Create${type}Draft($input: UUID!) {
  create${type}Draft(id: $input) {
    id
    refId
    versionNumber
    __typename
  }
}`;

  const variables = {
    input: packageId,
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<CreateDraftResponse>(body);
  if (response.errors) {
    throw new Error(
      `Error creating draft for ${type} with ID: ${packageId}. Errors: ${JSON.stringify(
        response.errors
      )}`
    );
  }

  const aPackage =
    response.data?.createAddonDraft || response.data?.createPlanDraft || null;

  if (!aPackage) {
    throw new Error(`Failed to create draft for ${type} with ID: ${packageId}`);
  }
  if (aPackage.id) {
    console.log(`Created draft for ${type} with ID: ${aPackage.refId}`);
  }
  return aPackage;
}

export async function createPackageMutation<T extends PackageType>(
  type: T,
  variables: CreatePackageInput
): Promise<Package> {
  if (isDryRun) {
    console.log(
      `[Dry Run]: Would create ${type.toUpperCase()} with next input\n`,
      JSON.stringify(variables, null, 2),
      "\n"
    );
    return {
      id: "dry-run-id-placeholder",
      refId: variables.input.refId,
      type: type,
      productId: variables.input.productId,
      description: variables.input.description,
      displayName: variables.input.displayName,
      prices: [],
    };
  }

  const query = `mutation CreateOne${type}($input: ${type}CreateInput!) {
    createOne${type}(input: $input) {
      ${packageFields}
    }
  }`;

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<CreatePackageResponse>(body);
  if (response.errors) {
    throw new Error(
      `Error creating ${type} with refId: ${
        variables.input.refId
      }. Errors: ${JSON.stringify(response.errors)}`
    );
  }
  const aPackage =
    "createOnePlan" in response.data!
      ? response.data!.createOnePlan!
      : "createOneAddon" in response.data!
      ? (response.data!.createOneAddon! as Package)
      : null;
  if (!aPackage) {
    throw new Error(
      `Failed to create ${type} with refId: ${variables.input.refId}`
    );
  }
  aPackage.type = type;
  return aPackage;
}

export async function updatePackageMutation<T extends PackageType>(
  type: T,
  variables: UpdatePackageInput
): Promise<Package> {
  if (isDryRun) {
    console.log(
      `Dry run: would update PLAN with next input\n`,
      JSON.stringify(variables, null, 2),
      "\n"
    );
    return undefined;
  }
  const query = `mutation UpdateOne${type}($input: ${type}UpdateInput!) {
    updateOne${type}(input: $input) {
      ${packageFields}
    }
  }`;

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<
    UpdatePlanResponse | UpdateAddonResponse
  >(body);
  if (response.errors) {
    throw new Error(
      `Error updating ${type} with ID: ${
        variables.input.id
      }. Errors: ${JSON.stringify(response.errors)}`
    );
  }
  const aPackage =
    "updateOnePlan" in response.data!
      ? response.data!.updateOnePlan!
      : "updateOneAddon" in response.data!
      ? (response.data!.updateOneAddon! as Package)
      : null;
  if (!aPackage) {
    throw new Error(`Failed to update ${type} with ID: ${variables.input.id}`);
  }
  aPackage.type = type;
  return aPackage;
}

export async function unarchivePlanMutation(
  planId: string,
  environmentId: string
) {
  if (isDryRun) {
    console.log(
      `Dry run - skipping unarchivePlanMutation for PLAN ID: ${planId}`
    );
    return null;
  }
  const query = `mutation UnarchivePlan($input: UnArchivePlanInput!) {
  unarchivePlan(input: $input) {
    ${packageFields}
  }
}`;

  const variables = {
    input: {
      id: planId,
      environmentId: environmentId,
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<Package>(body);
  return response;
}

export async function unarchiveAddonMutation(
  planId: string,
  environmentId: string
) {
  if (isDryRun) {
    console.log(
      `Dry run - skipping unarchiveAddonMutation for ADDON ID: ${planId}`
    );
    return null;
  }
  const query = `mutation UnarchiveAddon($input: AddonUnArchiveInput!) {
  unarchiveAddon(input: $input) {
    ${packageFields}
  }
}`;

  const variables = {
    input: {
      id: planId,
      environmentId: environmentId,
    },
  };

  const body = JSON.stringify({ query, variables });
  return sendGraphQLRequest<Package>(body);
}
