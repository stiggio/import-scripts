import {
  AddCompatibleAddonsToPlanResponse,
  Package,
} from "../../types/package";
import { sendGraphQLRequest } from "../request";

export function addAddonsToPlanMutation(plan: Package, addons: Package[]) {
  const query = `mutation AddCompatibleAddonsToPlan($input: AddCompatibleAddonsToPlanInput!) {
  addCompatibleAddonsToPlan(input: $input) {
    id
    __typename
  }
}`;
  const variables = {
    input: {
      id: plan.id,
      relationIds: addons.map((addon) => addon.id),
    },
  };

  const body = JSON.stringify({ query, variables });
  console.log(
    `Assigning ADDON IDs ${JSON.stringify(
      addons.map((addon) => addon.refId),
      null,
      2
    )} to PLAN ID ${plan.refId}...`
  );
  console.log();
  return sendGraphQLRequest<AddCompatibleAddonsToPlanResponse>(body);
}
