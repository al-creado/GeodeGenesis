import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAds } from './services/ad.providers';
import { CloudSyncService } from './services/cloud-sync.service';
import { RemoteConfigService } from './services/remote-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAds(),
    provideAppInitializer(async () => {
      // inject() only works before the first await.
      const remoteConfig = inject(RemoteConfigService);
      const cloudSync = inject(CloudSyncService);
      // Remote Config first (with a short timeout) so every service starts with the final numbers.
      await remoteConfig.load();
      // Cloud sync runs in the background: the game is playable immediately.
      void cloudSync.start();
    }),
  ],
};
