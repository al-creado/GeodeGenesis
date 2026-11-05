import { describe, expect, it } from 'vitest';
import { decideBack } from './navigation';

describe('decideBack', () => {
  it('closes an open overlay first, wherever you are', () => {
    expect(decideBack('/camp', true)).toEqual({ type: 'closeOverlay' });
    expect(decideBack('/mine/result', true)).toEqual({ type: 'closeOverlay' });
  });
  it('goes from the result screen back to Mine, not to the previous result', () => {
    expect(decideBack('/mine/result', false)).toEqual({ type: 'navigate', to: '/mine' });
  });
  it('goes from other tabs to Camp', () => {
    for (const url of ['/mine', '/vault', '/crew']) expect(decideBack(url, false)).toEqual({ type: 'navigate', to: '/camp' });
  });
  it('uses history for Settings so it returns to where you came from', () => {
    expect(decideBack('/settings', false)).toEqual({ type: 'history' });
  });
  it('exits from Camp, including trailing slashes and query strings', () => {
    expect(decideBack('/camp', false)).toEqual({ type: 'exit' });
    expect(decideBack('/', false)).toEqual({ type: 'exit' });
    expect(decideBack('/camp/?x=1#y', false)).toEqual({ type: 'exit' });
  });
  it('ignores query strings on other routes', () => {
    expect(decideBack('/vault?filter=ruby', false)).toEqual({ type: 'navigate', to: '/camp' });
  });
});
