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

  return (
    response.data?.createPlanDraft ?? response.data?.createAddonDraft ?? null
  );
}

export async function createPackageMutation<T extends PackageType>(
  type: T,
  variables: CreatePackageInput
): Promise<Package> {
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
