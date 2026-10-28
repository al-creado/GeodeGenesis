import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextGeodeUid = 0;

/** A geode drawn in code: closed, shaking, or split open with a glowing core. */
@Component({
  selector: 'app-geode-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 200 160" role="img" [attr.aria-label]="state() === 'open' ? 'Opened geode' : 'Geode'" [class]="'geode ' + state()">
      <defs>
        <clipPath [attr.id]="uid + 'l'"><polygon points="0,0 100,0 110,38 90,70 108,108 96,160 0,160" /></clipPath>
        <clipPath [attr.id]="uid + 'r'"><polygon points="200,0 100,0 110,38 90,70 108,108 96,160 200,160" /></clipPath>
        <radialGradient [attr.id]="uid + 'g'">
          <stop offset="0" [attr.stop-color]="glow()" />
          <stop offset="1" [attr.stop-color]="glow()" stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse class="aura" cx="100" cy="86" rx="95" ry="75" [attr.fill]="'url(#' + uid + 'g)'" />
      <!-- crystal core, visible once the halves part -->
      <g class="core" stroke="#24160F" stroke-width="2.5" stroke-linejoin="round">
        <path d="M70 118 L82 62 L96 118 Z" [attr.fill]="glow()" />
        <path d="M92 124 L108 40 L124 124 Z" fill="#fff" fill-opacity="0.9" />
        <path d="M118 118 L132 70 L144 118 Z" [attr.fill]="glow()" />
      </g>
      <g class="half left" [attr.clip-path]="'url(#' + uid + 'l)'">
        <path [attr.d]="rock" fill="#7c5c48" stroke="#24160F" stroke-width="3" stroke-linejoin="round" />
        <ellipse cx="60" cy="52" rx="22" ry="12" fill="#a07d63" opacity="0.8" />
        <circle cx="45" cy="108" r="5" fill="#5f4433" />
      </g>
      <g class="half right" [attr.clip-path]="'url(#' + uid + 'r)'">
        <path [attr.d]="rock" fill="#6f523f" stroke="#24160F" stroke-width="3" stroke-linejoin="round" />
        <circle cx="150" cy="96" r="6" fill="#5f4433" />
        <circle cx="132" cy="40" r="3.5" fill="#a07d63" />
      </g>
      <path class="crack" d="M100 14 L110 38 L90 70 L108 108 L96 150" fill="none" stroke="#F2B84B" stroke-width="3" stroke-linejoin="round" />
    </svg>
  `,
  styleUrl: './geode-art.scss',
})
export class GeodeArt {
  readonly state = input<'closed' | 'cracking' | 'open'>('closed');
  /** Core glow color (CSS color). */
  readonly glow = input('#B58CFF');

  protected readonly uid = `geo${nextGeodeUid++}`;
  protected readonly rock = 'M30 100 C20 50 60 15 100 15 C145 15 182 50 172 100 C165 135 130 150 100 150 C65 150 35 135 30 100 Z';
}
