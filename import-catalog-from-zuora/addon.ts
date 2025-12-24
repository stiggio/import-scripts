import { isDryRun } from "./arguments";
import { addAddonsToPlanMutation } from "./graphql/mutations";
import { Package } from "./types";

export function isAddon(name: string): boolean {
  const addonKeywords = ["addon", "add-on"];
  const lowerCaseName = name.toLowerCase();
  return addonKeywords.some((keyword) => lowerCaseName.includes(keyword));
}

export async function assignAddonsToPlans(plans: Package[], addons: Package[]) {
  if (isDryRun) {
    console.log(
      `Dry run: would assign the following ADDON IDs to PLANS:\n`,
      `PLAN IDs: ${JSON.stringify(
        plans.map((plan) => plan.id),
        null,
        2
      )}\n`,
      `ADDON IDs: ${JSON.stringify(
        addons.map((addon) => addon.id),
        null,
        2
      )}\n`
    );
    return;
  }

  return Promise.all(
    plans.map(async (plan) => {
      await addAddonsToPlanMutation(plan, addons);
    })
  );
}
