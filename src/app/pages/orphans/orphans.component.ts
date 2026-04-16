import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrphanStatus = 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE' | 'TERMINE' | 'ARCHIVE';
export type PaymentStatus = 'OK' | 'LATE' | 'MISSING' | 'UNKNOWN';

export interface Sponsor {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface Orphan {
  id: string;
  code?: string;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  gender?: 'M' | 'F';
  country?: string;
  status: OrphanStatus;
  monthlyAmount?: number;
  notes?: string;
  sponsor?: Sponsor | null;
}

export interface OhmeSync {
  donorId?: string;
  paymentStatus: PaymentStatus;
  daysLate?: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  totalPaidOrphans?: number;
  ohmeEmail?: string;
}

export interface WaitlistEntry {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  nbSouhaite?: number;
  statut?: string;
  notes?: string;
  dateContact?: string;
}

export interface OrphanStats {
  total: number;
  actifs: number;
  enAttente: number;
  suspendus: number;
}

interface OrphanFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  icon?: string;
  ext?: string;
  children?: OrphanFile[];
}

interface OrphanFilesResult {
  found: boolean;
  files: OrphanFile[];
  organisation?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<OrphanStatus, string> = {
  ACTIF: 'Actif', SUSPENDU: 'Suspendu', EN_ATTENTE: 'En attente',
  TERMINE: 'Terminé', ARCHIVE: 'Archivé',
};

export const STATUS_COLORS: Record<OrphanStatus, string> = {
  ACTIF: '#10B981', SUSPENDU: '#EF4444', EN_ATTENTE: '#F59E0B',
  TERMINE: '#6B7280', ARCHIVE: '#475569',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  OK: 'À jour', LATE: 'Retard', MISSING: 'Manquant', UNKNOWN: 'Non vérifié',
};

export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  OK: '#10B981', LATE: '#F59E0B', MISSING: '#EF4444', UNKNOWN: '#6B7280',
};

const VALID_AMOUNTS = [35, 70, 105, 140, 175, 210, 420];

@Component({
  selector: 'app-orphans',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './orphans.component.html',
  styleUrl: './orphans.component.css',
})
export class OrphansComponent implements OnInit {
  private readonly API = '/api';

  // ── State ──
  tab            = signal<'orphelins' | 'attente'>('orphelins');
  orphans        = signal<Orphan[]>([]);
  waitlist       = signal<WaitlistEntry[]>([]);
  stats          = signal<OrphanStats | null>(null);
  loading        = signal(true);
  syncing        = signal(false);

  search         = signal('');
  filterStatus   = signal('');
  filterPayment  = signal('');

  ohmeStatus     = signal<Record<string, OhmeSync>>({});

  // ── Modals ──
  selectedOrphan     = signal<Orphan | null>(null);
  showNewOrphan      = signal(false);
  showNewWaitlist    = signal(false);
  suspendOrphan      = signal<Orphan | null>(null);
  assignOrphan       = signal<Orphan | null>(null);

  // ── Detail modal state ──
  detailEditing      = signal(false);
  detailSaving       = signal(false);
  detailFiles        = signal<OrphanFilesResult | null>(null);
  detailFilesLoading = signal(false);
  detailForm         = signal({ firstName: '', lastName: '', birthDate: '', country: 'Tchad', monthlyAmount: 35, notes: '' });

  // ── New orphan form ──
  newOrphanForm  = signal({ firstName: '', lastName: '', birthDate: '', gender: 'M', country: 'Tchad', monthlyAmount: 35 });
  newOrphanSaving = signal(false);

  // ── New waitlist form ──
  newWaitlistForm = signal({ fullName: '', email: '', phone: '', nbSouhaite: 1, statut: '', notes: '', dateContact: '' });
  newWaitlistSaving = signal(false);

  // ── Suspend modal ──
  suspendReason  = signal('');

  // ── Assign modal ──
  assignMode         = signal<'waitlist' | 'manual'>('waitlist');
  assignWaitlistId   = signal('');
  assignManualForm   = signal({ firstName: '', lastName: '', email: '', phone: '' });

  // ── Waitlist inline edit ──
  editingWaitlistId  = signal<string | null>(null);
  editingStatut      = signal('');

  // ── Computed ──
  filteredOrphans = computed(() => {
    let list = this.orphans();
    const q = this.search().toLowerCase();
    const s = this.filterStatus() as OrphanStatus;
    const p = this.filterPayment() as PaymentStatus;
    if (q) list = list.filter(o =>
      o.firstName.toLowerCase().includes(q) ||
      (o.lastName || '').toLowerCase().includes(q) ||
      (o.code || '').toLowerCase().includes(q)
    );
    if (s) list = list.filter(o => o.status === s);
    if (p) list = list.filter(o => {
      if (!o.sponsor) return p === 'UNKNOWN';
      const sync = this.ohmeStatus()[o.sponsor.id];
      if (!sync) return p === 'UNKNOWN';
      return sync.paymentStatus === p;
    });
    return list;
  });

  readonly statusOptions: OrphanStatus[] = ['ACTIF', 'SUSPENDU', 'EN_ATTENTE', 'TERMINE', 'ARCHIVE'];
  readonly paymentOptions: PaymentStatus[] = ['OK', 'LATE', 'MISSING', 'UNKNOWN'];

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.fetchAll(); }

  // ── Data loading ───────────────────────────────────────────────────────────

  fetchAll(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.search())       params['search'] = this.search();
    if (this.filterStatus()) params['status']  = this.filterStatus();

    Promise.all([
      this.http.get<any>(`${this.API}/orphans`, { params: { ...params, limit: 200 } }).toPromise(),
      this.http.get<any>(`${this.API}/orphans/waitlist/list`, { params: { isAssigned: 'false' } }).toPromise(),
      this.http.get<any>(`${this.API}/orphans/stats`).toPromise(),
    ]).then(([orphRes, waitRes, statsRes]) => {
      // Robustly unwrap one or two levels of { data: { data: ... } }
      const unwrap = (r: any) => { const o = r?.data ?? r; return o?.data ?? o; };

      const orphData  = unwrap(orphRes);
      const waitData  = unwrap(waitRes);
      const statsData = unwrap(statsRes);

      this.orphans.set(
        Array.isArray(orphData) ? orphData :
        (orphData?.orphans ?? orphData?.data ?? orphData?.items ?? orphData?.results ?? [])
      );
      this.waitlist.set(
        Array.isArray(waitData) ? waitData :
        (waitData?.waitlist ?? waitData?.data ?? waitData?.items ?? waitData?.results ?? [])
      );
      this.stats.set(statsData && typeof statsData === 'object' && !Array.isArray(statsData) ? statsData : null);
      this.loading.set(false);
      this.loadOhmeStatus();
    }).catch(() => this.loading.set(false));
  }

  loadOhmeStatus(): void {
    this.http.get<any>(`${this.API}/orphans/ohme/status`).subscribe({
      next: res => {
        const outer = res?.data ?? res;
        const list = outer?.data ?? outer ?? [];
        const map: Record<string, OhmeSync> = {};
        (Array.isArray(list) ? list : []).forEach((s: OhmeSync & { donorId: string }) => {
          if (s?.donorId) map[s.donorId] = s;
        });
        this.ohmeStatus.set(map);
      },
      error: () => {},
    });
  }

  syncOhme(): void {
    this.syncing.set(true);
    this.http.post<any>(`${this.API}/orphans/ohme/sync-all`, {}).subscribe({
      next: () => setTimeout(() => { this.fetchAll(); this.syncing.set(false); }, 3000),
      error: () => this.syncing.set(false),
    });
  }

  // ── Orphan actions ─────────────────────────────────────────────────────────

  openDetail(o: Orphan): void {
    this.selectedOrphan.set(o);
    this.detailEditing.set(false);
    this.detailForm.set({
      firstName: o.firstName,
      lastName: o.lastName ?? '',
      birthDate: o.birthDate ? o.birthDate.split('T')[0] : '',
      country: o.country ?? 'Tchad',
      monthlyAmount: o.monthlyAmount ?? 35,
      notes: o.notes ?? '',
    });
    this.detailFiles.set(null);
    this.loadDetailFiles(o.id);
  }

  loadDetailFiles(id: string): void {
    this.detailFilesLoading.set(true);
    this.http.get<any>(`${this.API}/orphans/${id}/files`).subscribe({
      next: res => { this.detailFiles.set(res?.data ?? { found: false, files: [] }); this.detailFilesLoading.set(false); },
      error: () => { this.detailFiles.set({ found: false, files: [] }); this.detailFilesLoading.set(false); },
    });
  }

  saveDetail(): void {
    const o = this.selectedOrphan();
    if (!o) return;
    this.detailSaving.set(true);
    this.http.put<any>(`${this.API}/orphans/${o.id}`, this.detailForm()).subscribe({
      next: () => { this.detailSaving.set(false); this.detailEditing.set(false); this.fetchAll(); },
      error: () => this.detailSaving.set(false),
    });
  }

  downloadFile(orphanId: string, filePath: string): void {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    const url = `/api/orphans/${orphanId}/files/download?filePath=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
  }

  confirmSuspend(): void {
    const o = this.suspendOrphan();
    if (!o) return;
    this.http.post<any>(`${this.API}/orphans/${o.id}/suspend`, { reason: this.suspendReason() }).subscribe({
      next: () => { this.suspendOrphan.set(null); this.suspendReason.set(''); this.fetchAll(); },
      error: () => {},
    });
  }

  reactivate(o: Orphan): void {
    if (!confirm('Réactiver cet orphelin ?')) return;
    this.http.post<any>(`${this.API}/orphans/${o.id}/reactivate`, {}).subscribe({
      next: () => this.fetchAll(),
      error: () => {},
    });
  }

  confirmAssign(): void {
    const o = this.assignOrphan();
    if (!o) return;
    const mode = this.assignMode();

    if (mode === 'waitlist') {
      const wId = this.assignWaitlistId();
      const entry = this.waitlist().find(w => w.id === wId);
      if (!entry) return;
      const parts = entry.fullName.split(' ');
      const sponsorData = { firstName: parts[0], lastName: parts.slice(1).join(' '), email: entry.email, phone: entry.phone };
      this.doAssign(o.id, sponsorData, entry.id);
    } else {
      const f = this.assignManualForm();
      if (!f.firstName) return;
      this.doAssign(o.id, f, null);
    }
  }

  private doAssign(orphanId: string, sponsorData: any, waitlistId: string | null): void {
    this.http.post<any>(`${this.API}/donors`, sponsorData).subscribe({
      next: res => {
        const outer = res?.data ?? res;
        const inner = outer?.data ?? outer;
        const sponsorId = inner?.id ?? outer?.id;
        this.http.post<any>(`${this.API}/orphans/${orphanId}/assign`, { sponsorId, waitlistId }).subscribe({
          next: () => { this.assignOrphan.set(null); this.fetchAll(); },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  // ── New orphan ─────────────────────────────────────────────────────────────

  createOrphan(): void {
    const f = this.newOrphanForm();
    if (!f.firstName) return;
    this.newOrphanSaving.set(true);
    this.http.post<any>(`${this.API}/orphans`, f).subscribe({
      next: () => { this.showNewOrphan.set(false); this.newOrphanSaving.set(false); this.fetchAll(); },
      error: () => this.newOrphanSaving.set(false),
    });
  }

  // ── New waitlist ───────────────────────────────────────────────────────────

  createWaitlist(): void {
    const f = this.newWaitlistForm();
    if (!f.fullName) return;
    this.newWaitlistSaving.set(true);
    this.http.post<any>(`${this.API}/orphans/waitlist`, f).subscribe({
      next: () => { this.showNewWaitlist.set(false); this.newWaitlistSaving.set(false); this.fetchAll(); },
      error: () => this.newWaitlistSaving.set(false),
    });
  }

  // ── Waitlist inline edit ───────────────────────────────────────────────────

  saveWaitlistStatut(id: string): void {
    this.http.put<any>(`${this.API}/orphans/waitlist/${id}`, { statut: this.editingStatut() }).subscribe({
      next: () => { this.editingWaitlistId.set(null); this.fetchAll(); },
      error: () => {},
    });
  }

  deleteWaitlist(id: string): void {
    if (!confirm('Supprimer ce candidat ?')) return;
    this.http.delete(`${this.API}/orphans/waitlist/${id}`).subscribe({
      next: () => this.fetchAll(),
      error: () => {},
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  calcAge(birthDate?: string): number | null {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  statusLabel(s: OrphanStatus): string { return STATUS_LABELS[s] ?? s; }
  statusColor(s: OrphanStatus): string { return STATUS_COLORS[s] ?? '#94A3B8'; }
  paymentLabel(s: PaymentStatus): string { return PAYMENT_LABELS[s] ?? s; }
  paymentColor(s: PaymentStatus): string { return PAYMENT_COLORS[s] ?? '#94A3B8'; }

  getOhme(o: Orphan): OhmeSync | null {
    if (!o.sponsor) return null;
    return this.ohmeStatus()[o.sponsor.id] ?? null;
  }

  sponsorName(o: Orphan): string {
    if (!o.sponsor) return '';
    return `${o.sponsor.firstName ?? ''} ${o.sponsor.lastName ?? ''}`.trim();
  }

  isAmountAlert(ohme: OhmeSync | null): boolean {
    if (!ohme?.lastPaymentAmount) return false;
    const amt = ohme.lastPaymentAmount;
    return !VALID_AMOUNTS.some(v => Math.abs(amt - v) <= v * 0.11) && amt < 420;
  }

  updateDetailForm(field: string, value: any): void {
    this.detailForm.update(f => ({ ...f, [field]: value }));
  }

  updateNewOrphanForm(field: string, value: any): void {
    this.newOrphanForm.update(f => ({ ...f, [field]: value }));
  }

  updateNewWaitlistForm(field: string, value: any): void {
    this.newWaitlistForm.update(f => ({ ...f, [field]: value }));
  }

  updateAssignManualForm(field: string, value: string): void {
    this.assignManualForm.update(f => ({ ...f, [field]: value }));
  }

  closeAllModals(): void {
    this.selectedOrphan.set(null);
    this.showNewOrphan.set(false);
    this.showNewWaitlist.set(false);
    this.suspendOrphan.set(null);
    this.assignOrphan.set(null);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Intl.DateTimeFormat('fr-FR').format(new Date(d));
  }
}
