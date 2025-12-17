import { sendGraphQLRequest } from "./graphql";
import { SearchIntegrationsResponse } from "./types";

export async function findZuoraIntegration(environmentId: string) {
  const query = `query Integrations($filter: IntegrationFilter) {
  integrations(filter: $filter) {
    edges {
      node {
        environment {
          id
        }
        integrationId
        id
      }
    }
  }
}`;
  const variables = {
    filter: {
      environmentId: {
        eq: environmentId,
      },
      vendorIdentifier: {
        eq: "ZUORA",
      },
    },
  };

  const body = JSON.stringify({ query, variables });
  const response = await sendGraphQLRequest<SearchIntegrationsResponse>(body);
  return response;
}
