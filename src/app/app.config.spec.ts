import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { appConfig } from './app.config';
import { CloudSyncService } from './services/cloud-sync.service';

describe('appConfig startup initializer', () => {
  it('runs to completion with the real providers (local-only mode)', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: appConfig.providers });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    expect(TestBed.inject(CloudSyncService).status()).toBe('off');
  });
});
