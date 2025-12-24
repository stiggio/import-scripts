import { environmentId } from "./arguments.js";
import { queryZuoraIntegration } from "./graphql/queries";

export async function getIntegrationId() {
  const integration = await queryZuoraIntegration(environmentId);
  const integrationId = integration.data.integrations.edges[0].node.id;

  if (integration.errors) {
    throw new Error(
      `Error fetching Zuora integration: ${JSON.stringify(integration.errors)}`
    );
  }
  if (!integrationId) {
    throw new Error("No Zuora integration found for the given environment ID");
  }
  return integrationId;
}
