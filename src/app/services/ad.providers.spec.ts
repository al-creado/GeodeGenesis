import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdService, NoAdsService } from './ad.service';
import { provideAds } from './ad.providers';

describe('provideAds', () => {
  it('shows no ads outside the Android app (no custom fake-ad dialog)', () => {
    TestBed.configureTestingModule({ providers: [provideAds()] });
    const ads = TestBed.inject(AdService);
    expect(ads).toBeInstanceOf(NoAdsService);
    expect(ads.supported).toBe(false);
    expect(ads.available()).toBe(false);
  });
});
