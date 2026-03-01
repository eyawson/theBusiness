import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        webdesign: resolve(__dirname, 'web-design.html'),
        servicenow: resolve(__dirname, 'servicenow.html'),
        cybersecurity: resolve(__dirname, 'cybersecurity.html')
      }
    }
  }
});
