import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), {
    name: 'retail-root-entry',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path === '/' || path.startsWith('/producto/')) req.url = '/storefront.html'
        next()
      })
    },
    generateBundle(_options, bundle) {
      const html = bundle['storefront.html']
      if (!html) this.error('No se genero la entrada del storefront.')
      html.fileName = 'index.html'
      bundle['index.html'] = html
      delete bundle['storefront.html']
    }
  }],
  build: {
    outDir: 'dist-store',
    rollupOptions: {
      input: 'storefront.html'
    }
  }
})
