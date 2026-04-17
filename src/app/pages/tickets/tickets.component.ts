import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TicketService } from '../../core/services/ticket.service';
import { UserService } from '../../core/services/user.service';
import { WellService } from '../../core/services/well.service';

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

interface Ticket {
  id: string;
  title: string;
  description: string;
  code: string;
  category: string;
  priority: 'BASSE' | 'NORMAL' | 'HAUTE' | 'URGENTE';
  status: 'NOUVEAU' | 'EN_COURS' | 'EN_ATTENTE' | 'RESOLU' | 'FERME' | 'ANNULE';
  createdBy: TicketUser;
  assignedTo: TicketUser | null;
  well?: Well | null;
  wellId?: string;
  wellCode?: string;
  dueDate?: string;
  createdAt: string;
  comments: { id: string }[];
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './tickets.component.html',
  styleUrl: './tickets.component.css',
})
export class TicketsComponent implements OnInit {
  tickets = signal<Ticket[]>([]);
  loading = signal(true);

  filterSearch = signal('');
  filterCategory = signal('');
  filterPriority = signal('');
  filterStatus = signal('');

  // Create modal
  createModal = signal(false);
  createLoading = signal(false);
  modalUsers = signal<TicketUser[]>([]);
  modalWells = signal<Well[]>([]);
  modalUsersLoading = signal(false);
  modalWellsLoading = signal(false);

  newTitle = signal('');
  newDescription = signal('');
  newCategory = signal('');
  newPriority = signal('NORMAL');
  newAssignedToId = signal('');
  newWellId = signal('');
  newDueDate = signal('');

  readonly categoryOptions = [
    { value: '', label: 'Toutes catégories' },
    { value: 'DEMANDE_MEDIA', label: 'Demande média' },
    { value: 'VALIDATION_FINANCE', label: 'Validation finance' },
    { value: 'CORRECTION_CRM', label: 'Correction CRM' },
    { value: 'LITIGE_DONATEUR', label: 'Litige donateur' },
    { value: 'PROBLEME_IMPORT', label: 'Problème import' },
    { value: 'SUPPORT_TECHNIQUE', label: 'Support technique' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  readonly priorityOptions = [
    { value: '', label: 'Toutes priorités' },
    { value: 'BASSE', label: 'Basse' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HAUTE', label: 'Haute' },
    { value: 'URGENTE', label: 'Urgente' },
  ];

  readonly statusOptions = [
    { value: '', label: 'Tous statuts' },
    { value: 'NOUVEAU', label: 'Nouveau' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'RESOLU', label: 'Résolu' },
    { value: 'FERME', label: 'Fermé' },
    { value: 'ANNULE', label: 'Annulé' },
  ];

  constructor(
    private ticketService: TicketService,
    private userService: UserService,
    private wellService: WellService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.filterSearch()) params['search'] = this.filterSearch();
    if (this.filterCategory()) params['category'] = this.filterCategory();
    if (this.filterPriority()) params['priority'] = this.filterPriority();
    if (this.filterStatus()) params['status'] = this.filterStatus();

    this.ticketService.getAll(params).subscribe({
      next: res => {
        this.tickets.set(res.data?.tickets ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void {
    this.loadTickets();
  }

  navigateToTicket(id: string): void {
    this.router.navigate(['/tickets', id]);
  }

  openCreateModal(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.newCategory.set('');
    this.newPriority.set('NORMAL');
    this.newAssignedToId.set('');
    this.newWellId.set('');
    this.newDueDate.set('');
    this.createModal.set(true);
    this.loadModalUsers();
    this.loadModalWells();
  }

  closeCreateModal(): void {
    this.createModal.set(false);
  }

  loadModalUsers(): void {
    this.modalUsersLoading.set(true);
    this.userService.getAll().subscribe({
      next: res => {
        this.modalUsers.set(res.data?.users ?? []);
        this.modalUsersLoading.set(false);
      },
      error: () => this.modalUsersLoading.set(false),
    });
  }

  loadModalWells(): void {
    this.modalWellsLoading.set(true);
    this.wellService.getAll().subscribe({
      next: res => {
        this.modalWells.set(res.data?.wells ?? []);
        this.modalWellsLoading.set(false);
      },
      error: () => this.modalWellsLoading.set(false),
    });
  }

  submitCreate(): void {
    if (!this.newTitle().trim()) return;
    this.createLoading.set(true);
    const body: Record<string, string> = {
      title: this.newTitle(),
      description: this.newDescription(),
      category: this.newCategory(),
      priority: this.newPriority(),
    };
    if (this.newAssignedToId()) body['assignedToId'] = this.newAssignedToId();
    if (this.newWellId()) body['wellId'] = this.newWellId();
    if (this.newDueDate()) body['dueDate'] = this.newDueDate();

    this.ticketService.create(body).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.closeCreateModal();
        this.loadTickets();
      },
      error: () => this.createLoading.set(false),
    });
  }

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

  getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
      URGENTE: '#f44336',
      HAUTE: '#ff9800',
      NORMAL: '#2196f3',
      BASSE: '#8bc34a',
    };
    return map[priority] ?? '#999';
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      URGENTE: 'Urgente',
      HAUTE: 'Haute',
      NORMAL: 'Normal',
      BASSE: 'Basse',
    };
    return map[priority] ?? priority;
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      URGENTE: 'priority-urgente',
      HAUTE: 'priority-haute',
      NORMAL: 'priority-normal',
      BASSE: 'priority-basse',
    };
    return map[priority] ?? 'priority-basse';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      NOUVEAU: 'badge-info',
      EN_COURS: 'badge-warning',
      EN_ATTENTE: 'badge-neutral',
      RESOLU: 'badge-success',
      FERME: 'badge-neutral',
      ANNULE: 'badge-danger',
    };
    return map[status] ?? 'badge-neutral';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      NOUVEAU: 'Nouveau',
      EN_COURS: 'En cours',
      EN_ATTENTE: 'En attente',
      RESOLU: 'Résolu',
      FERME: 'Fermé',
      ANNULE: 'Annulé',
    };
    return map[status] ?? status;
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }

  getUserName(user: TicketUser | null): string {
    if (!user) return 'Non assigné';
    return `${user.firstName} ${user.lastName}`;
  }

  getUserInitials(user: TicketUser | null): string {
    if (!user) return '?';
    return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  }

  getWellName(ticket: Ticket): string {
    if (ticket.well?.code) return ticket.well.code;
    if (ticket.wellCode) return ticket.wellCode;
    return '—';
  }
}
