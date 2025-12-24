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
