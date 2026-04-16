import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PoleService {
  readonly currentPoleId = signal<string>('rd');

  set(id: string): void {
    this.currentPoleId.set(id);
  }
}
