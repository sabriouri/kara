import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AqiqaService } from '../../core/services/aqiqa.service';

export interface Aqiqa {
  id: string;
  code: string;
  beneficiaryName: string;
  birthDate: string;
  parentName: string;
  donorName: string;
  donorEmail: string;
  amount: number;
  status: 'EN_ATTENTE' | 'PLANIFIEE' | 'EXECUTEE' | 'LIVREE' | 'ARCHIVE';
  maghribTime?: string;
  createdAt: string;
}

export interface AqiqaStats {
  total: number;
  enAttente: number;
  recues: number;
}

@Component({
  selector: 'app-aqiqas',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './aqiqas.component.html',
  styleUrl: './aqiqas.component.css',
})
export class AqiqasComponent implements OnInit {
  aqiqas      = signal<Aqiqa[]>([]);
  stats       = signal<AqiqaStats | null>(null);
  loading     = signal(true);
  statsLoading = signal(true);

  page     = signal(1);
  total    = signal(0);
  totalPages = signal(1);
  limit    = 50;

  statusFilter = signal('');
  search       = signal('');

  downloadingId = signal<string | null>(null);

  readonly statuses = ['EN_ATTENTE', 'PLANIFIEE', 'EXECUTEE', 'LIVREE', 'ARCHIVE'];

  constructor(private aqiqaService: AqiqaService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadAqiqas();
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.aqiqaService.getStats().subscribe({
      next: res => {
        this.stats.set(res.data ?? null);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  loadAqiqas(): void {
    this.loading.set(true);
    const params: any = {
      page: this.page(),
      limit: this.limit,
    };
    if (this.statusFilter()) params.status = this.statusFilter();
    if (this.search()) params.search = this.search();

    this.aqiqaService.getAll(params).subscribe({
      next: res => {
        this.aqiqas.set(res.data?.aqiqas ?? []);
        this.total.set(res.data?.total ?? 0);
        this.totalPages.set(res.data?.totalPages ?? 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilter(): void {
    this.page.set(1);
    this.loadAqiqas();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadAqiqas();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadAqiqas();
    }
  }

  updateStatus(aqiqa: Aqiqa, status: string): void {
    const prev = aqiqa.status;
    this.aqiqas.update(list =>
      list.map(a => a.id === aqiqa.id ? { ...a, status: status as Aqiqa['status'] } : a)
    );
    this.aqiqaService.update(aqiqa.id, { status }).subscribe({
      error: () => {
        // Rollback on error
        this.aqiqas.update(list =>
          list.map(a => a.id === aqiqa.id ? { ...a, status: prev } : a)
        );
      },
    });
  }

  downloadReport(aqiqa: Aqiqa): void {
    this.downloadingId.set(aqiqa.id);
    this.aqiqaService.getReport(aqiqa.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aqiqa-${aqiqa.code}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => this.downloadingId.set(null),
    });
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'badge-warning',
      PLANIFIEE:  'badge-info',
      EXECUTEE:   'badge-success',
      LIVREE:     'badge-success',
      ARCHIVE:    'badge-neutral',
    };
    return map[s] ?? 'badge-neutral';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      PLANIFIEE:  'Planifiée',
      EXECUTEE:   'Exécutée',
      LIVREE:     'Livrée',
      ARCHIVE:    'Archivée',
    };
    return map[s] ?? s;
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatAmount(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  }

  get pages(): number[] {
    const total = this.totalPages();
    const cur   = this.page();
    const arr: number[] = [];
    const start = Math.max(1, cur - 2);
    const end   = Math.min(total, cur + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }
}
