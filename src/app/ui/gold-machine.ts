import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

let nextMachineUid = 0;

export type MachineState = 'idle' | 'pulling' | 'dropping' | 'open';

/** Capsules tumbling inside the globe: x, y, fill. */
const CAPSULES: readonly (readonly [number, number, string])[] = [
  [112, 140, '#FF6B8A'], [130, 144, '#6FA8FF'], [148, 140, '#FFD36B'],
  [104, 122, '#B58CFF'], [122, 124, '#3FC28F'], [140, 124, '#F4C2D7'], [158, 122, '#FF6B8A'],
  [114, 104, '#FFD36B'], [132, 104, '#6FA8FF'], [150, 104, '#B58CFF'],
  [124, 86, '#3FC28F'], [142, 86, '#F4C2D7'],
];

/** Stalactites inside the alcove: x, y, height. */
const TEETH: readonly (readonly [number, number, number])[] = [
  [50, 44, 18], [75, 22, 22], [100, 10, 16], [130, 6, 26], [160, 10, 14], [185, 22, 20], [210, 44, 16],
];

/** A gold lottery machine that has appeared in the cave. Drawn in code, no image assets. */
@Component({
  selector: 'app-gold-machine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gold-machine.html',
  styleUrl: './gold-machine.scss',
})
export class GoldMachine {
  readonly state = input<MachineState>('idle');
  /** Glow color of the capsule that pops open (CSS color). */
  readonly glow = input('#F2B84B');
  /** Coin cost shown on the machine's coin plate. */
  readonly cost = input.required<number>();
  /** Whether the lever can be pulled right now. */
  readonly leverEnabled = input(false);
  /** Emits when the player pulls the lever (click or keyboard). */
  readonly lever = output<void>();

  protected readonly uid = `gm${nextMachineUid++}`;
  protected readonly capsules = CAPSULES;
  protected readonly teeth = TEETH;
  protected readonly bulbs = [84, 102, 120, 138, 156, 174];

  protected pull(): void {
    if (this.leverEnabled()) this.lever.emit();
  }
}
