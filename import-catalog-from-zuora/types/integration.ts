import { QueryResponse } from "./abstract";

export type SearchIntegrationsResponse = QueryResponse<
  "integrations",
  {
    environment: {
      id: string;
    };
    integrationId: string;
    id: string;
  }
>;

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
