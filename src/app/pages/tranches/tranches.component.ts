import { Component, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AuthService } from '../../core/services/auth.service';
import { TrancheService } from '../../core/services/tranche.service';
import { WellService } from '../../core/services/well.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Tranche {
  id: string;
  reference: string;
  country: string;
  region?: string;
  status: string;
  totalAmount?: number;
  wellCount?: number;
  provider?: string;
  startedDate?: string;
  inauguratedDate?: string;
  deliveredDate?: string;
  createdBy?: { firstName: string; lastName: string };
}

interface FreeWell {
  id: string;
  code: string;
  plaque?: string;
  donorEmail?: string;
  paidAmount?: number;
  trancheId?: string;
}

interface AvailableWell {
  id: string;
  code: string;
  plaque?: string;
  provider?: string;
  paidAmount?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
  { id: 'PLANIFIEE',  label: 'Planifiée',  icon: 'clipboard-list',   color: '#f59e0b' },
  { id: 'EN_TRAVAUX', label: 'En travaux', icon: 'hammer',            color: '#3b82f6' },
  { id: 'INAUGUREE',  label: 'Inaugurée',  icon: 'flag',              color: '#10b981' },
  { id: 'LIVREE',     label: 'Livrée',     icon: 'circle-check-big',  color: '#6366f1' },
];

const COUNTRIES = ['Cambodge', 'Pakistan', 'Bénin', 'Niger', 'Tchad'];

const DEFAULT_PROVIDERS = ['Iraiser', 'YEF', 'LaunchGood', 'HelloAsso', 'Virement', 'Chèque'];
const PROVIDER_KEY = 'kara_providers';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-tranches',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, DragDropModule],
  templateUrl: './tranches.component.html',
  styleUrl: './tranches.component.css',
})
export class TranchesComponent implements OnInit {

  readonly statuses  = STATUSES;
  readonly countries = COUNTRIES;

  // ── Data ──────────────────────────────────────────────────────────────────
  tranches      = signal<Tranche[]>([]);
  loading       = signal(true);
  filterCountry = signal('');

  // ── Free wells panel ──────────────────────────────────────────────────────
  showFreePanel   = signal(false);
  freeWells       = signal<FreeWell[]>([]);
  freeLoading     = signal(false);
  freeCountry     = signal('Cambodge');
  freeSearch      = signal('');
  freeSelected    = signal<Set<string>>(new Set());

  // ── Assign modal ──────────────────────────────────────────────────────────
  showAssignModal = signal(false);
  assignTargetId  = signal('');
  assignLoading   = signal(false);

  // ── Create modal ──────────────────────────────────────────────────────────
  showCreateModal   = signal(false);
  createCountry     = signal('');
  createRegion      = signal('');
  createProvider    = signal('');
  createDate        = signal('');
  createNotes       = signal('');
  createLoading     = signal(false);
  availableWells    = signal<AvailableWell[]>([]);
  loadingWells      = signal(false);
  selectedWells     = signal<string[]>([]);
  searchWell        = signal('');
  providerInput     = signal('');
  providerSuggestions = signal<string[]>([]);
  showSuggestions   = signal(false);
  providers         = this.loadProviders();

  // ── Computed ──────────────────────────────────────────────────────────────
  columnData = computed(() => {
    const all = this.tranches();
    return STATUSES.reduce((acc, s) => {
      acc[s.id] = all.filter(t => t.status === s.id);
      return acc;
    }, {} as Record<string, Tranche[]>);
  });

  get dropListIds(): string[] { return STATUSES.map(s => 'col-' + s.id); }

  filteredFreeWells = computed(() => {
    const q = this.freeSearch().toLowerCase().trim();
    if (!q) return this.freeWells();
    return this.freeWells().filter(w =>
      (w.code ?? '').toLowerCase().includes(q) ||
      (w.plaque ?? '').toLowerCase().includes(q) ||
      (w.donorEmail ?? '').toLowerCase().includes(q)
    );
  });

  tranchesForFreeCountry = computed(() =>
    this.tranches().filter(t => t.country === this.freeCountry())
  );

  filteredAvailableWells = computed(() => {
    const q = this.searchWell().toLowerCase().trim();
    if (!q) return this.availableWells();
    return this.availableWells().filter(w =>
      w.code.toLowerCase().includes(q) ||
      (w.plaque ?? '').toLowerCase().includes(q)
    );
  });

  constructor(
    private router: Router,
    public auth: AuthService,
    private trancheService: TrancheService,
    private wellService: WellService,
  ) {}

  ngOnInit(): void { this.load(); }

  // ── Tranches ──────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.filterCountry()) params.country = this.filterCountry();
    this.trancheService.getAll(params).subscribe({
      next: res => {
        this.tranches.set(res.data?.data ?? res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  byStatus(id: string): Tranche[] { return this.columnData()[id] ?? []; }

  // ── CDK drag-drop ─────────────────────────────────────────────────────────

  onDrop(event: CdkDragDrop<Tranche[]>, targetStatus: string): void {
    if (event.previousContainer === event.container) {
      const list = [...event.container.data];
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      this.tranches.update(all => [
        ...all.filter(t => t.status !== targetStatus),
        ...list,
      ]);
    } else {
      const tranche = event.previousContainer.data[event.previousIndex];
      const role = (this.auth.user() as any)?.role?.code ?? 'SUPER_ADMIN';
      if (!this.canDrop(tranche.status, targetStatus, role)) return;
      this.tranches.update(all =>
        all.map(t => t.id === tranche.id ? { ...t, status: targetStatus } : t)
      );
      this.trancheService.updateStatus(tranche.id, targetStatus)
        .subscribe({ error: () => this.load() });
    }
  }

  canDrop(from: string, to: string, role: string): boolean {
    if (role === 'SUPER_ADMIN' || role === 'admin') return true;
    if (from === 'PLANIFIEE'  && to === 'EN_TRAVAUX') return true;
    if (from === 'EN_TRAVAUX' && to === 'INAUGUREE')  return true;
    if (from === 'INAUGUREE'  && to === 'LIVREE')     return true;
    return false;
  }

  // ── Free wells panel ──────────────────────────────────────────────────────

  toggleFreePanel(): void {
    this.showFreePanel.update(v => !v);
    if (this.showFreePanel()) this.loadFreeWells();
  }

  loadFreeWells(): void {
    this.freeLoading.set(true);
    this.freeSelected.set(new Set());
    this.wellService.getAll({ limit: 2000, country: this.freeCountry() }).subscribe({
      next: res => {
        const all: FreeWell[] = res.data?.wells ?? res.data ?? [];
        this.freeWells.set(all.filter(w => !w.trancheId));
        this.freeLoading.set(false);
      },
      error: () => this.freeLoading.set(false),
    });
  }

  onFreeCountryChange(country: string): void {
    this.freeCountry.set(country);
    this.freeSearch.set('');
    this.loadFreeWells();
  }

  toggleFreeWell(id: string): void {
    this.freeSelected.update(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  toggleAllFreeWells(): void {
    const visible = this.filteredFreeWells().map(w => w.id);
    const sel     = this.freeSelected();
    const allSel  = visible.length > 0 && visible.every(id => sel.has(id));
    this.freeSelected.update(s => {
      const n = new Set(s);
      if (allSel) visible.forEach(id => n.delete(id));
      else        visible.forEach(id => n.add(id));
      return n;
    });
  }

  allFreeSelected(): boolean {
    const v = this.filteredFreeWells();
    return v.length > 0 && v.every(w => this.freeSelected().has(w.id));
  }

  // ── Assign modal ──────────────────────────────────────────────────────────

  assignWells(): void {
    if (!this.assignTargetId()) return;
    this.assignLoading.set(true);
    const wellIds = [...this.freeSelected()];
    this.trancheService.addWells(this.assignTargetId(), wellIds).subscribe({
      next: () => {
        this.assignLoading.set(false);
        this.showAssignModal.set(false);
        this.assignTargetId.set('');
        this.freeSelected.set(new Set());
        this.loadFreeWells();
        this.load();
      },
      error: () => this.assignLoading.set(false),
    });
  }

  // ── Create modal ──────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.createCountry.set('');
    this.createRegion.set('');
    this.createProvider.set('');
    this.providerInput.set('');
    this.createDate.set('');
    this.createNotes.set('');
    this.selectedWells.set([]);
    this.searchWell.set('');
    this.availableWells.set([]);
    this.showCreateModal.set(true);
  }

  onCreateCountryChange(country: string): void {
    this.createCountry.set(country);
    this.selectedWells.set([]);
    this.searchWell.set('');
    if (!country) { this.availableWells.set([]); return; }
    this.loadingWells.set(true);
    this.trancheService.getAvailableWells(country).subscribe({
      next: res => {
        this.availableWells.set(res.data?.data ?? res.data ?? []);
        this.loadingWells.set(false);
      },
      error: () => this.loadingWells.set(false),
    });
  }

  onProviderInput(val: string): void {
    this.providerInput.set(val);
    this.createProvider.set(val);
    const q = val.toLowerCase().trim();
    this.providerSuggestions.set(
      q ? this.providers.filter(p => p.toLowerCase().includes(q)) : this.providers
    );
    this.showSuggestions.set(true);
  }

  selectProvider(val: string): void {
    this.providerInput.set(val);
    this.createProvider.set(val);
    this.showSuggestions.set(false);
  }

  toggleWell(id: string): void {
    this.selectedWells.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  toggleAllWells(): void {
    const visible = this.filteredAvailableWells().map(w => w.id);
    const allSel  = visible.length > 0 && visible.every(id => this.selectedWells().includes(id));
    this.selectedWells.set(allSel ? [] : visible);
  }

  allWellsSelected(): boolean {
    const v = this.filteredAvailableWells();
    return v.length > 0 && v.every(w => this.selectedWells().includes(w.id));
  }

  submitCreate(): void {
    if (!this.createCountry() || this.selectedWells().length === 0) return;
    this.createLoading.set(true);
    this.trancheService.create({
      country:     this.createCountry(),
      region:      this.createRegion(),
      provider:    this.createProvider(),
      plannedDate: this.createDate(),
      notes:       this.createNotes(),
      wellIds:     this.selectedWells(),
    }).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.showCreateModal.set(false);
        this.load();
      },
      error: () => this.createLoading.set(false),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  fmt(d?: string): string | null {
    if (!d) return null;
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtAmount(n?: number): string {
    if (n == null) return '—';
    return n.toLocaleString('fr-FR') + ' €';
  }

  navigate(path: string): void { this.router.navigate([path]); }

  @HostListener('document:click')
  closeSuggestions(): void { this.showSuggestions.set(false); }

  private loadProviders(): string[] {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(PROVIDER_KEY) ?? '[]');
      return [...new Set([...DEFAULT_PROVIDERS, ...saved])].sort();
    } catch { return [...DEFAULT_PROVIDERS].sort(); }
  }
}
