import { inject, Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import { AdMobAdService, AdMobPlugin } from './admob-ad.service';
import { AdService, NoAdsService } from './ad.service';
import { CONFIG } from './tokens';

/** Picks the ad provider: Google AdMob (test ads) in the Android app, and no ads anywhere else. */
export function provideAds(): Provider {
  return {
    provide: AdService,
    useFactory: (): AdService => {
      const config = inject(CONFIG);
      if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AdMob')) return new NoAdsService();
      const service = new AdMobAdService(config, AdMob as unknown as AdMobPlugin);
      service.start();
      return service;
    },
  };
}
