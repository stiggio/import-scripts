import type { CreatePlanInput, SearchPlansResponse, ZuoraPlan, CreatePlanResponse } from './types.js';
import { sendGraphQLRequest } from './graphql.js';

import { environmentId, zuoraProductId, isDryRun } from './arguments.js';
import { getDiscountPercentage } from './price.js';

function createPlan(variables: CreatePlanInput) {
  const query = `mutation CreateOnePlan($input: PlanCreateInput!) {
    createOnePlan(input: $input) {
      id
      refId
      displayName
      description 
    }
  }`;

  const body = JSON.stringify({ query, variables });
  return sendGraphQLRequest<CreatePlanResponse>(body);
}

function composePlanRefId(planName: string, zuoraPlanId: string) {
  return `${planName.trim().replace(/\s+/g, '_').toLowerCase()}_${zuoraPlanId}`;
}

async function findPlan(refId: string) {
  const query = `query Plans($filter: PlanFilter) {
  plans(filter: $filter) {
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
  const response = await sendGraphQLRequest<SearchPlansResponse>(body);
  return response;
}

function getCreatePlanInput(zuoraPlan: ZuoraPlan, productId: string): CreatePlanInput {
  const planRefId = composePlanRefId(zuoraPlan.name, zuoraPlan.id);
  const planDescription = zuoraPlan.description || '';

  const discountPercentage = getDiscountPercentage(zuoraPlan);

  const isPaid =
    zuoraPlan.prices.some((price) => {
      return (price.amount || 0) > 0;
    }) ?? false;

  const planInput: CreatePlanInput = {
    input: {
      additionalMetaData: {
        ZUORA__SYNC_SKIP_UPDATE: 'true',
        ...(discountPercentage > 0 ? { ZUORA__DISCOUNT_PERCENTAGE: `${discountPercentage}` } : {}),
      },
      billingId: zuoraProductId,
      description: planDescription,
      displayName: zuoraPlan.name,
      environmentId,
      pricingType: isPaid ? 'PAID' : 'FREE',
      productId: productId!,
      refId: planRefId,
      status: 'DRAFT',
    },
  };
  return planInput;
}

export async function fetchOrCreatePlan(zuoraPlan: ZuoraPlan, productId: string) {
  const planInput = getCreatePlanInput(zuoraPlan, productId!);
  const searchPlanResponse: SearchPlansResponse = await findPlan(planInput.input.refId);

  const planExists = !!(
    searchPlanResponse.data &&
    searchPlanResponse.data.plans.edges.length &&
    searchPlanResponse.data.plans.edges[0].node.refId === planInput.input.refId
  );

  if (isDryRun) {
    if (planExists) {
      const existingPlanId = searchPlanResponse.data!.plans.edges[0].node.id;
      console.log(`Dry run: plan already exists in Stigg with ID: ${existingPlanId}, would proceed to add prices.`);
      return 'dry-run-existing-plan-id';
    }
    console.log(`Dry run: would create PLAN with next input\n`, JSON.stringify(planInput, null, 2), '\n');
    return 'dry-run-plan-id';
  }

  if (planExists) {
    const existingPlanId = searchPlanResponse.data!.plans.edges[0].node.id;
    console.log(`Plan already exists in Stigg with ID: ${existingPlanId}, proceeding to add prices.`);
    return existingPlanId;
  }

  const planCreateResponse: CreatePlanResponse = await createPlan(planInput);

  const planId = planCreateResponse.data?.createOnePlan?.id;
  if (planId) {
    console.log(`Created plan: ${planCreateResponse.data?.createOnePlan?.displayName} with ID: ${planId}`);
    return planId;
  }

  throw new Error(`Failed to create or find plan in Stigg for Zuora Plan ID: ${zuoraPlan.id}`);
}
