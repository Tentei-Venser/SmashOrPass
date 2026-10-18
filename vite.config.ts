import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages project sites the app lives at /<repo-name>/.
// Change REPO_NAME to match your repository (or set VITE_BASE at build time).
const REPO_NAME = 'SmashOrPass'

/** Exposes the file names in public/characters as `virtual:character-images`, so the roster can skip entries with no image. */
function characterImages(): Plugin {
  const id = 'virtual:character-images'
  const resolvedId = '\0' + id
  const dir = fileURLToPath(new URL('./public/characters', import.meta.url))
  return {
    name: 'character-images',
    resolveId: (source) => (source === id ? resolvedId : undefined),
    load(loadId) {
      if (loadId !== resolvedId) return
      const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
      return `export default ${JSON.stringify(files)}`
    },
    configureServer(server) {
      // Adding or removing an image while `npm run dev` is running refreshes the list.
      const refresh = (file: string) => {
        if (path.resolve(path.dirname(file)) !== path.resolve(dir)) return
        const mod = server.moduleGraph.getModuleById(resolvedId)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.add(dir)
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}

export default defineConfig({
  plugins: [react(), characterImages()],
  base: process.env.VITE_BASE ?? `/${REPO_NAME}/`,
})
