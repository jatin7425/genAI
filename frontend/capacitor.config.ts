import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jatin7425.cortex',
  appName: 'Cortex',
  webDir: 'dist',
  server: {
    url: 'https://gen-ai-delta-three.vercel.app',
    androidScheme: 'https',
  },
}

export default config
