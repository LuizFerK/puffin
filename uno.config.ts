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
      'text-app': 'var(--text)',
      'btn-bg': 'var(--btn-bg)',
      'btn-hover': 'var(--btn-hover)',
    }
  }
})
