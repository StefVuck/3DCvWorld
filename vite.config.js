import { defineConfig } from 'vite';
import config from './world.config.js';

// Fills the page's title and link-preview tags from world.config.js
const escape = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function fromConfig() {
  const values = {
    NAME: config.person?.name ?? 'Your Name',
    TITLE: config.person?.title ?? '',
    DESCRIPTION: config.site?.description ?? '',
    SITE_URL: config.site?.url ?? '',
    LANG: config.site?.language ?? 'en-GB',
  };
  return {
    name: 'world-config-html',
    transformIndexHtml: html => html.replace(/%(NAME|TITLE|DESCRIPTION|SITE_URL|LANG)%/g, (_, k) => escape(values[k])),
  };
}

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  plugins: [fromConfig()],
});
