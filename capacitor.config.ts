import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geodegenesis.app',
  appName: 'Geode Genesis',
  webDir: 'dist/geode-genesis/browser',
  backgroundColor: '#2A1C14',
  android: {
    backgroundColor: '#2A1C14',
  },
  plugins: {
    // Light status/navigation bar icons on our dark cave background; insets arrive as CSS variables.
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css',
    },
  },
};

export default config;
