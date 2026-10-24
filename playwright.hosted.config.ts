import {defineConfig,devices} from '@playwright/test';
const baseURL=process.env.ROMDEX_HOSTED_ORIGIN;
if(!baseURL||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(baseURL))throw Error('Set ROMDEX_HOSTED_ORIGIN to the reviewed Vercel app origin.');
export default defineConfig({testDir:'./tests',testMatch:['hosted/**/*.spec.ts','e2e/attachments.spec.ts','e2e/pwa-install.spec.ts'],fullyParallel:false,workers:1,outputDir:'artifacts/task-first-migration/hosted-results',use:{baseURL,trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',use:{...devices['Desktop Firefox']}}]});
