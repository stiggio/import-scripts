import { isDryRun } from "../../arguments";
import {
  CreateProductInput,
  CreateProductResponse,
  Product,
  productFields,
  UpdateProductInput,
  UpdateProductResponse,
} from "../../types/product";
import { sendGraphQLRequest } from "../request";

export async function createProductMutation(
  variables: CreateProductInput
): Promise<Product> {
  if (isDryRun) {
    console.log(
      `Dry run: would create PRODUCT with next input\n`,
      JSON.stringify(variables, null, 2),
      "\n"
    );
    return {
      id: "dry-run-new-product-id",
      displayName: variables.input.product.displayName,
      description: variables.input.product.description,
      environmentId: variables.input.product.environmentId,
      refId: variables.input.product.refId,
    };
  }
  const query = `mutation CreateOneProduct($input: CreateOneProductInput!) {
    createOneProduct(input: $input) {
      ${productFields}
    }
  }`;

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<CreateProductResponse>(body);
  if (response.errors || !response.data?.createOneProduct?.id) {
    throw new Error(
      `Failed to create product: ${JSON.stringify(response.errors)}`
    );
  }
  console.log(
    `Created product: ${response.data.createOneProduct.displayName} with ID: ${response.data.createOneProduct.id}`
  );
  return response.data.createOneProduct;
}

export function updateProductMutation(productInput: UpdateProductInput) {
  const query = `mutation UpdateOneProduct($input: UpdateOneProductInput!) {
    updateOneProduct(input: $input) {
        ${productFields}
    }
  }`;

  const body = JSON.stringify({ query, variables: productInput });
  return sendGraphQLRequest<UpdateProductResponse>(body);
}
