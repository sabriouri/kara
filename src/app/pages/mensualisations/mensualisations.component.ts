import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { InstalmentService } from '../../core/services/instalment.service';
import { VirementService } from '../../core/services/virement.service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Well { code?: string; }

interface Engagement {
  status: string;
  campaignCode?: string;
  campaignName?: string;
}

interface WellFinancing {
  id?: string;
  donorName?: string;
  donorEmail?: string;
  totalPaid?: number;
  totalTarget?: number;
  instalmentAmount?: number;
  instalmentCount?: number;
  well?: Well;
  ohmeContactId?: string;
  engagements?: Engagement[];
}

export interface Instalment {
  id: string;
  status?: string;
  source?: string;
  instalmentAmount?: number;
  instalmentCount?: number;
  paidCount?: number;
  totalPaid?: number;
  totalTarget?: number;
  wellFinancingId?: string;
  donorName?: string;
  donorEmail?: string;
  well?: Well;
  ohmeContactId?: string;
  wellFinancing?: WellFinancing;
}

interface Stats {
  total: number;
  enCours: number;
  complets?: number;
  totalCollecte?: number;
  totalVise?: number;
  progressPercent?: number;
  gocardless?: number;
  iraiser?: number;
}

interface PaymentSource {
  id: string;
  code?: string;
  name: string;
}

interface SyncLog {
  id: string;
  source: string;
  createdAt: string;
  created?: number;
  updated?: number;
  errors?: number;
  status?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mensualisations',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './mensualisations.component.html',
  styleUrl: './mensualisations.component.css',
})
export class MensualisationsComponent implements OnInit {

  // ── List state ──
  instalments       = signal<Instalment[]>([]);
  stats             = signal<Stats | null>(null);
  loading           = signal(true);
  statsLoading      = signal(true);
  syncingIraiser    = signal(false);
  syncingGocardless = signal(false);
  syncMessage       = signal('');
  currentPage       = signal(1);
  totalPages        = signal(0);
  filterSearch      = signal('');
  filterStatus      = signal('');
  filterSource      = signal('');

  // Pagination is hidden when a filter is active (all results already in memory)
  readonly hasActiveFilter = computed(() =>
    !!this.filterSearch().trim() || !!this.filterStatus() || !!this.filterSource()
  );

  // Client-side fallback filter (in case backend doesn't filter)
  readonly filteredInstalments = computed(() => {
    const items  = this.instalments();
    const search = this.filterSearch().toLowerCase().trim();
    const status = this.filterStatus().toUpperCase();
    const source = this.filterSource().toUpperCase();

    return items.filter(inst => {
      // Search
      if (search) {
        const donorName  = this.getDonorName(inst).toLowerCase();
        const wellCode   = this.getWellCode(inst).toLowerCase();
        const email      = (inst.donorEmail ?? inst.wellFinancing?.donorEmail ?? '').toLowerCase();
        if (!donorName.includes(search) && !wellCode.includes(search) && !email.includes(search))
          return false;
      }
      // Status
      if (status) {
        const s = (inst.status ?? '').toString().toUpperCase();
        if (s !== status) return false;
      }
      // Source
      if (source) {
        const src = this.getSourceInfo(inst.source).label.toUpperCase();
        const raw = (inst.source ?? '').toString().toUpperCase();
        if (!raw.includes(source) && !src.includes(source)) return false;
      }
      return true;
    });
  });

  // ── Solder modal ──
  showSolderModal   = signal(false);
  selectedInst      = signal<Instalment | null>(null);
  solderMontant     = signal('');
  solderNote        = signal('');
  solderDate        = signal(new Date().toISOString().split('T')[0]);
  solderSourceCode  = signal('');
  solderSourceName  = signal('');
  solderError       = signal('');
  solderLoading     = signal(false);
  paymentSources    = signal<PaymentSource[]>([]);

  // ── Sync History modal ──
  showSyncHistory   = signal(false);
  syncLogs          = signal<SyncLog[]>([]);
  syncLogsLoading   = signal(false);

  // ── Duplicate modal ──
  showDuplicates    = signal(false);
  duplicates        = signal<any[]>([]);
  dupLoading        = signal(false);

  // ── Options ──
  readonly statusOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: 'EN_COURS',  label: 'En cours'  },
    { value: 'COMPLETE',  label: 'Complété'  },
    { value: 'SUSPENDU',  label: 'Suspendu'  },
    { value: 'EN_RETARD', label: 'En retard' },
    { value: 'ECHEC',     label: 'Échec'     },
  ];
  readonly sourceOptions = [
    { value: '', label: 'Toutes les sources' },
    { value: 'IRAISER',    label: 'iRaiser'    },
    { value: 'GOCARDLESS', label: 'GoCardless' },
  ];

  readonly defaultSources: PaymentSource[] = [
    { id: '3283', code: '3283', name: 'Fond Général' },
    { id: '3288', code: '3288', name: 'EAU'          },
    { id: '4600', code: '4600', name: 'FOND URGENCE'  },
  ];

  constructor(
    private router: Router,
    private instalmentService: InstalmentService,
    private virementService: VirementService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.load();
    this.loadPaymentSources();
  }

  // ─── Data loading ────────────────────────────────────────────────────────

  loadStats(): void {
    this.statsLoading.set(true);
    this.instalmentService.getStats().subscribe({
      next: r => {
        // Handle { data: { ... } } OR { data: { data: { ... } } }
        const outer = r?.data ?? r;
        const stats = outer?.data ?? outer;
        this.stats.set(stats);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  load(): void {
    this.loading.set(true);
    const filterActive = !!this.filterSearch().trim() || !!this.filterStatus() || !!this.filterSource();
    // When a filter is active, fetch everything (server filters) — no pagination needed
    const p: any = filterActive
      ? { page: 1, limit: 9999 }
      : { page: this.currentPage(), limit: 100 };
    if (this.filterStatus()) p.status = this.filterStatus();
    if (this.filterSource()) p.source = this.filterSource();
    if (this.filterSearch()) p.search = this.filterSearch();
    this.instalmentService.getAll(p).subscribe({
      next: r => {
        // Handle nested wrapper: { data: { instalments: [] } } OR { data: { data: { instalments: [] } } }
        const outer = r?.data ?? r;
        const inner = outer?.data ?? outer;
        const items: Instalment[] = inner?.instalments
          ?? inner?.data
          ?? inner?.items
          ?? inner?.results
          ?? (Array.isArray(inner) ? inner : [])
          ?? [];
        const total = inner?.total ?? inner?.totalCount ?? inner?.count ?? items.length;
        const pages = inner?.totalPages ?? inner?.total_pages
          ?? (total > 0 ? Math.ceil(total / 100) : 1);
        // Debug: log first 5 items to understand structure
        console.log('[Mensualisations] Total items:', items.length);
        if (items.length > 0) {
          console.log('[Mensualisations] Sample item[0]:', JSON.stringify(items[0], null, 2));
          if (items.length > 4) {
            console.log('[Mensualisations] Sample item[4]:', JSON.stringify(items[4], null, 2));
          }
        }
        this.instalments.set(items);
        this.totalPages.set(pages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadPaymentSources(): void {
    this.virementService.getPaymentSources().subscribe({
      next: r => {
        const outer = r?.data ?? r;
        const sources = outer?.data ?? outer;
        if (Array.isArray(sources) && sources.length) this.paymentSources.set(sources);
        else if (Array.isArray(outer) && outer.length) this.paymentSources.set(outer);
      },
      error: () => {},
    });
  }

  applyFilters(): void { this.currentPage.set(1); this.load(); }
  goToPage(p: number): void { if (p < 1 || p > this.totalPages()) return; this.currentPage.set(p); this.load(); }
  pages(): number[] {
    const t = this.totalPages(), c = this.currentPage(), r: number[] = [];
    for (let i = Math.max(1, c - 2); i <= Math.min(t, c + 2); i++) r.push(i);
    return r;
  }

  // ─── Sync ────────────────────────────────────────────────────────────────

  syncIraiser(): void {
    this.syncingIraiser.set(true);
    this.instalmentService.syncIraiser().subscribe({
      next: r => {
        this.syncingIraiser.set(false);
        this.syncMessage.set(r.message ?? 'Sync iRaiser effectuée');
        setTimeout(() => this.syncMessage.set(''), 5000);
        this.load(); this.loadStats();
      },
      error: () => { this.syncingIraiser.set(false); this.syncMessage.set('Erreur lors de la synchronisation'); setTimeout(() => this.syncMessage.set(''), 4000); },
    });
  }

  syncGocardless(): void {
    this.syncingGocardless.set(true);
    this.instalmentService.syncGocardless().subscribe({
      next: r => {
        this.syncingGocardless.set(false);
        this.syncMessage.set(r.message ?? 'Sync GoCardless effectuée');
        setTimeout(() => this.syncMessage.set(''), 5000);
        this.load(); this.loadStats();
      },
      error: () => { this.syncingGocardless.set(false); this.syncMessage.set('Erreur lors de la synchronisation'); setTimeout(() => this.syncMessage.set(''), 4000); },
    });
  }

  // ─── Sync History ────────────────────────────────────────────────────────

  openSyncHistory(): void {
    this.showSyncHistory.set(true);
    this.syncLogsLoading.set(true);
    this.instalmentService.getSyncHistory().subscribe({
      next: r => { this.syncLogs.set(r.data ?? r ?? []); this.syncLogsLoading.set(false); },
      error: () => { this.syncLogs.set([]); this.syncLogsLoading.set(false); },
    });
  }

  // ─── Duplicates ──────────────────────────────────────────────────────────

  openDuplicates(): void {
    this.showDuplicates.set(true);
    this.dupLoading.set(true);
    this.instalmentService.getDuplicates().subscribe({
      next: r => { this.duplicates.set(r.data ?? r ?? []); this.dupLoading.set(false); },
      error: () => { this.duplicates.set([]); this.dupLoading.set(false); },
    });
  }

  mergeDuplicate(keepId: string, removeId: string): void {
    this.instalmentService.mergeDuplicates(keepId, removeId).subscribe({
      next: () => { this.openDuplicates(); this.load(); this.loadStats(); },
      error: () => {},
    });
  }

  // ─── Solder Modal ────────────────────────────────────────────────────────

  openSolderModal(inst: Instalment): void {
    const fin = inst.wellFinancing || inst as any;
    const totalPaid   = fin.totalPaid   ?? 0;
    const totalTarget = fin.totalTarget ?? inst.totalTarget ?? 370;
    const remaining   = Math.max(0, totalTarget - totalPaid);
    const activeEng   = fin.engagements?.find((e: Engagement) => e.status === 'EN_COURS') || fin.engagements?.[0];

    this.selectedInst.set(inst);
    this.solderMontant.set(remaining > 0 ? remaining.toFixed(2) : '');
    this.solderNote.set('');
    this.solderDate.set(new Date().toISOString().split('T')[0]);
    this.solderSourceCode.set(activeEng?.campaignCode ?? '');
    this.solderSourceName.set(activeEng?.campaignName ?? '');
    this.solderError.set('');
    this.showSolderModal.set(true);
  }

  closeSolderModal(): void {
    this.showSolderModal.set(false);
    this.selectedInst.set(null);
  }

  onSolderSourceChange(value: string): void {
    const sources = this.paymentSources().length ? this.paymentSources() : this.defaultSources;
    const src = sources.find(s => (s.code || s.id) === value);
    this.solderSourceCode.set(value);
    this.solderSourceName.set(src?.name ?? value);
  }

  confirmSolder(): void {
    const inst = this.selectedInst();
    if (!inst) return;
    const montant = parseFloat(this.solderMontant());
    if (!montant || montant <= 0) { this.solderError.set('Montant invalide'); return; }
    if (!this.solderSourceCode()) { this.solderError.set('Veuillez sélectionner une source de paiement'); return; }

    const fin = inst.wellFinancing || inst as any;
    const ohmeContactId = fin.ohmeContactId || inst.ohmeContactId;
    if (!ohmeContactId) { this.solderError.set('Contact Ohme introuvable pour cet engagement'); return; }

    this.solderLoading.set(true);
    this.solderError.set('');

    const dateParts = this.solderDate().split('-');
    const dateFr = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : this.solderDate();
    const wellCode = fin.well?.code || inst.well?.code || '';

    this.virementService.validate({
      date:          dateFr,
      montant:       montant,
      libelle:       this.solderNote() || `Solde manuel - ${wellCode}`,
      campagneCode:  this.solderSourceCode(),
      campagneName:  this.solderSourceName(),
      ohmeContactId: String(ohmeContactId),
      note:          this.solderNote(),
    }).subscribe({
      next: () => {
        this.solderLoading.set(false);
        this.closeSolderModal();
        this.load(); this.loadStats();
      },
      error: err => {
        this.solderLoading.set(false);
        this.solderError.set(err.error?.message || err.message || 'Erreur lors de la validation');
      },
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  openDetail(inst: Instalment): void {
    const fin = inst.wellFinancing as any;
    // React uses fin.wellId (foreign key on wellFinancing) then inst.wellFinancingId then inst.id
    const id = fin?.wellId || fin?.id || inst.wellFinancingId || inst.id;
    this.router.navigate(['/mensualisations', id]);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Extract display fields from raw instalment (React-compatible) */
  getWellCode(inst: any): string {
    if (!inst) return 'N/A';
    const code = inst.wellFinancing?.well?.code
      || inst.well?.code
      || inst.wellCode
      || inst.code;
    return (code && String(code).trim()) ? String(code).trim() : 'N/A';
  }
  getDonorName(inst: any): string {
    if (!inst) return '—';
    const name = inst.wellFinancing?.donorName
      || inst.donorName
      || inst.donor?.name
      || inst.name;
    return (name && String(name).trim()) ? String(name).trim() : '—';
  }
  getDonorEmail(inst: any): string {
    if (!inst) return '';
    const email = inst.wellFinancing?.donorEmail
      || inst.donorEmail
      || inst.donor?.email
      || inst.email;
    return (email && String(email).trim()) ? String(email).trim() : '';
  }
  getTotalPaid(inst: any): number {
    if (!inst) return 0;
    return +(inst.wellFinancing?.totalPaid ?? inst.totalPaid ?? inst.paid ?? 0) || 0;
  }
  getTotalTarget(inst: any): number {
    if (!inst) return 370;
    return +(inst.wellFinancing?.totalTarget ?? inst.totalTarget ?? inst.target ?? 370) || 370;
  }
  getInstalmentAmount(inst: any): number {
    if (!inst) return 37;
    return +(inst.instalmentAmount || inst.wellFinancing?.instalmentAmount || inst.amount || 37) || 37;
  }
  getRealPaidCount(inst: any): number {
    const amt = this.getInstalmentAmount(inst);
    const paid = this.getTotalPaid(inst);
    return amt > 0 ? Math.round(paid / amt) : +(inst?.paidCount ?? 0);
  }
  getInstalmentCount(inst: any): number {
    const target = this.getTotalTarget(inst);
    const amt    = this.getInstalmentAmount(inst);
    return +(inst?.instalmentCount || inst?.wellFinancing?.instalmentCount || Math.round(target / amt)) || 0;
  }
  getProgress(inst: any): number {
    const t = this.getTotalTarget(inst);
    return t > 0 ? Math.min(100, Math.round((this.getTotalPaid(inst) / t) * 100)) : 0;
  }
  getRemaining(inst: any): number {
    return Math.max(0, this.getTotalTarget(inst) - this.getTotalPaid(inst));
  }

  getSourceInfo(source: any): { label: string; color: string } {
    const s = source ? String(source).toUpperCase() : '';
    if (s === 'GOCARDLESS' || s.includes('GOCARDLESS') || s.includes('GC')) {
      return { label: 'GoCardless', color: '#00d4aa' };
    }
    if (s === 'IRAISER' || s.includes('IRAISER') || s.includes('IR')) {
      return { label: 'iRaiser', color: '#ff6b6b' };
    }
    // Fallback: use source value as label with neutral color
    return source ? { label: String(source), color: '#6366f1' } : { label: 'Inconnu', color: '#94a3b8' };
  }

  getStatusInfo(status: any): { label: string; color: string } {
    const s = status ? String(status).toUpperCase().replace(/\s/g, '_') : '';
    const map: Record<string, { label: string; color: string }> = {
      EN_COURS:   { label: 'En cours',  color: '#2196f3' },
      ENCOURS:    { label: 'En cours',  color: '#2196f3' },
      IN_PROGRESS:{ label: 'En cours',  color: '#2196f3' },
      ACTIVE:     { label: 'En cours',  color: '#2196f3' },
      COMPLETE:   { label: 'Complété',  color: '#4caf50' },
      COMPLETED:  { label: 'Complété',  color: '#4caf50' },
      TERMINE:    { label: 'Complété',  color: '#4caf50' },
      SUSPENDU:   { label: 'Suspendu',  color: '#ff9800' },
      SUSPENDED:  { label: 'Suspendu',  color: '#ff9800' },
      EN_RETARD:  { label: 'En retard', color: '#f44336' },
      RETARD:     { label: 'En retard', color: '#f44336' },
      LATE:       { label: 'En retard', color: '#f44336' },
      ECHEC:      { label: 'Échec',     color: '#9e9e9e' },
      FAILED:     { label: 'Échec',     color: '#9e9e9e' },
      ERROR:      { label: 'Échec',     color: '#9e9e9e' },
    };
    if (map[s]) return map[s];
    // Last resort: show the raw value
    return { label: status ? String(status) : '—', color: '#757575' };
  }

  getStatusIcon(status: any): string {
    const s = status ? String(status).toUpperCase().replace(/\s/g, '_') : '';
    const map: Record<string, string> = {
      EN_COURS:   'clock',
      ENCOURS:    'clock',
      IN_PROGRESS:'clock',
      ACTIVE:     'clock',
      COMPLETE:   'circle-check-big',
      COMPLETED:  'circle-check-big',
      TERMINE:    'circle-check-big',
      SUSPENDU:   'circle-pause',
      SUSPENDED:  'circle-pause',
      EN_RETARD:  'triangle-alert',
      RETARD:     'triangle-alert',
      LATE:       'triangle-alert',
      ECHEC:      'circle-x',
      FAILED:     'circle-x',
    };
    return map[s] ?? 'circle';
  }

  getSolderRemaining(): number {
    const inst = this.selectedInst();
    if (!inst) return 0;
    return this.getRemaining(inst);
  }

  effectiveSources(): PaymentSource[] {
    return this.paymentSources().length ? this.paymentSources() : this.defaultSources;
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);
  }
  fmtNum(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n ?? 0);
  }
  fmtDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
