import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TrancheService } from '../../../core/services/tranche.service';

interface Well {
  id: string;
  code: string;
  plaque?: string;
  country?: string;
  projectStatus: string;
  rdStatus: string;
  paidAmount: number;
  targetAmount: number;
  donorEmail?: string;
}

interface TrancheDetail {
  id: string;
  reference: string;
  country: string;
  region?: string;
  status: string;
  totalAmount?: number;
  provider?: string;
  startedDate?: string;
  inauguratedDate?: string;
  deliveredDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  wells?: Well[];
  wellCount?: number;
  createdBy?: { firstName: string; lastName: string };
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PLANIFIEE:  { label: 'Planifiée',  color: '#f59e0b', bg: '#fffbeb', icon: 'clipboard-list'   },
  EN_TRAVAUX: { label: 'En travaux', color: '#3b82f6', bg: '#eff6ff', icon: 'hammer'            },
  INAUGUREE:  { label: 'Inaugurée',  color: '#10b981', bg: '#f0fdf4', icon: 'flag'              },
  LIVREE:     { label: 'Livrée',     color: '#6366f1', bg: '#f5f3ff', icon: 'circle-check-big'  },
};

@Component({
  selector: 'app-tranche-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './tranche-detail.component.html',
  styleUrl: './tranche-detail.component.css'
})
export class TrancheDetailComponent implements OnInit {

  tranche  = signal<TrancheDetail | null>(null);
  loading  = signal(true);
  error    = signal('');
  saving   = signal(false);
  saveMsg  = signal('');
  editMode = signal(false);
  editForm = signal<Partial<TrancheDetail>>({});

  readonly statusOptions = Object.entries(STATUS_MAP).map(([value, v]) => ({ value, ...v }));

  readonly projectStatusColors: Record<string, string> = {
    PLANIFIE: '#f59e0b', EN_TRAVAUX: '#3b82f6',
    TRANCHE_1_INAUGUREE: '#10b981', TRANCHE_2_INAUGUREE: '#10b981',
    TRANCHE_3_INAUGUREE: '#10b981', TERMINE: '#6366f1',
  };

  totalCollected = computed(() =>
    this.tranche()?.wells?.reduce((s, w) => s + (w.paidAmount ?? 0), 0) ?? 0
  );

  totalTarget = computed(() =>
    this.tranche()?.wells?.reduce((s, w) => s + (w.targetAmount ?? 0), 0) ?? 0
  );

  constructor(private route: ActivatedRoute, private trancheService: TrancheService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.trancheService.getById(id!).subscribe({
      next: res => { this.tranche.set(res.data ?? res); this.loading.set(false); },
      error: ()  => { this.error.set('Tranche introuvable.'); this.loading.set(false); },
    });
  }

  startEdit(): void {
    const t = this.tranche();
    if (!t) return;
    this.editForm.set({ ...t });
    this.editMode.set(true);
  }

  cancelEdit(): void { this.editMode.set(false); }

  setEditField(key: string, value: any): void {
    this.editForm.update(f => ({ ...f, [key]: value }));
  }

  saveEdit(): void {
    const t = this.tranche();
    if (!t) return;
    this.saving.set(true);
    this.trancheService.update(t.id, this.editForm()).subscribe({
      next: res => {
        this.tranche.set(res.data ?? res);
        this.editMode.set(false);
        this.saving.set(false);
        this.saveMsg.set('Enregistré');
        setTimeout(() => this.saveMsg.set(''), 2500);
      },
      error: () => {
        this.saving.set(false);
        this.saveMsg.set('Erreur');
        setTimeout(() => this.saveMsg.set(''), 3000);
      },
    });
  }

  getStatusInfo(s: string) {
    return STATUS_MAP[s] ?? { label: s.replace(/_/g, ' '), color: '#94a3b8', bg: '#f1f5f9', icon: 'circle' };
  }

  getProjectStatusColor(s: string): string {
    return this.projectStatusColors[s] ?? '#94a3b8';
  }

  wellProgress(w: Well): number {
    if (!w.targetAmount) return 0;
    return Math.min(Math.round((w.paidAmount / w.targetAmount) * 100), 100);
  }

  fmtAmount(n?: number): string {
    if (n == null) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  }

  fmtDate(d?: string): string {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  fmtShortDate(d?: string): string {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
