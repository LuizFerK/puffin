import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  theme: {
    fontFamily: {
      sans: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace",
      mono: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace",
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      collections: {
        lucide: () => import('@iconify-json/lucide/icons.json').then(i => i.default),
      }
    }),
  ],
})
