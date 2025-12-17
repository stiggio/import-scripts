export type CreateProductResponse = {
  data?: {
    createOneProduct?: {
      id: string;
      refId: string;
      displayName: string;
      description: string;
    };
  };
  errors?: unknown;
};

export type SearchProductsResponse = {
  data?: {
    products: {
      edges: [
        {
          node: {
            id: string;
            refId: string;
            displayName: string;
            description: string;
          };
        }
      ];
    };
  };
  errors?: unknown;
};

export type SearchIntegrationsResponse = {
  data: {
    integrations: {
      edges: [
        {
          node: {
            environment: {
              id: string;
            };
            integrationId: string;
            id: string;
          };
        }
      ];
    };
  };
  errors?: unknown;
};

export type SearchPlansResponse = {
  data?: {
    plans: {
      edges: [
        {
          node: {
            id: string;
            refId: string;
            displayName: string;
            description: string;
          };
        }
      ];
    };
  };
  errors?: unknown;
};

export type BillingProductsResponse = {
  data?: {
    billingProducts?: {
      products?: ZuoraProduct[];
    };
  };
  errors?: unknown;
};

export type ZuoraProduct = {
  id: string;
  name: string;
  description?: string;
  plans?: ZuoraPlan[];
};

export type ZuoraPlan = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  prices: ZuoraPrice[];
};

export type ZuoraPrice = {
  id: string;
  amount: number;
  billingPeriod: "MONTHLY" | "ANNUALLY";
  usage: boolean;
  chargeModel: string;
  discountPercent: number;
};

export type CreatePlanResponse = {
  data?: {
    createOnePlan?: {
      id: string;
      refId: string;
      displayName: string;
      description: string;
    };
  };
  errors?: unknown;
};

export type BillingModel =
  | "FLAT_FEE"
  | "USAGE_BASED"
  | "PER_UNIT"
  | "MINIMUM_SPEND";

export type PriceInput = {
  input: {
    environmentId: string;
    packageId: string;
    priceGroupPackageBillingId: string;
    pricingModels: PriceModel[];
    pricingType: "CUSTOM" | "FREE" | "PAID";
  };
};

export type PriceModel = {
  billingId: string;
  billingCadence: "RECURRING" | "ONE_OFF";
  billingModel: BillingModel;
  pricePeriods: [
    {
      billingPeriod: "MONTHLY" | "ANNUALLY";
      price: {
        amount: number;
        currency: string;
      };
    }
  ];
};

export type PriceResponse = {
  data?: {
    setPackagePricing?: {
      packageId: string;
      pricingType: string;
    };
  };
  errors?: unknown;
};

export type CreatePlanInput = {
  input: {
    additionalMetaData: {
      ZUORA__SYNC_SKIP_UPDATE?: string;
    };
    billingId: string;
    description: string;
    displayName: string;
    environmentId: string;
    pricingType: "PAID" | "FREE" | "CUSTOM";
    productId: string;
    refId: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  };
};

export type CreateProductInput = {
  input: {
    product: {
      additionalMetaData?: Record<string, string>;
      description: string;
      displayName: string;
      environmentId: string;
      refId: string;
    };
  };
};
