import { Injectable, signal } from '@angular/core';

/** Short-lived confirmation messages ("+120 coins"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, ms = 2200): void {
    this.message.set(text);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), ms);
  }
}
