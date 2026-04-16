import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

interface Comment {
  id: string;
  content: string;
  author?: { firstName?: string; lastName?: string };
  createdAt: string;
}

interface Instalment {
  id: string;
  dueDate: string;
  amount: number;
  status: string;
  paidAt?: string;
}

interface WellDetail {
  id: string;
  code: string;
  plaque?: string;
  country?: string;
  region?: string;
  zone?: string;
  campaign?: string;
  projectStatus: string;
  rdStatus: string;
  targetAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isInstalment?: boolean;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  donorPhone?: string;
  paymentMode?: string;
  donationDate?: string;
  notes?: string;
  trancheId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  comments?: Comment[];
  instalments?: Instalment[];
  tranche?: { id: string; reference?: string; name?: string };
  donors?: { donorName: string; donorEmail: string; amount: number; percentage: number }[];
  _count?: { media?: number; tickets?: number };
}

type Tab = 'info' | 'finance' | 'donor' | 'dates' | 'comments';

@Component({
  selector: 'app-well-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './well-detail.component.html',
  styleUrl: './well-detail.component.css'
})
export class WellDetailComponent implements OnInit {
  private readonly API = '/api';

  well       = signal<WellDetail | null>(null);
  loading    = signal(true);
  error      = signal('');
  activeTab  = signal<Tab>('info');
  saving     = signal(false);
  saveMsg    = signal('');

  // Edit mode
  editMode   = signal(false);
  editForm   = signal<Partial<WellDetail>>({});

  // Comments
  newComment  = signal('');
  addingComment = signal(false);

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'info',     label: 'Informations', icon: 'info'          },
    { key: 'finance',  label: 'Finance',       icon: 'wallet'        },
    { key: 'donor',    label: 'Donateur',      icon: 'user'          },
    { key: 'dates',    label: 'Dates',         icon: 'calendar'      },
    { key: 'comments', label: 'Commentaires',  icon: 'message-circle'},
  ];

  readonly projectStatuses = [
    { value: 'PLANIFIE',            label: 'Planifié' },
    { value: 'EN_TRAVAUX',          label: 'En travaux' },
    { value: 'TRANCHE_1_INAUGUREE', label: 'Tranche 1 inaugurée' },
    { value: 'TRANCHE_2_INAUGUREE', label: 'Tranche 2 inaugurée' },
    { value: 'TRANCHE_3_INAUGUREE', label: 'Tranche 3 inaugurée' },
    { value: 'TERMINE',             label: 'Terminé' },
  ];

  readonly rdStatuses = [
    { value: 'EN_ATTENTE',      label: 'En attente' },
    { value: 'MEDIAS_ATTENDUS', label: 'Médias attendus' },
    { value: 'MEDIAS_RECUS',    label: 'Médias reçus' },
    { value: 'PRET_A_LIVRER',   label: 'Prêt à livrer' },
    { value: 'LIVRE',           label: 'Livré' },
    { value: 'ARCHIVE',         label: 'Archivé' },
  ];

  progress = computed(() => {
    const w = this.well();
    if (!w || !w.targetAmount) return 0;
    return Math.min(Math.round((w.paidAmount / w.targetAmount) * 100), 100);
  });

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<any>(`${this.API}/wells/${id}`).subscribe({
      next: res => {
        const d = res.data ?? res;
        this.well.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Puits introuvable ou erreur serveur.');
        this.loading.set(false);
      }
    });
  }

  setTab(t: Tab): void { this.activeTab.set(t); }

  startEdit(): void {
    const w = this.well();
    if (!w) return;
    this.editForm.set({ ...w });
    this.editMode.set(true);
  }

  cancelEdit(): void { this.editMode.set(false); }

  setEditField(key: string, value: any): void {
    this.editForm.update(f => ({ ...f, [key]: value }));
  }

  saveEdit(): void {
    const w = this.well();
    if (!w) return;
    this.saving.set(true);
    this.http.patch<any>(`${this.API}/wells/${w.id}`, this.editForm()).subscribe({
      next: res => {
        const d = res.data ?? res;
        this.well.set(d);
        this.editMode.set(false);
        this.saving.set(false);
        this.saveMsg.set('Enregistré');
        setTimeout(() => this.saveMsg.set(''), 2500);
      },
      error: () => {
        this.saving.set(false);
        this.saveMsg.set('Erreur lors de la sauvegarde');
        setTimeout(() => this.saveMsg.set(''), 3000);
      }
    });
  }

  submitComment(): void {
    const w = this.well();
    const txt = this.newComment().trim();
    if (!w || !txt) return;
    this.addingComment.set(true);
    this.http.post<any>(`${this.API}/wells/${w.id}/comments`, { content: txt }).subscribe({
      next: res => {
        const updated = res.data ?? res;
        // Re-fetch to get updated comments list
        this.http.get<any>(`${this.API}/wells/${w.id}`).subscribe({
          next: r2 => {
            this.well.set(r2.data ?? r2);
            this.newComment.set('');
            this.addingComment.set(false);
          },
          error: () => this.addingComment.set(false)
        });
      },
      error: () => this.addingComment.set(false)
    });
  }

  getProjectStatusColor(s: string): string {
    const m: Record<string, string> = {
      PLANIFIE: '#f59e0b', EN_TRAVAUX: '#3b82f6',
      TRANCHE_1_INAUGUREE: '#10b981', TRANCHE_2_INAUGUREE: '#10b981', TRANCHE_3_INAUGUREE: '#10b981',
      TERMINE: '#6366f1',
    };
    return m[s] ?? '#94a3b8';
  }

  getRdStatusColor(s: string): string {
    const m: Record<string, string> = {
      EN_ATTENTE: '#94a3b8', MEDIAS_ATTENDUS: '#f59e0b', MEDIAS_RECUS: '#3b82f6',
      PRET_A_LIVRER: '#8b5cf6', LIVRE: '#10b981', ARCHIVE: '#6b7280',
    };
    return m[s] ?? '#94a3b8';
  }

  getProjectStatusLabel(s: string): string {
    return this.projectStatuses.find(x => x.value === s)?.label ?? s.replace(/_/g, ' ');
  }

  getRdStatusLabel(s: string): string {
    return this.rdStatuses.find(x => x.value === s)?.label ?? s.replace(/_/g, ' ');
  }

  getInstalmentStatusColor(s: string): string {
    const m: Record<string, string> = {
      PAYE: '#10b981', EN_ATTENTE: '#f59e0b', RETARD: '#ef4444', ANNULE: '#94a3b8',
    };
    return m[s] ?? '#94a3b8';
  }

  getDonorName(w: WellDetail): string {
    if (w.donors?.[0]?.donorName) return w.donors[0].donorName;
    const name = `${w.donorFirstName ?? ''} ${w.donorLastName ?? ''}`.trim();
    return name || w.donorEmail || '';
  }

  getAuthorName(c: Comment): string {
    if (!c.author) return 'Système';
    return `${c.author.firstName ?? ''} ${c.author.lastName ?? ''}`.trim() || 'Utilisateur';
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);
  }

  fmtDate(d: string | undefined): string {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  paymentModeLabel(m: string | undefined): string {
    const map: Record<string, string> = {
      VIREMENT: 'Virement bancaire', CHEQUE: 'Chèque', ESPECES: 'Espèces',
      CB: 'Carte bancaire', PRELEVEMENT: 'Prélèvement automatique',
    };
    return m ? (map[m] ?? m) : '–';
  }
}
