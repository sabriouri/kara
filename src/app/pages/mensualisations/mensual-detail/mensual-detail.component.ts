import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { InstalmentService } from '../../../core/services/instalment.service';
import { VirementService } from '../../../core/services/virement.service';
import { WellService } from '../../../core/services/well.service';

// ─── Types ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETE:   { label: 'Complété',   color: '#22c55e', bg: '#dcfce7' },
  EN_COURS:   { label: 'En cours',   color: '#3b82f6', bg: '#dbeafe' },
  SUSPENDU:   { label: 'Suspendu',   color: '#f97316', bg: '#ffedd5' },
  A_VERIFIER: { label: 'À vérifier', color: '#eab308', bg: '#fef9c3' },
  ANOMALIE:   { label: 'Anomalie',   color: '#ef4444', bg: '#fee2e2' },
};

interface OhmePayment {
  id: string;
  date: string;
  amount: number;
  payment_status: string;
  payment_method_name?: string;
  payment_source_campaign_code?: string;
  payment_source_name?: string;
  recurring?: boolean;
  _split?: boolean;
}

interface Engagement {
  id: string;
  source: string;
  campaignCode?: string;
  campaignName?: string;
  ohmeEngagementId?: string;
  status: string;
  paidCount: number;
  totalPaid: number;
  totalTarget?: number;
  instalmentAmount?: number;
  firstPaymentDate?: string;
  nextPaymentDate?: string;
}

interface OneOffPayment {
  id: string;
  paymentDate?: string;
  amount: number;
  paymentMethod?: string;
  campaignCode?: string;
  campaignName?: string;
  hasAnomaly?: boolean;
}

interface Financing {
  id: string;
  status: string;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  zone?: string;
  totalTarget?: number;
  totalPaid?: number;
  ohmeTotalValidated?: number;
  ohmeContactId?: string;
  hasAnomaly?: boolean;
  anomalyReason?: string;
  well?: { code?: string };
  engagements?: Engagement[];
  oneOffPayments?: OneOffPayment[];
}

interface Comment {
  id: string;
  content: string;
  createdAt?: string;
  ohmePaymentId?: string;
  paymentAmount?: number;
  paymentDate?: string;
  author?: { firstName: string; lastName: string; email?: string };
}

interface PaymentSource { id: string; code?: string; name: string; }

interface WellBreakdown {
  idx: number;
  status: 'COMPLETE' | 'EN_COURS';
  payments: OhmePayment[];
  total: number;
  excess?: number;
  remaining?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mensual-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './mensual-detail.component.html',
  styleUrl: './mensual-detail.component.css',
})
export class MensualDetailComponent implements OnInit {
  wellId = '';

  financing     = signal<Financing | null>(null);
  allPayments   = signal<OhmePayment[]>([]);
  unattributed  = signal<OhmePayment[]>([]);
  loading       = signal(true);
  error         = signal('');

  comments      = signal<Comment[]>([]);
  newComment    = signal('');
  savingComment = signal(false);
  editingId     = signal<string | null>(null);
  editContent   = signal('');

  linkEnabled      = signal(false);
  linkOhmeId       = signal('');
  linkDate         = signal('');
  linkAmount       = signal('');

  paymentSources   = signal<PaymentSource[]>([]);
  selectedSources  = signal<Record<string, { code: string; name: string }>>({});
  confirming       = signal<string | null>(null);

  wellsBreakdown   = signal<WellBreakdown[]>([]);

  readonly defaultSources: PaymentSource[] = [
    { id: '82',      code: '82',      name: 'PUITS ASIE'   },
    { id: 'AFRIQUE', code: 'AFRIQUE', name: 'PUITS AFRIQUE' },
  ];

  readonly TARGET = 370;

  constructor(
    private instalmentService: InstalmentService,
    private virementService: VirementService,
    private wellService: WellService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.wellId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.loadPaymentSources();
  }

  // ─── Data ─────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.instalmentService.getFinancingById(this.wellId).subscribe({
      next: r => {
        const outer = r?.data ?? r;
        const fin: Financing = outer?.data ?? outer;
        this.financing.set(fin);
        this.loading.set(false);

        if (fin?.ohmeContactId) {
          this.loadDonorPayments(fin.ohmeContactId);
        }
        this.loadComments();
      },
      error: e => { this.error.set(e.message || 'Erreur chargement'); this.loading.set(false); },
    });
  }

  loadDonorPayments(contactId: string): void {
    this.instalmentService.getDonorPayments(contactId).subscribe({
      next: r => {
        const outer = r?.data ?? r;
        const payments: OhmePayment[] = (outer?.data ?? outer ?? []);
        const list = Array.isArray(payments) ? payments : [];
        this.allPayments.set(list);
        this.detectUnattributed(list);
        this.wellsBreakdown.set(this.buildWellsBreakdown(list));
      },
      error: () => {},
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

  loadComments(): void {
    this.wellService.getComments(this.wellId).subscribe({
      next: r => {
        const outer = r?.data ?? r;
        const comments = outer?.data ?? outer ?? [];
        this.comments.set(Array.isArray(comments) ? comments : []);
      },
      error: () => {},
    });
  }

  // ─── Wells Breakdown ──────────────────────────────────────────────────────

  buildWellsBreakdown(payments: OhmePayment[]): WellBreakdown[] {
    const TARGET = this.financing()?.totalTarget ?? this.TARGET;
    const CONFIRMED = ['confirmed', 'paid_out', 'cheque_cashed'];
    const sorted = [...payments]
      .filter(p => CONFIRMED.includes(p.payment_status))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const wells: WellBreakdown[] = [];
    let cumul = 0;
    let idx = 0;
    let current: OhmePayment[] = [];

    for (const p of sorted) {
      cumul += p.amount;
      current.push(p);
      if (cumul >= TARGET) {
        const excess = cumul - TARGET;
        wells.push({ idx: idx + 1, status: 'COMPLETE', payments: [...current], total: TARGET, excess });
        idx++;
        current = excess > 0 ? [{ ...p, amount: excess, _split: true }] : [];
        cumul = excess;
      }
    }

    if (current.length > 0 || cumul > 0) {
      wells.push({ idx: idx + 1, status: 'EN_COURS', payments: current, total: cumul, remaining: TARGET - cumul });
    }

    return wells;
  }

  // ─── Unattributed Payments Detection ──────────────────────────────────────

  detectUnattributed(payments: OhmePayment[]): void {
    const WELL_AMOUNTS = [37,74,111,123.33,148,185,222,259,296,333,370,19.40,38.80,58.20,77.60,97,116.40,155.20,194];
    const isWellLike = (amount: number) =>
      WELL_AMOUNTS.some(ref => {
        const ratio = amount / ref;
        return Math.abs(ratio - Math.round(ratio)) < 0.15 && ratio >= 0.9 && ratio <= 1.15;
      }) || amount % 37 < 5 || amount % 37 > 32
        || amount % 194 < 15 || amount % 194 > 179;

    const CONFIRMED = ['confirmed', 'paid_out', 'cheque_cashed'];
    const unattr = payments.filter(p => {
      const noSrc = !p.payment_source_campaign_code
        || p.payment_source_campaign_code === 'default'
        || p.payment_source_name === 'Défaut'
        || p.payment_source_name === 'Default';
      return noSrc && CONFIRMED.includes(p.payment_status) && p.amount > 0 && isWellLike(p.amount);
    });
    this.unattributed.set(unattr);

    // Pre-fill source with active engagement
    const fin = this.financing();
    const activeEng = fin?.engagements?.find(e => e.status === 'EN_COURS') || fin?.engagements?.[0];
    if (activeEng?.campaignCode) {
      const preselect: Record<string, { code: string; name: string }> = {};
      unattr.forEach(p => { preselect[p.id] = { code: activeEng.campaignCode!, name: activeEng.campaignName ?? activeEng.campaignCode! }; });
      this.selectedSources.set(preselect);
    }
  }

  // ─── Attribute Payment ────────────────────────────────────────────────────

  attributePayment(payment: OhmePayment): void {
    const sel = this.selectedSources()[payment.id];
    if (!sel?.code) return;
    this.confirming.set(payment.id);
    this.instalmentService.attributePayment(payment.id, {
      campaignCode: sel.code,
      campaignName: sel.name,
      ohmeContactId: this.financing()?.ohmeContactId,
      wellId: this.wellId,
    }).subscribe({
      next: () => { this.confirming.set(null); this.load(); },
      error: e => { this.confirming.set(null); console.error(e); },
    });
  }

  ignoreUnattributed(id: string): void {
    this.unattributed.update(list => list.filter(p => p.id !== id));
  }

  onSourceChange(paymentId: string, value: string): void {
    const sources = this.paymentSources().length ? this.paymentSources() : this.defaultSources;
    const src = sources.find(s => (s.code || s.id) === value);
    this.selectedSources.update(map => ({ ...map, [paymentId]: { code: value, name: src?.name ?? value } }));
  }

  effectiveSources(): PaymentSource[] {
    return this.paymentSources().length ? this.paymentSources() : this.defaultSources;
  }

  // ─── Comments ────────────────────────────────────────────────────────────

  addComment(): void {
    if (!this.newComment().trim()) return;
    this.savingComment.set(true);
    const payload: any = {
      content: this.newComment().trim(),
      isInternal: true,
    };
    if (this.linkEnabled() && this.linkOhmeId()) {
      payload.ohmePaymentId = this.linkOhmeId();
      if (this.linkDate())   payload.paymentDate   = this.linkDate();
      if (this.linkAmount()) payload.paymentAmount = parseFloat(this.linkAmount());
    }
    this.wellService.addComment(this.wellId, payload).subscribe({
      next: r => {
        this.comments.update(c => [r.data ?? r, ...c]);
        this.newComment.set('');
        this.linkEnabled.set(false);
        this.linkOhmeId.set(''); this.linkDate.set(''); this.linkAmount.set('');
        this.savingComment.set(false);
      },
      error: () => this.savingComment.set(false),
    });
  }

  startEdit(c: Comment): void { this.editingId.set(c.id); this.editContent.set(c.content); }

  saveEdit(id: string): void {
    if (!this.editContent().trim()) return;
    this.wellService.updateComment(this.wellId, id, { content: this.editContent().trim() }).subscribe({
      next: r => {
        this.comments.update(list => list.map(c => c.id === id ? (r.data ?? r) : c));
        this.editingId.set(null);
      },
      error: () => {},
    });
  }

  deleteComment(id: string): void {
    this.wellService.deleteComment(this.wellId, id).subscribe({
      next: () => this.comments.update(list => list.filter(c => c.id !== id)),
      error: () => {},
    });
  }

  // ─── Computed helpers ─────────────────────────────────────────────────────

  statusCfg(): { label: string; color: string; bg: string } {
    const s = this.financing()?.status ?? 'EN_COURS';
    return STATUS_CFG[s] ?? STATUS_CFG['EN_COURS'];
  }

  totalValidated(): number {
    const fin = this.financing();
    if (fin?.ohmeTotalValidated != null) return fin.ohmeTotalValidated;
    const CONFIRMED = ['confirmed', 'paid_out', 'cheque_cashed'];
    return this.allPayments()
      .filter(p => CONFIRMED.includes(p.payment_status) && p.payment_source_campaign_code)
      .reduce((s, p) => s + (p.amount || 0), 0);
  }

  currentWell(): WellBreakdown | undefined { return this.wellsBreakdown().find(w => w.status === 'EN_COURS'); }
  currentWellPct(): number {
    const cw = this.currentWell();
    const t = this.financing()?.totalTarget ?? this.TARGET;
    return cw ? (cw.total / t) * 100 : 0;
  }
  nbWellsDone(): number { return this.wellsBreakdown().filter(w => w.status === 'COMPLETE').length; }

  activeEngagement(): Engagement | undefined {
    return this.financing()?.engagements?.find(e => e.status === 'EN_COURS');
  }

  getSelectedSource(paymentId: string): { code: string; name: string } {
    return this.selectedSources()[paymentId] ?? { code: '', name: '' };
  }

  engStatusCfg(status: string): { label: string; color: string; bg: string } {
    return STATUS_CFG[status] ?? STATUS_CFG['EN_COURS'];
  }

  wbPct(w: WellBreakdown): number {
    const target = this.financing()?.totalTarget ?? this.TARGET;
    return Math.min(100, (w.total / target) * 100);
  }

  ceilMonths(remaining: number, instalmentAmount: number): number {
    return Math.ceil(remaining / (instalmentAmount || 37));
  }

  back(): void { this.router.navigate(['/mensualisations']); }

  fmt(n: number): string {
    return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  fmtDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }
  fmtDateTime(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }
}
