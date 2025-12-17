import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: '../.env' });

const argv = yargs(hideBin(process.argv))
  .option('environmentId', {
    type: 'string',
    describe: 'Stigg Environment ID',
    demandOption: false,
  })
  .option('zuoraProductId', {
    type: 'string',
    describe: 'Zuora Product ID',
    demandOption: false,
  })
  .option('dryRun', {
    type: 'boolean',
    describe: 'Dry Run Mode',
    demandOption: false,
  })
  .parseSync();

const BASE_URL: string = process.env.BASE_URL || 'https://api.stigg.io/graphql';
const X_API_KEY = process.env.X_API_KEY || '';
const environmentId = argv.environmentId || process.env.ENVIRONMENT_ID || '';
const zuoraProductId = argv.zuoraProductId || process.env.ZUORA_PRODUCT_ID || '';
const isDryRun = argv.dryRun !== undefined ? argv.dryRun : process.env.DRY_RUN === 'true';

if (!X_API_KEY) {
  throw new Error('X_API_KEY is not defined, please set it in .env file');
}
if (!environmentId) {
  throw new Error('ENVIRONMENT_ID is not defined, please set it in .env file or pass as argument --environmentId');
}
if (!zuoraProductId) {
  throw new Error(
    'ZUORA_PRODUCT_ID ID is not defined, please set it in .env file or pass as argument --zuoraProductId',
  );
}

export { BASE_URL, X_API_KEY, environmentId, zuoraProductId, isDryRun };
