import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

interface TicketUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Well {
  id: string;
  code: string;
  name?: string;
}

interface Comment {
  id: string;
  content: string;
  isInternal: boolean;
  isActivity?: boolean;
  createdAt: string;
  author: TicketUser;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  code: string;
  category: string;
  priority: string;
  status: string;
  createdBy: TicketUser;
  assignedTo: TicketUser | null;
  well?: Well | null;
  wellCode?: string;
  wellId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './ticket-detail.component.html',
  styleUrl: './ticket-detail.component.css',
})
export class TicketDetailComponent implements OnInit {
  private readonly API = '/api';

  ticket = signal<Ticket | null>(null);
  loading = signal(true);
  notFound = signal(false);

  // Comment form
  newComment = signal('');
  isInternal = signal(false);
  commentLoading = signal(false);

  // Status update
  statusUpdating = signal(false);

  // Delete
  deleteConfirm = signal(false);
  deleteLoading = signal(false);

  // Edit modal
  editModal = signal(false);
  editLoading = signal(false);
  editTitle = signal('');
  editDescription = signal('');
  editCategory = signal('');
  editPriority = signal('');
  editAssignedToId = signal('');
  editWellId = signal('');
  editDueDate = signal('');

  modalUsers = signal<TicketUser[]>([]);
  modalWells = signal<Well[]>([]);
  modalUsersLoading = signal(false);
  modalWellsLoading = signal(false);

  readonly categoryOptions = [
    { value: 'DEMANDE_MEDIA', label: 'Demande média' },
    { value: 'VALIDATION_FINANCE', label: 'Validation finance' },
    { value: 'CORRECTION_CRM', label: 'Correction CRM' },
    { value: 'LITIGE_DONATEUR', label: 'Litige donateur' },
    { value: 'PROBLEME_IMPORT', label: 'Problème import' },
    { value: 'SUPPORT_TECHNIQUE', label: 'Support technique' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  readonly priorityOptions = [
    { value: 'BASSE', label: 'Basse' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HAUTE', label: 'Haute' },
    { value: 'URGENTE', label: 'Urgente' },
  ];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadTicket(id);
  }

  loadTicket(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.http.get<any>(`${this.API}/tickets/${id}`).subscribe({
      next: res => {
        // Supporte { data: ticket } ET ticket directement selon le backend
        const t = res?.data ?? res;
        this.ticket.set(t?.id ? t : null);
        if (!t?.id) this.notFound.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  // ── Status quick-action buttons ────────────────────────────────────────────

  readonly statusActivityLabels: Record<string, string> = {
    EN_ATTENTE: 'Ticket mis en attente.',
    RESOLU:     'Ticket marqué comme résolu.',
    FERME:      'Ticket fermé.',
    EN_COURS:   'Ticket remis en cours.',
  };

  setStatus(newStatus: string): void {
    const t = this.ticket();
    if (!t || t.status === newStatus || this.statusUpdating()) return;

    const prevStatus = t.status;

    // ① Mise à jour optimiste immédiate — le statut change sans attendre l'API
    this.ticket.set({ ...t, status: newStatus, updatedAt: new Date().toISOString() });
    this.statusUpdating.set(true);

    this.http.patch<any>(`${this.API}/tickets/${t.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.statusUpdating.set(false);

        // ② Commentaire d'activité automatique — ajouté localement sans rechargement
        const msg = this.statusActivityLabels[newStatus];
        if (msg) {
          this.http.post<any>(`${this.API}/tickets/${t.id}/comments`, {
            content: msg,
            isInternal: true,
            isActivity: true,
          }).subscribe({
            next: res => {
              const comment = res?.data ?? res;
              if (comment?.id) {
                this.ticket.update(curr =>
                  curr ? { ...curr, comments: [...(curr.comments ?? []), comment] } : curr
                );
              }
            },
          });
        }
        // Pas de silentRefresh — l'update optimiste reste tel quel
      },
      error: () => {
        // ③ Revert si l'API refuse (404, 403, etc.)
        this.ticket.set({ ...t, status: prevStatus });
        this.statusUpdating.set(false);
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  deleteTicket(): void {
    const t = this.ticket();
    if (!t) return;
    this.deleteLoading.set(true);
    this.http.delete(`${this.API}/tickets/${t.id}`).subscribe({
      next: () => this.router.navigate(['/tickets']),
      error: () => this.deleteLoading.set(false),
    });
  }

  // ── Comment form ───────────────────────────────────────────────────────────

  submitComment(): void {
    const t = this.ticket();
    const content = this.newComment().trim();
    if (!t || !content) return;
    this.commentLoading.set(true);
    this.http.post<{ data: Comment }>(`${this.API}/tickets/${t.id}/comments`, {
      content,
      isInternal: this.isInternal(),
    }).subscribe({
      next: res => {
        const comment = res.data;
        const existing = this.ticket();
        if (existing && comment) {
          this.ticket.set({ ...existing, comments: [...(existing.comments ?? []), comment] });
        }
        this.newComment.set('');
        this.isInternal.set(false);
        this.commentLoading.set(false);
      },
      error: () => this.commentLoading.set(false),
    });
  }

  // ── Edit modal ─────────────────────────────────────────────────────────────

  openEditModal(): void {
    const t = this.ticket();
    if (!t) return;
    this.editTitle.set(t.title);
    this.editDescription.set(t.description ?? '');
    this.editCategory.set(t.category ?? '');
    this.editPriority.set(t.priority ?? 'NORMAL');
    this.editAssignedToId.set(t.assignedTo?.id ?? '');
    this.editWellId.set(t.well?.id ?? t.wellId ?? '');
    this.editDueDate.set(t.dueDate ? t.dueDate.substring(0, 10) : '');
    this.editModal.set(true);
    this.loadModalUsers();
    this.loadModalWells();
  }

  closeEditModal(): void {
    this.editModal.set(false);
  }

  loadModalUsers(): void {
    this.modalUsersLoading.set(true);
    this.http.get<{ data: { users: TicketUser[] } }>(`${this.API}/users`).subscribe({
      next: res => {
        this.modalUsers.set(res.data?.users ?? []);
        this.modalUsersLoading.set(false);
      },
      error: () => this.modalUsersLoading.set(false),
    });
  }

  loadModalWells(): void {
    this.modalWellsLoading.set(true);
    this.http.get<{ data: { wells: Well[] } }>(`${this.API}/wells`).subscribe({
      next: res => {
        this.modalWells.set(res.data?.wells ?? []);
        this.modalWellsLoading.set(false);
      },
      error: () => this.modalWellsLoading.set(false),
    });
  }

  submitEdit(): void {
    const t = this.ticket();
    if (!t || !this.editTitle().trim()) return;
    this.editLoading.set(true);
    const body: Record<string, string> = {
      title: this.editTitle(),
      description: this.editDescription(),
      category: this.editCategory(),
      priority: this.editPriority(),
    };
    if (this.editAssignedToId()) body['assignedToId'] = this.editAssignedToId();
    if (this.editWellId()) body['wellId'] = this.editWellId();
    if (this.editDueDate()) body['dueDate'] = this.editDueDate();

    this.http.patch<{ data: Ticket }>(`${this.API}/tickets/${t.id}`, body).subscribe({
      next: res => {
        if (res.data) {
          this.ticket.set({ ...res.data, comments: t.comments });
        }
        this.editLoading.set(false);
        this.closeEditModal();
      },
      error: () => this.editLoading.set(false),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getCategoryIcon(category: string): string {
    const map: Record<string, string> = {
      DEMANDE_MEDIA: 'camera',
      VALIDATION_FINANCE: 'banknote',
      CORRECTION_CRM: 'database',
      LITIGE_DONATEUR: 'alert-triangle',
      PROBLEME_IMPORT: 'file-down',
      SUPPORT_TECHNIQUE: 'wrench',
      AUTRE: 'clipboard-list',
    };
    return map[category] ?? 'clipboard-list';
  }

  getCategoryLabel(cat: string): string {
    const map: Record<string, string> = {
      DEMANDE_MEDIA: 'Demande média',
      VALIDATION_FINANCE: 'Validation finance',
      CORRECTION_CRM: 'Correction CRM',
      LITIGE_DONATEUR: 'Litige donateur',
      PROBLEME_IMPORT: 'Problème import',
      SUPPORT_TECHNIQUE: 'Support technique',
      AUTRE: 'Autre',
    };
    return map[cat] ?? cat;
  }

  getPriorityLabel(p: string): string {
    const m: Record<string, string> = { URGENTE: 'Urgente', HAUTE: 'Haute', NORMAL: 'Normal', BASSE: 'Basse' };
    return m[p] ?? p;
  }

  getPriorityClass(p: string): string {
    const m: Record<string, string> = {
      URGENTE: 'priority-urgente',
      HAUTE: 'priority-haute',
      NORMAL: 'priority-normal',
      BASSE: 'priority-basse',
    };
    return m[p] ?? 'priority-basse';
  }

  getStatusLabel(s: string): string {
    const m: Record<string, string> = {
      NOUVEAU: 'Nouveau',
      EN_COURS: 'En cours',
      EN_ATTENTE: 'En attente',
      RESOLU: 'Résolu',
      FERME: 'Fermé',
      ANNULE: 'Annulé',
    };
    return m[s] ?? s;
  }

  getStatusClass(s: string): string {
    const m: Record<string, string> = {
      NOUVEAU: 'badge-info',
      EN_COURS: 'badge-warning',
      EN_ATTENTE: 'badge-neutral',
      RESOLU: 'badge-success',
      FERME: 'badge-neutral',
      ANNULE: 'badge-danger',
    };
    return m[s] ?? 'badge-neutral';
  }

  getUserName(user: TicketUser | null | undefined): string {
    if (!user) return '—';
    return `${user.firstName} ${user.lastName}`;
  }

  getInitials(user: TicketUser | null | undefined): string {
    if (!user) return '?';
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  }

  getWellDisplay(t: Ticket): string {
    if (t.well?.code) return t.well.code;
    if (t.wellCode) return t.wellCode;
    return '—';
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  formatDateShort(date: string): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }
}
