/// <reference types="vite/client" />

declare module 'virtual:character-images' {
  /** File names in public/characters at build time. */
  const files: string[]
  export default files
}
