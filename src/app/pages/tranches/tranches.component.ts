import { Component, signal, OnInit, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

interface Tag { label: string; color: string; }

interface Tranche {
  id: string;
  reference: string;
  name?: string;
  country: string;
  status: string;
  amount?: number;
  wellId?: string;
  wells?: any[];
  tags?: Tag[];
}

const TAG_PALETTE = ['#1AABE2','#52AE4F','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];

@Component({
  selector: 'app-tranches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule],
  templateUrl: './tranches.component.html',
  styleUrl: './tranches.component.css',
})
export class TranchesComponent implements OnInit {
  private readonly API = '/api';

  tranches = signal<Tranche[]>([]);
  loading  = signal(true);
  country  = signal('');

  tagInputs     = signal<Record<string, string>>({});
  tagPickerOpen = signal<Record<string, boolean>>({});
  selectedColors= signal<Record<string, string>>({});
  readonly tagPalette = TAG_PALETTE;

  readonly columns = [
    { key: 'PLANIFIEE',  label: 'Planifiée',  color: '#94A3B8', bg: '#F1F5F9' },
    { key: 'EN_TRAVAUX', label: 'En travaux', color: '#F59E0B', bg: '#FFFBEB' },
    { key: 'INAUGUREE',  label: 'Inaugurée',  color: '#1AABE2', bg: '#E8F6FD' },
    { key: 'LIVREE',     label: 'Livrée',     color: '#52AE4F', bg: '#EBF7EA' },
  ];

  readonly countries = ['', 'Sénégal', 'Mali', 'Niger', 'Mauritanie', 'Tchad', 'Guinée'];

  readonly columnData = computed(() => {
    const all = this.tranches();
    return this.columns.reduce((acc, col) => {
      acc[col.key] = all.filter(t => t.status === col.key);
      return acc;
    }, {} as Record<string, Tranche[]>);
  });

  get dropListIds(): string[] { return this.columns.map(c => 'drop-' + c.key); }

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.country()) params.country = this.country();

    this.http.get<{ data: Tranche[] }>(`${this.API}/tranches`, { params }).subscribe({
      next: res => {
        const saved = this.loadSavedTags();
        const data = (res.data ?? []).map(t => ({ ...t, tags: saved[t.id] ?? [] }));
        this.tranches.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDrop(event: CdkDragDrop<Tranche[]>, targetStatus: string): void {
    if (event.previousContainer === event.container) {
      const list = [...event.container.data];
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      this.tranches.update(all => [...all.filter(t => t.status !== targetStatus), ...list]);
    } else {
      const tranche = event.previousContainer.data[event.previousIndex];
      this.tranches.update(all => all.map(t => t.id === tranche.id ? { ...t, status: targetStatus } : t));
      this.http.put(`${this.API}/tranches/${tranche.id}/status`, { status: targetStatus })
        .subscribe({ error: () => this.load() });
    }
  }

  getTagInput(id: string): string { return this.tagInputs()[id] ?? ''; }
  setTagInput(id: string, val: string): void { this.tagInputs.update(m => ({ ...m, [id]: val })); }
  getSelectedColor(id: string): string { return this.selectedColors()[id] ?? TAG_PALETTE[0]; }
  setSelectedColor(id: string, c: string): void { this.selectedColors.update(m => ({ ...m, [id]: c })); }
  isPickerOpen(id: string): boolean { return this.tagPickerOpen()[id] ?? false; }
  togglePicker(id: string): void { const o = this.tagPickerOpen()[id]; this.tagPickerOpen.set({ [id]: !o }); }

  @HostListener('document:click') closeAllPickers(): void { this.tagPickerOpen.set({}); }

  addTag(tranche: Tranche): void {
    const label = this.getTagInput(tranche.id).trim();
    if (!label) return;
    const color = this.getSelectedColor(tranche.id);
    this.tranches.update(all => all.map(t => {
      if (t.id !== tranche.id) return t;
      const tags = [...(t.tags ?? [])];
      if (!tags.some(tg => tg.label === label)) tags.push({ label, color });
      return { ...t, tags };
    }));
    this.setTagInput(tranche.id, '');
    this.tagPickerOpen.set({});
    this.persistTags();
  }

  removeTag(tranche: Tranche, tagLabel: string): void {
    this.tranches.update(all => all.map(t =>
      t.id === tranche.id ? { ...t, tags: (t.tags ?? []).filter(tg => tg.label !== tagLabel) } : t
    ));
    this.persistTags();
  }

  private persistTags(): void {
    const map: Record<string, Tag[]> = {};
    this.tranches().forEach(t => { if (t.tags?.length) map[t.id] = t.tags!; });
    localStorage.setItem('kara_tranche_tags', JSON.stringify(map));
  }

  private loadSavedTags(): Record<string, Tag[]> {
    try { return JSON.parse(localStorage.getItem('kara_tranche_tags') ?? '{}'); }
    catch { return {}; }
  }

  byStatus(status: string): Tranche[] { return this.tranches().filter(t => t.status === status); }

  updateStatus(tranche: Tranche, newStatus: string): void {
    this.tranches.update(list => list.map(t => t.id === tranche.id ? { ...t, status: newStatus } : t));
    this.http.put(`${this.API}/tranches/${tranche.id}/status`, { status: newStatus })
      .subscribe({ error: () => this.load() });
  }

  nextStatus(current: string): string | null {
    const order = ['PLANIFIEE', 'EN_TRAVAUX', 'INAUGUREE', 'LIVREE'];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : null;
  }

  nextLabel(current: string): string {
    const map: Record<string, string> = { PLANIFIEE: 'Démarrer', EN_TRAVAUX: 'Inaugurer', INAUGUREE: 'Livrer' };
    return map[current] ?? '';
  }
}
