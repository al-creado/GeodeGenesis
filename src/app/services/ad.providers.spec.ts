import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdService, SimulatedAdService } from './ad.service';
import { provideAds } from './ad.providers';

describe('provideAds', () => {
  it('uses the simulated ad dialog outside a native app', () => {
    TestBed.configureTestingModule({ providers: [provideAds()] });
    expect(TestBed.inject(AdService)).toBeInstanceOf(SimulatedAdService);
  });
});
