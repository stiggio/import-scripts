import { EntityResponse, QueryResponse } from "./abstract";

export const packageFields = `
        displayName
        description
        id
        refId
        status
        productId
        draftSummary {
          version
        }
        prices {
          billingCadence
          billingId
          billingModel
          billingPeriod
          id
          price {
            currency
            amount
          }
        }`;

export type PackagePrice = {
  billingCadence: string;
  billingId: string;
  billingModel: string;
  billingPeriod: string;
  id: string;
  price: {
    currency: string;
    amount: number;
  };
};

export type Package = {
  id: string;
  refId: string;
  displayName: string;
  description: string;
  status?: string;
  type: "Plan" | "Addon";
  productId: string;
  draftSummary?: {
    version: number;
  };
  prices: PackagePrice[];
  draftId?: string;
};

export type SearchPackageResponse<T extends string> = QueryResponse<T, Package>;

export type SearchPlansResponse = SearchPackageResponse<"plans">;
export type SearchAddonsResponse = SearchPackageResponse<"addons">;

export type PackageResponse<T extends string> = EntityResponse<T, Package>;

export type UpdatePlanResponse = PackageResponse<"updateOnePlan">;
export type CreatePlanResponse = PackageResponse<"createOnePlan">;
export type CreateAddonResponse = PackageResponse<"createOneAddon">;
export type UpdateAddonResponse = PackageResponse<"updateOneAddon">;

export type AddCompatibleAddonsToPlanResponse = {
  data: {
    addCompatibleAddonsToPlan: {
      id: string;
      __typename: string;
    };
  };
};

export type PublishResponse = {
  data: {
    publishAddon: {
      taskId: string | null;
      __typename: string;
    };
  };
};

export type DraftResponse = {
  id: string;
  refId: string;
  versionNumber: number;
  __typename: string;
};

export type CreateDraftResponse = {
  data: {
    createPlanDraft?: DraftResponse;
    createAddonDraft?: DraftResponse;
  };
  errors?: unknown;
};

export type PackageType = "Plan" | "Addon";

export type PackageInput = {
  additionalMetaData?: {
    ZUORA__SYNC_SKIP_UPDATE?: string;
  };
  billingId?: string;
  description: string;
  displayName: string;
  environmentId?: string;
  pricingType?: "PAID" | "FREE" | "CUSTOM";
  productId?: string;
  refId?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type CreatePackageInput = {
  input: PackageInput;
};

export type UpdatePackageInput = {
  input: Omit<PackageInput, "refId"> & {
    id: string;
  };
};

export type CreatePackageResponse = PackageResponse<
  "createOnePlan" | "createOneAddon"
>;
export type UpdatePackageResponse = PackageResponse<
  "updateOnePlan" | "updateOneAddon"
>;
