import dotenv from "dotenv";
import yargs from "yargs";
import { queryPackageByRefId } from "./graphql/queries";
import {
  createPackageDraftMutation,
  publishPackageMutation,
  updatePackageMutation,
} from "./graphql/mutations";
import { Package, PackageType, UpdatePackageInput } from "./types/package";
import { GRANDFATHERED_KEY, GRANDFATHERED_VALUE } from "./constants";

dotenv.config();

const argv = yargs(process.argv.slice(2))
  .command("$0 <refId>", "Mark a plan or addon as grandfathered", (yargs) => {
    yargs.positional("refId", {
      type: "string",
      describe: "RefId of the plan or addon to fork",
    });
  })
  .option("environmentId", {
    type: "string",
    describe: "Stigg Environment ID",
    demandOption: false,
  })
  .parseSync();

const X_API_KEY = process.env.X_API_KEY || "";
const environmentId = argv.environmentId || process.env.ENVIRONMENT_ID || "";

if (!X_API_KEY) {
  throw new Error("X_API_KEY is not defined, please set it in .env file");
}
if (!environmentId) {
  throw new Error(
    "ENVIRONMENT_ID is not defined, please set it in .env file or pass as argument --environmentId"
  );
}

async function findPackage(refId: string): Promise<Package> {
  const plan = await queryPackageByRefId("Plan", refId, false, environmentId);
  if (plan) return plan;

  const addon = await queryPackageByRefId("Addon", refId, false, environmentId);
  if (addon) return addon;

  throw new Error(`No plan or addon found with refId: ${refId}`);
}

async function getUpdatableId(aPackage: Package): Promise<string> {
  if (aPackage.status === "DRAFT") {
    return aPackage.id;
  }

  if (aPackage.draftSummary) {
    return aPackage.id;
  }

  const draftResponse = await createPackageDraftMutation(
    aPackage.type,
    aPackage.id
  );
  if (!draftResponse?.id) {
    throw new Error(
      `Failed to create draft for ${aPackage.type} with refId: ${aPackage.refId}`
    );
  }
  return draftResponse.id;
}

async function fork(refId: string) {
  console.log(`Looking up package with refId: ${refId}...`);

  const aPackage = await findPackage(refId);
  const type: PackageType = aPackage.type;

  console.log(
    `Found ${type} "${aPackage.displayName}" (refId: ${aPackage.refId}, status: ${aPackage.status})`
  );

  const alreadyGrandfathered = aPackage.additionalMetaData
    ? Object.entries(aPackage.additionalMetaData).some(
        ([key, value]) =>
          key.toLowerCase() === GRANDFATHERED_KEY.toLowerCase() &&
          value.toLowerCase() === GRANDFATHERED_VALUE.toLowerCase()
      )
    : false;
  if (alreadyGrandfathered) {
    console.log(`${type} is already marked as grandfathered. Nothing to do.`);
    return;
  }

  const wasPublished = aPackage.status === "PUBLISHED";
  const updatableId = await getUpdatableId(aPackage);

  const updatedMetaData = {
    ...(aPackage.additionalMetaData || {}),
    [GRANDFATHERED_KEY]: GRANDFATHERED_VALUE,
  };

  const updateInput: UpdatePackageInput = {
    input: {
      id: updatableId,
      displayName: aPackage.displayName,
      description: aPackage.description || "",
      additionalMetaData: updatedMetaData,
    },
  };

  console.log(`Updating ${type} metadata with grandfathered: true...`);
  await updatePackageMutation(type, updateInput);

  if (wasPublished) {
    console.log(`Re-publishing ${type}...`);
    await publishPackageMutation(type, updatableId, aPackage.refId);
  }

  console.log(
    `Successfully forked ${type} "${aPackage.displayName}" (refId: ${aPackage.refId}). It is now marked as grandfathered.`
  );
  console.log(
    `Next time the import script runs, a new version will be created with entitlements copied from this one.`
  );
}

(async () => {
  try {
    await fork(argv.refId as string);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
