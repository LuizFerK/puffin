import { defineConfig, presetAttributify, presetUno, transformerDirectives, transformerAttributifyJsx } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  transformers: [
    transformerDirectives(),
    transformerAttributifyJsx(), // Support for JSX attributify
  ],
  theme: {
    colors: {
      'bg-app': 'var(--bg)',
      'fg-app': 'var(--fg)',
      'text-app': 'var(--text)',
      'btn-hover': 'var(--btn-hover)',
    }
  }
})
