import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

interface MilestoneTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
  status: string;
  order: number;
  dueDate?: string;
  tasks: MilestoneTask[];
}

interface ProjectMember {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ProjectDetail {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  color: string;
  status: string;
  progress: number;
  targetDate?: string;
  budgetTotal?: number;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
  };
  members: ProjectMember[];
  milestones: Milestone[];
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css',
})
export class ProjectDetailComponent implements OnInit {
  private readonly API = '/api';
  private projectId = '';

  project            = signal<ProjectDetail | null>(null);
  loading            = signal(true);
  activeTab          = signal<'timeline' | 'frise' | 'membres'>('timeline');
  expandedMilestones = signal<Set<string>>(new Set());

  // Milestone modal
  showMilestoneModal = signal(false);
  editingMilestone   = signal<Milestone | null>(null);
  milestoneTitle     = signal('');
  milestoneDesc      = signal('');
  milestoneDue       = signal('');
  milestoneStatus    = signal('EN_ATTENTE');
  milestoneTasks     = signal<string[]>(['']);
  milestoneLoading   = signal(false);

  // Member modal
  showMemberModal = signal(false);
  memberEmail     = signal('');
  memberRole      = signal('COLLABORATOR');
  memberLoading   = signal(false);

  // Delete confirm
  deleteConfirm = signal(false);

  // Per-milestone inline task add
  newTaskTitle = signal<Record<string, string>>({});

  readonly milestoneStatusOptions = [
    { value: 'EN_ATTENTE',  label: 'En attente'  },
    { value: 'EN_COURS',    label: 'En cours'    },
    { value: 'TERMINE',     label: 'Terminé'     },
    { value: 'BLOQUE',      label: 'Bloqué'      },
  ];

  readonly roleOptions = [
    { value: 'COLLABORATOR', label: 'Collaborateur' },
    { value: 'VALIDATOR',    label: 'Validateur'    },
    { value: 'VIEWER',       label: 'Observateur'   },
  ];

  sortedMilestones = computed(() => {
    const p = this.project();
    if (!p) return [];
    return [...p.milestones].sort((a, b) => a.order - b.order);
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectId = params['id'];
      this.loadProject();
    });
  }

  loadProject(): void {
    this.loading.set(true);
    this.http.get<any>(`${this.API}/projects/${this.projectId}`).subscribe({
      next: res => {
        const d = res.data ?? res;
        this.project.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ─── Milestone expand ────────────────────────────────────────────────────────
  toggleMilestone(id: string): void {
    const s = new Set(this.expandedMilestones());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.expandedMilestones.set(s);
  }

  isMilestoneExpanded(id: string): boolean {
    return this.expandedMilestones().has(id);
  }

  // ─── Milestone CRUD ──────────────────────────────────────────────────────────
  openCreateMilestone(): void {
    this.editingMilestone.set(null);
    this.milestoneTitle.set('');
    this.milestoneDesc.set('');
    this.milestoneDue.set('');
    this.milestoneStatus.set('EN_ATTENTE');
    this.milestoneTasks.set(['']);
    this.showMilestoneModal.set(true);
  }

  openEditMilestone(m: Milestone): void {
    this.editingMilestone.set(m);
    this.milestoneTitle.set(m.title);
    this.milestoneDesc.set(m.description ?? '');
    this.milestoneDue.set(m.dueDate ? m.dueDate.split('T')[0] : '');
    this.milestoneStatus.set(m.status);
    this.milestoneTasks.set(m.tasks.map(t => t.title));
    this.showMilestoneModal.set(true);
  }

  saveMilestone(): void {
    if (!this.milestoneTitle().trim()) return;
    this.milestoneLoading.set(true);

    const editing = this.editingMilestone();
    const tasks = this.milestoneTasks().filter(t => t.trim()).map(t => ({ title: t }));

    if (editing) {
      // PUT — edit
      const body: any = {
        title: this.milestoneTitle(),
        description: this.milestoneDesc() || undefined,
        dueDate: this.milestoneDue() || undefined,
        status: this.milestoneStatus(),
      };
      this.http.put<any>(`${this.API}/projects/${this.projectId}/milestones/${editing.id}`, body).subscribe({
        next: () => { this.milestoneLoading.set(false); this.showMilestoneModal.set(false); this.loadProject(); },
        error: () => this.milestoneLoading.set(false),
      });
    } else {
      // POST — create
      const body: any = {
        title: this.milestoneTitle(),
        description: this.milestoneDesc() || undefined,
        dueDate: this.milestoneDue() || undefined,
        order: (this.project()?.milestones.length ?? 0) + 1,
        tasks,
      };
      this.http.post<any>(`${this.API}/projects/${this.projectId}/milestones`, body).subscribe({
        next: () => { this.milestoneLoading.set(false); this.showMilestoneModal.set(false); this.loadProject(); },
        error: () => this.milestoneLoading.set(false),
      });
    }
  }

  deleteMilestone(id: string): void {
    this.http.delete<any>(`${this.API}/projects/${this.projectId}/milestones/${id}`).subscribe({
      next: () => this.loadProject(),
    });
  }

  // ─── Task CRUD ───────────────────────────────────────────────────────────────
  toggleTask(milestoneId: string, taskId: string, current: boolean): void {
    this.http.put<any>(
      `${this.API}/projects/${this.projectId}/milestones/${milestoneId}/tasks/${taskId}`,
      { isCompleted: !current }
    ).subscribe({
      next: () => {
        // Update locally without full reload for snappy UX
        const p = this.project();
        if (!p) return;
        const updated = {
          ...p,
          milestones: p.milestones.map(m =>
            m.id === milestoneId
              ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, isCompleted: !current } : t) }
              : m
          ),
        };
        this.project.set(updated);
      },
    });
  }

  addInlineTask(milestoneId: string): void {
    const titles = this.newTaskTitle();
    const title = (titles[milestoneId] ?? '').trim();
    if (!title) return;

    this.http.post<any>(
      `${this.API}/projects/${this.projectId}/milestones/${milestoneId}`,
      { tasks: [{ title }] }
    ).subscribe({
      next: () => {
        this.newTaskTitle.set({ ...this.newTaskTitle(), [milestoneId]: '' });
        this.loadProject();
      },
    });
  }

  setNewTaskTitle(milestoneId: string, value: string): void {
    this.newTaskTitle.set({ ...this.newTaskTitle(), [milestoneId]: value });
  }

  getTaskInput(milestoneId: string): string {
    return this.newTaskTitle()[milestoneId] ?? '';
  }

  // Modal task list helpers
  addMilestoneTask(): void {
    this.milestoneTasks.set([...this.milestoneTasks(), '']);
  }

  removeMilestoneTask(i: number): void {
    const arr = [...this.milestoneTasks()];
    arr.splice(i, 1);
    this.milestoneTasks.set(arr.length ? arr : ['']);
  }

  updateMilestoneTask(i: number, value: string): void {
    const arr = [...this.milestoneTasks()];
    arr[i] = value;
    this.milestoneTasks.set(arr);
  }

  // ─── Members ─────────────────────────────────────────────────────────────────
  inviteMember(): void {
    if (!this.memberEmail().trim()) return;
    this.memberLoading.set(true);
    this.http.post<any>(`${this.API}/projects/${this.projectId}/members`, {
      email: this.memberEmail(),
      role: this.memberRole(),
    }).subscribe({
      next: () => {
        this.memberLoading.set(false);
        this.memberEmail.set('');
        this.memberRole.set('COLLABORATOR');
        this.showMemberModal.set(false);
        this.loadProject();
      },
      error: () => this.memberLoading.set(false),
    });
  }

  removeMember(userId: string): void {
    this.http.delete<any>(`${this.API}/projects/${this.projectId}/members/${userId}`).subscribe({
      next: () => this.loadProject(),
    });
  }

  // ─── Delete project ───────────────────────────────────────────────────────────
  deleteProject(): void {
    this.http.delete<any>(`${this.API}/projects/${this.projectId}`).subscribe({
      next: () => this.router.navigate(['/projects']),
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  getStatusInfo(s: string): { label: string; color: string; bg: string } {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      BROUILLON: { label: 'Brouillon', color: '#64748B', bg: '#F1F5F9' },
      EN_COURS:  { label: 'En cours',  color: '#1D4ED8', bg: '#DBEAFE' },
      EN_PAUSE:  { label: 'En pause',  color: '#D97706', bg: '#FEF3C7' },
      TERMINE:   { label: 'Terminé',   color: '#065F46', bg: '#D1FAE5' },
      ANNULE:    { label: 'Annulé',    color: '#991B1B', bg: '#FEE2E2' },
    };
    return map[s] ?? { label: s, color: '#64748B', bg: '#F1F5F9' };
  }

  getMilestoneStatusInfo(s: string): { label: string; color: string; bg: string; dot: string } {
    const map: Record<string, { label: string; color: string; bg: string; dot: string }> = {
      EN_ATTENTE: { label: 'En attente', color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' },
      EN_COURS:   { label: 'En cours',   color: '#1D4ED8', bg: '#DBEAFE', dot: '#3B82F6' },
      TERMINE:    { label: 'Terminé',    color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
      BLOQUE:     { label: 'Bloqué',     color: '#991B1B', bg: '#FEE2E2', dot: '#EF4444' },
    };
    return map[s] ?? { label: s, color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' };
  }

  getRoleInfo(r: string): { label: string; color: string; bg: string } {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      COLLABORATOR: { label: 'Collaborateur', color: '#1D4ED8', bg: '#DBEAFE' },
      VALIDATOR:    { label: 'Validateur',    color: '#065F46', bg: '#D1FAE5' },
      VIEWER:       { label: 'Observateur',   color: '#64748B', bg: '#F1F5F9' },
    };
    return map[r] ?? { label: r, color: '#64748B', bg: '#F1F5F9' };
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  }

  progressColor(n: number): string {
    if (n >= 100) return '#10B981';
    if (n >= 60)  return '#3B82F6';
    if (n >= 30)  return '#F59E0B';
    return '#94A3B8';
  }

  milestoneIndex(id: string): number {
    return this.sortedMilestones().findIndex(m => m.id === id) + 1;
  }

  completedTasksCount(m: Milestone): number {
    return m.tasks.filter(t => t.isCompleted).length;
  }
}
