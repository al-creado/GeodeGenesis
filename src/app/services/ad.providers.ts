import { inject, Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import { AdMobAdService, AdMobPlugin } from './admob-ad.service';
import { AdService, NoAdsService, SimulatedAdService } from './ad.service';
import { CONFIG } from './tokens';

/** Picks the ad provider: AdMob on Android, a fake ad dialog in the browser, none if the plugin is missing. */
export function provideAds(): Provider {
  return {
    provide: AdService,
    useFactory: (): AdService => {
      const config = inject(CONFIG);
      if (!Capacitor.isNativePlatform()) return new SimulatedAdService(config);
      if (!Capacitor.isPluginAvailable('AdMob')) return new NoAdsService();
      const service = new AdMobAdService(config, AdMob as unknown as AdMobPlugin);
      service.start();
      return service;
    },
  };
}
