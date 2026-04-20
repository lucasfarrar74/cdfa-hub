import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Shared timestamp baked into both the client bundle (__BUILD_TIMESTAMP__)
// and the static /version.json endpoint, so the running app can detect when
// a newer build has been deployed and prompt the user to refresh.
const buildTimestamp = new Date().toISOString();

function emitVersionJson(): Plugin {
  return {
    name: 'cdfa-emit-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildTimestamp }),
      });
    },
  };
}

function serveVersionJsonInDev(): Plugin {
  return {
    name: 'cdfa-serve-version-json-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.end(JSON.stringify({ buildTimestamp }));
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emitVersionJson(), serveVersionJsonInDev()],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
})
