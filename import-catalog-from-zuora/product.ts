import type {
  CreateProductInput,
  SearchProductsResponse,
  UpdateProductInput,
  Product,
} from "./types/product.js";

import { environmentId, isDryRun } from "./arguments.js";
import {
  createProductMutation,
  updateProductMutation,
} from "./graphql/mutations";
import { ZuoraProduct } from "./types/integration.js";
import { queryProduct } from "./graphql/queries.js";

export function composeProductRefId(
  productName: string,
  zuoraProductId: string
) {
  return `${productName
    .replace(/ - /g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase()}_${zuoraProductId.slice(-6)}`;
}

export function getCreateProductInput(zuoraProduct: ZuoraProduct) {
  const productRefId = composeProductRefId(
    zuoraProduct.name || "unknown_product",
    zuoraProduct.id
  );
  const createProductInput = {
    input: {
      product: {
        additionalMetaData: {
          from_zuora_import: "true",
        },
        description: zuoraProduct.description || "",
        displayName: zuoraProduct.name || "",
        environmentId,
        refId: productRefId,
      },
    },
  };
  return createProductInput;
}

export async function fetchOrCreateProduct(zuoraProduct: ZuoraProduct) {
  const createProductInput = getCreateProductInput(zuoraProduct);
  const searchProductResponse: SearchProductsResponse = await queryProduct(
    createProductInput.input.product.refId
  );

  const productExists = !!(
    searchProductResponse.data &&
    searchProductResponse.data.products.edges.length &&
    searchProductResponse.data.products.edges[0].node.refId ===
      createProductInput.input.product.refId
  );

  if (productExists) {
    const existingProductId =
      searchProductResponse.data!.products.edges[0].node.id;
    console.log(
      `${
        isDryRun ? "[Dry Run]: " : ""
      }Product already exists in Stigg with ID: ${existingProductId}`
    );
    await updateProductIfNeeded(searchProductResponse, createProductInput);
    return existingProductId;
  }

  const createdProduct: Product = await createProductMutation(
    createProductInput
  );
  return createdProduct.id;
}

export async function updateProductIfNeeded(
  searchProductResponse: SearchProductsResponse,
  productInput: CreateProductInput
) {
  const existingProduct = searchProductResponse.data!.products.edges[0].node;

  const needsUpdate =
    existingProduct.displayName !== productInput.input.product.displayName ||
    existingProduct.description !== productInput.input.product.description;

  if (!needsUpdate) {
    console.log(
      `No updates needed for product with Ref Id: ${existingProduct.refId}`
    );
    return;
  }

  if (isDryRun) {
    console.log(
      `Dry run: would update PRODUCT with next input\n`,
      JSON.stringify(productInput, null, 2),
      "\n"
    );
    return;
  }

  const updateProductInput: UpdateProductInput = {
    input: {
      id: existingProduct.id,
      update: {
        description: productInput.input.product.description,
        displayName: productInput.input.product.displayName,
        additionalMetaData: productInput.input.product.additionalMetaData,
      },
    },
  };

  const updateResponse = await updateProductMutation(updateProductInput);

  if (updateResponse.errors) {
    throw new Error(
      `Failed to update product with ID: ${
        existingProduct.id
      }. Errors: ${JSON.stringify(updateResponse.errors)}`
    );
  }

  console.log(
    `Updated product: ${updateResponse.data?.updateOneProduct?.displayName} with ID: ${existingProduct.id}`
  );
}
