import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectService } from '../../core/services/project.service';

interface ProjectOwner {
  id: string;
  firstName: string;
  lastName: string;
}

interface ProjectMilestone {
  id: string;
  title: string;
  status: string;
  order: number;
  dueDate?: string;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  color: string;
  status: string;
  progress: number;
  targetDate?: string;
  owner: ProjectOwner;
  members: any[];
  milestones: ProjectMilestone[];
  _count: { milestones: number; members: number };
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css',
})
export class ProjectsComponent implements OnInit {
  projects      = signal<Project[]>([]);
  loading       = signal(true);
  createModal   = signal(false);
  createLoading = signal(false);

  filterSearch = signal('');
  filterStatus = signal('');

  newTitle       = signal('');
  newDescription = signal('');
  newStatus      = signal('EN_COURS');
  newTargetDate  = signal('');
  newEmoji       = signal('🚀');
  newColor       = signal('#3B82F6');

  readonly emojiOptions = ['🚀', '💧', '🌍', '🏗️', '🎯', '📋', '💡', '🌱', '🤝', '🏆', '📊', '🔧', '❤️', '🌟', '📌'];
  readonly colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  ];

  filtered = computed(() => {
    let list = this.projects();
    const s = this.filterSearch().toLowerCase();
    if (s) list = list.filter(p =>
      p.title.toLowerCase().includes(s) ||
      (p.description ?? '').toLowerCase().includes(s)
    );
    if (this.filterStatus()) list = list.filter(p => p.status === this.filterStatus());
    return list;
  });

  readonly statusOptions = [
    { value: '',          label: 'Tous statuts' },
    { value: 'BROUILLON', label: 'Brouillon'    },
    { value: 'EN_COURS',  label: 'En cours'     },
    { value: 'EN_PAUSE',  label: 'En pause'     },
    { value: 'TERMINE',   label: 'Terminé'      },
    { value: 'ANNULE',    label: 'Annulé'       },
  ];

  constructor(private projectService: ProjectService, private router: Router) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.projectService.getAll().subscribe({
      next: res => {
        const d = res.data ?? res;
        this.projects.set(Array.isArray(d) ? d : (d.projects ?? []));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToProject(id: string): void {
    this.router.navigate(['/projects', id]);
  }

  openCreateModal(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.newStatus.set('EN_COURS');
    this.newTargetDate.set('');
    this.newEmoji.set('🚀');
    this.newColor.set('#3B82F6');
    this.createModal.set(true);
  }

  closeCreateModal(): void {
    this.createModal.set(false);
  }

  submitCreate(): void {
    if (!this.newTitle().trim()) return;
    this.createLoading.set(true);
    this.projectService.create({
      title: this.newTitle(),
      description: this.newDescription() || undefined,
      status: this.newStatus(),
      emoji: this.newEmoji(),
      color: this.newColor(),
      targetDate: this.newTargetDate() || undefined,
    }).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.closeCreateModal();
        this.loadProjects();
      },
      error: () => this.createLoading.set(false),
    });
  }

  getStatusInfo(s: string): { label: string; color: string; bg: string } {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      BROUILLON: { label: 'Brouillon',  color: '#64748B', bg: '#F1F5F9' },
      EN_COURS:  { label: 'En cours',   color: '#1D4ED8', bg: '#DBEAFE' },
      EN_PAUSE:  { label: 'En pause',   color: '#D97706', bg: '#FEF3C7' },
      TERMINE:   { label: 'Terminé',    color: '#065F46', bg: '#D1FAE5' },
      ANNULE:    { label: 'Annulé',     color: '#991B1B', bg: '#FEE2E2' },
    };
    return map[s] ?? { label: s, color: '#64748B', bg: '#F1F5F9' };
  }

  getProgressColor(p: number): string {
    if (p >= 100) return '#10B981';
    if (p >= 60)  return '#3B82F6';
    if (p >= 30)  return '#F59E0B';
    return '#94A3B8';
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
  }

  isOverdue(project: Project): boolean {
    if (!project.targetDate || project.status === 'TERMINE') return false;
    return new Date(project.targetDate) < new Date();
  }
}
