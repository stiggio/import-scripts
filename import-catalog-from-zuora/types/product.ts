import { EntityInput, EntityResponse } from "./abstract";
import { QueryResponse } from "./abstract";

export const productFields = `
  id
  additionalMetaData
  description
  displayName
  environmentId
  refId
`;

export type Product = {
  id: string;
  additionalMetaData?: Record<string, string>;
  description: string;
  displayName: string;
  environmentId: string;
  refId: string;
};

export type CreateProductResponse = {
  data?: {
    createOneProduct?: Product;
  };
  errors?: unknown;
};

export type SearchProductsResponse = QueryResponse<"products", Product>;

export type CreateProductInput = EntityInput<
  "product",
  {
    additionalMetaData?: Record<string, string>;
    description: string;
    displayName: string;
    environmentId: string;
    refId: string;
  }
>;

export type UpdateProductInput = {
  input: {
    id: string;
    update: {
      displayName: string;
      description: string;
      additionalMetaData?: Record<string, string>;
    };
  };
};

export type UpdateProductResponse = EntityResponse<"updateOneProduct", Product>;
