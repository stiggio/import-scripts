import type { CreateProductInput, SearchProductsResponse, ZuoraProduct, CreateProductResponse } from './types.js';
import { sendGraphQLRequest } from './graphql.js';

import { environmentId, isDryRun } from './arguments.js';

export function composeProductRefId(productName: string, zuoraProductId: string) {
  return `${productName.trim().replace(/\s+/g, '_').toLowerCase()}_${zuoraProductId}`;
}

export async function createProduct(variables: CreateProductInput) {
  const query = `mutation CreateOneProduct($input: CreateOneProductInput!) {
    createOneProduct(input: $input) {
      id
      refId
      displayName
      description
    }
  }`;

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<CreateProductResponse>(body);
  return response;
}

async function findProduct(refId: string) {
  const query = `query Products($filter: ProductFilter) {
  products(filter: $filter) {
    edges {
      node {
        displayName
        description
        id
        refId
      }
    }
  }
}`;
  const variables = {
    filter: {
      refId: {
        eq: refId,
      },
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<SearchProductsResponse>(body);
  return response;
}

function getCreateProductInput(zuoraProduct: ZuoraProduct) {
  const productRefId = composeProductRefId(zuoraProduct.name || 'unknown_product', zuoraProduct.id);
  const createProductInput = {
    input: {
      product: {
        additionalMetaData: {
          from_zuora_import: 'true',
        },
        description: zuoraProduct.description || '',
        displayName: zuoraProduct.name || '',
        environmentId,
        refId: productRefId,
      },
    },
  };
  return createProductInput;
}

export async function fetchOrCreateProduct(zuoraProduct: ZuoraProduct) {
  const createProductInput = getCreateProductInput(zuoraProduct);
  const searchProductResponse: SearchProductsResponse = await findProduct(createProductInput.input.product.refId);

  const productExists = !!(
    searchProductResponse.data &&
    searchProductResponse.data.products.edges.length &&
    searchProductResponse.data.products.edges[0].node.refId === createProductInput.input.product.refId
  );

  if (isDryRun) {
    if (productExists) {
      const existingProductId = searchProductResponse.data!.products.edges[0].node.id;
      console.log(
        `Dry run: product already exists in Stigg with ID: ${existingProductId}, would proceed to add plans.`,
      );
      return 'dry-run-existing-product-id';
    }
    console.log(`Dry run: would create PRODUCT with next input\n`, JSON.stringify(createProductInput, null, 2), '\n');
    return 'dry-run-product-id';
  }

  if (productExists) {
    const existingProductId = searchProductResponse.data!.products.edges[0].node.id;
    console.log(`Product already exists in Stigg with ID: ${existingProductId}, proceeding to add plans.`);
    return existingProductId;
  }

  const createResponse: CreateProductResponse = await createProduct(createProductInput);
  const productId = createResponse.data?.createOneProduct?.id;
  if (productId) {
    console.log(`Created product: ${createResponse.data?.createOneProduct?.displayName} with ID: ${productId}`);
    return productId;
  }

  throw new Error(`Failed to create or find product in Stigg. Errors: ${JSON.stringify(createResponse.errors)}`);
}
