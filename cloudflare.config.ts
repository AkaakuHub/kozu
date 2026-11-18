import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'kozu',
    compatibilityDate: '2026-11-18',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: './src/worker/index.ts',
    workersDev: false,
    domains: ['kozu.akaaku.net'],
    previewUrls: false,
    assets: { notFoundHandling: 'single-page-application', runWorkerFirst: ['/api/*'] },
    env: {
      DB: bindings.d1({ id: '3d98cf76-3bfa-4d7e-8997-c846199a0d45', name: 'kozu' }),
      ACCESS_ISSUER: bindings.text('https://akaaku.cloudflareaccess.com'),
      ACCESS_AUD: bindings.text('6fd22401127e036631950ffcf9199c831c1c7c43b288e0f443b0e469132bd4d7'),
    },
  },
});
