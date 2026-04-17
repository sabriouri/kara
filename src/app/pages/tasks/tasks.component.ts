import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TaskService } from '../../core/services/task.service';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'BASSE' | 'NORMAL' | 'HAUTE' | 'URGENTE';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  progress: number;
  assignee?: { firstName: string; lastName: string };
  dueDate?: string;
  createdAt: string;
}

interface CreateTaskPayload {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, DragDropModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css',
})
export class TasksComponent implements OnInit {
  tasks   = signal<Task[]>([]);
  loading = signal(true);
  saving  = signal(false);
  viewMode = signal<'kanban' | 'list'>('kanban');

  search   = signal('');
  priority = signal('');

  showModal = signal(false);
  newTask: CreateTaskPayload = { title: '', description: '', priority: 'NORMAL', dueDate: '' };

  readonly columns = [
    { key: 'TODO',        label: 'À faire',    color: '#94A3B8', bg: '#F1F5F9', accent: '#64748B' },
    { key: 'IN_PROGRESS', label: 'En cours',   color: '#1AABE2', bg: '#E8F6FD', accent: '#1190C5' },
    { key: 'BLOCKED',     label: 'Bloqué',     color: '#EF4444', bg: '#FEE2E2', accent: '#DC2626' },
    { key: 'COMPLETED',   label: 'Terminé',    color: '#52AE4F', bg: '#EBF7EA', accent: '#3D8F3A' },
  ];

  readonly priorities = ['BASSE', 'NORMAL', 'HAUTE', 'URGENTE'];
  readonly statuses   = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];

  get dropListIds(): string[] {
    return this.columns.map(c => 'col-' + c.key);
  }

  filteredTasks = computed(() => {
    let list = this.tasks();
    const q = this.search().toLowerCase().trim();
    const p = this.priority();
    if (q) list = list.filter(t => t.title.toLowerCase().includes(q));
    if (p) list = list.filter(t => t.priority === p);
    return list;
  });

  columnTasks = computed(() => {
    const filtered = this.filteredTasks();
    return this.columns.reduce((acc, col) => {
      acc[col.key] = filtered.filter(t => t.status === col.key);
      return acc;
    }, {} as Record<string, Task[]>);
  });

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.search()) params.search = this.search();
    if (this.priority()) params.priority = this.priority();

    this.taskService.getAll(params).subscribe({
      next: res => {
        this.tasks.set(res.data?.tasks ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilter(): void {
    this.loadTasks();
  }

  onDrop(event: CdkDragDrop<Task[]>, targetStatus: string): void {
    if (event.previousContainer === event.container) {
      const col = [...event.container.data];
      moveItemInArray(col, event.previousIndex, event.currentIndex);
      this.tasks.update(all => {
        const others = all.filter(t => t.status !== targetStatus);
        return [...others, ...col];
      });
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      this.tasks.update(all =>
        all.map(t => t.id === task.id ? { ...t, status: targetStatus as Task['status'] } : t)
      );
      this.taskService.update(task.id, { status: targetStatus }).subscribe({
        error: () => this.loadTasks(),
      });
    }
  }

  openModal(): void {
    this.newTask = { title: '', description: '', priority: 'NORMAL', dueDate: '' };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  createTask(): void {
    if (!this.newTask.title.trim()) return;
    this.saving.set(true);
    this.taskService.create(this.newTask).subscribe({
      next: res => {
        if (res.data?.task) {
          this.tasks.update(list => [...list, res.data.task]);
        }
        this.saving.set(false);
        this.closeModal();
      },
      error: () => {
        this.saving.set(false);
        this.loadTasks();
        this.closeModal();
      },
    });
  }

  updateStatus(task: Task, status: string): void {
    this.tasks.update(all =>
      all.map(t => t.id === task.id ? { ...t, status: status as Task['status'] } : t)
    );
    this.taskService.update(task.id, { status }).subscribe({
      error: () => this.loadTasks(),
    });
  }

  initials(task: Task): string {
    if (!task.assignee) return '?';
    return (task.assignee.firstName[0] ?? '') + (task.assignee.lastName[0] ?? '');
  }

  assigneeName(task: Task): string {
    if (!task.assignee) return '—';
    return `${task.assignee.firstName} ${task.assignee.lastName}`;
  }

  priorityClass(p: string): string {
    const map: Record<string, string> = {
      BASSE: 'badge-neutral',
      NORMAL: 'badge-info',
      HAUTE: 'badge-warning',
      URGENTE: 'badge-danger',
    };
    return map[p] ?? 'badge-neutral';
  }

  priorityLabel(p: string): string {
    const map: Record<string, string> = {
      BASSE: 'Basse',
      NORMAL: 'Normal',
      HAUTE: 'Haute',
      URGENTE: 'Urgente',
    };
    return map[p] ?? p;
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      TODO: 'badge-neutral',
      IN_PROGRESS: 'badge-info',
      BLOCKED: 'badge-danger',
      COMPLETED: 'badge-success',
      CANCELLED: 'badge-neutral',
    };
    return map[s] ?? 'badge-neutral';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      TODO: 'À faire',
      IN_PROGRESS: 'En cours',
      BLOCKED: 'Bloqué',
      COMPLETED: 'Terminé',
      CANCELLED: 'Annulé',
    };
    return map[s] ?? s;
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  isOverdue(d?: string): boolean {
    if (!d) return false;
    return new Date(d) < new Date();
  }
}
