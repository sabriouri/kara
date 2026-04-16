import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

interface Well {
  id: string;
  code: string;
  plaque?: string;
  country?: string;
  projectStatus: string;
  rdStatus: string;
  paidAmount: number;
  targetAmount: number;
}

interface TrancheDetail {
  id: string;
  reference: string;
  name?: string;
  country: string;
  status: string;
  amount?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  wells?: Well[];
  _count?: { wells?: number };
}

@Component({
  selector: 'app-tranche-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './tranche-detail.component.html',
  styleUrl: './tranche-detail.component.css'
})
export class TrancheDetailComponent implements OnInit {
  private readonly API = '/api';

  tranche  = signal<TrancheDetail | null>(null);
  loading  = signal(true);
  error    = signal('');
  saving   = signal(false);
  saveMsg  = signal('');
  editMode = signal(false);
  editForm = signal<Partial<TrancheDetail>>({});

  readonly statusOptions = [
    { value: 'PLANIFIEE',  label: 'Planifiée',  color: '#94A3B8', bg: '#F1F5F9' },
    { value: 'EN_TRAVAUX', label: 'En travaux', color: '#F59E0B', bg: '#FFFBEB' },
    { value: 'INAUGUREE',  label: 'Inaugurée',  color: '#1AABE2', bg: '#E8F6FD' },
    { value: 'LIVREE',     label: 'Livrée',     color: '#52AE4F', bg: '#EBF7EA' },
  ];

  readonly projectStatusColors: Record<string, string> = {
    PLANIFIE: '#f59e0b', EN_TRAVAUX: '#3b82f6',
    TRANCHE_1_INAUGUREE: '#10b981', TRANCHE_2_INAUGUREE: '#10b981', TRANCHE_3_INAUGUREE: '#10b981',
    TERMINE: '#6366f1',
  };

  totalCollected = computed(() => {
    const t = this.tranche();
    return t?.wells?.reduce((sum, w) => sum + (w.paidAmount ?? 0), 0) ?? 0;
  });

  totalTarget = computed(() => {
    const t = this.tranche();
    return t?.wells?.reduce((sum, w) => sum + (w.targetAmount ?? 0), 0) ?? 0;
  });

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<any>(`${this.API}/tranches/${id}`).subscribe({
      next: res => {
        this.tranche.set(res.data ?? res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Tranche introuvable.');
        this.loading.set(false);
      }
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
    this.http.patch<any>(`${this.API}/tranches/${t.id}`, this.editForm()).subscribe({
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
      }
    });
  }

  getStatusInfo(s: string): { label: string; color: string; bg: string } {
    return this.statusOptions.find(o => o.value === s) ?? { label: s.replace(/_/g, ' '), color: '#94A3B8', bg: '#F1F5F9' };
  }

  getProjectStatusColor(s: string): string {
    return this.projectStatusColors[s] ?? '#94a3b8';
  }

  wellProgress(w: Well): number {
    if (!w.targetAmount) return 0;
    return Math.min(Math.round((w.paidAmount / w.targetAmount) * 100), 100);
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);
  }

  fmtDate(d?: string): string {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
