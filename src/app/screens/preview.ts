import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GAME_CONFIG, RARITIES, Rarity } from '../core/config';
import { gemsOfRarity, ROSTER } from '../core/roster';
import { GemArt } from '../ui/gem-art';
import { Stalactites } from '../ui/stalactites';

const TITLES: Record<Rarity, string> = {
  quartz: 'Quartz',
  amethyst: 'Amethyst',
  emerald: 'Emerald',
  ruby: 'Ruby',
  diamond: 'Diamond',
};

/** Dev-only gallery of every gem, grouped by rarity. */
@Component({
  selector: 'app-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, Stalactites],
  templateUrl: './preview.html',
  styleUrl: './preview.scss',
})
export class Preview {
  protected readonly total = ROSTER.length;
  protected readonly groups = RARITIES.map((r) => ({
    rarity: r,
    title: TITLES[r],
    odds: GAME_CONFIG.baseOdds[r],
    gems: gemsOfRarity(ROSTER, r),
  }));
}
