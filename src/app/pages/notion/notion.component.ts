import {
  Component,
  signal,
  computed,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// ── Poles ────────────────────────────────────────────────────────────────────

export interface PoleConfig {
  code: string;
  label: string;
  color: string;
}

export const POLES: PoleConfig[] = [
  { code: 'ALL',          label: 'Tous les pôles',    color: '#64748b' },
  { code: 'RD',           label: 'Relation Donateur', color: '#2563eb' },
  { code: 'MARKETING',    label: 'Marketing',         color: '#7c3aed' },
  { code: 'COMPTABILITE', label: 'Comptabilité',      color: '#059669' },
  { code: 'POLE_PROJET',  label: 'Pôle Projet',       color: '#d97706' },
  { code: 'SOCIAL_FRANCE',label: 'Social France',     color: '#dc2626' },
];

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface NoteAuthor {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  poleCode: string;
  tags: string[];
  isPublic: boolean;
  authorId: string;
  author: NoteAuthor;
  createdAt: string;
  updatedAt: string;
  editCount?: number;
  canEdit?: boolean;
}

export interface NoteForm {
  title: string;
  content: string;
  poleCode: string;
  tags: string[];
  isPublic: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-notion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './notion.component.html',
  styleUrl: './notion.component.css',
})
export class NotionComponent implements OnInit {

  @ViewChild('editorRef') editorRef?: ElementRef<HTMLDivElement>;

  // Expose POLES to template
  readonly poles = POLES;

  // ── Signals ────────────────────────────────────────────────────────────────
  notes       = signal<Note[]>([]);
  allTags     = signal<string[]>([]);
  loading     = signal(true);
  search      = signal('');
  filterPole  = signal('ALL');
  filterTag   = signal('');
  filterMine  = signal(false);
  selected    = signal<Note | null>(null);
  editing     = signal<string | null>(null); // 'new' | note.id
  deleting    = signal<string | null>(null);
  saving      = signal(false);
  form        = signal<NoteForm>({ title: '', content: '', poleCode: 'ALL', tags: [], isPublic: true });
  tagInput    = signal('');

  // ── Search debounce ────────────────────────────────────────────────────────
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.loadNotes();
    this.loadTags();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadNotes(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.search())     params['search'] = this.search();
    if (this.filterPole() !== 'ALL') params['pole'] = this.filterPole();
    if (this.filterTag())  params['tag']  = this.filterTag();
    if (this.filterMine()) params['mine'] = 'true';

    this.http.get<any>('/api/notion', { params }).subscribe({
      next: (res) => {
        let data: Note[] = [];
        if (res?.data?.success && res.data.data) {
          data = res.data.data;
        } else if (res?.data) {
          data = Array.isArray(res.data) ? res.data : [];
        } else if (Array.isArray(res)) {
          data = res;
        }
        this.notes.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notes.set([]);
        this.loading.set(false);
      },
    });
  }

  loadTags(): void {
    this.http.get<any>('/api/notion/meta/tags').subscribe({
      next: (res) => {
        let tags: string[] = [];
        if (res?.data?.data) {
          tags = Array.isArray(res.data.data) ? res.data.data : [];
        } else if (res?.data) {
          tags = Array.isArray(res.data) ? res.data : [];
        }
        this.allTags.set(tags);
      },
      error: () => this.allTags.set([]),
    });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  openNew(): void {
    this.form.set({ title: '', content: '', poleCode: 'ALL', tags: [], isPublic: true });
    this.tagInput.set('');
    this.editing.set('new');
    this.selected.set(null);
    setTimeout(() => {
      if (this.editorRef) {
        this.editorRef.nativeElement.innerHTML = '';
      }
    }, 0);
  }

  openEdit(note: Note): void {
    this.form.set({
      title:    note.title,
      content:  note.content,
      poleCode: note.poleCode,
      tags:     [...note.tags],
      isPublic: note.isPublic,
    });
    this.tagInput.set('');
    this.editing.set(note.id);
    this.selected.set(null);
    setTimeout(() => {
      if (this.editorRef) {
        this.editorRef.nativeElement.innerHTML = note.content ?? '';
      }
    }, 0);
  }

  openNote(noteId: string): void {
    this.editing.set(null);
    this.http.get<any>(`/api/notion/${noteId}`).subscribe({
      next: (res) => {
        let note: Note | null = null;
        if (res?.data?.data) {
          note = res.data.data;
        } else if (res?.data) {
          note = res.data;
        }
        this.selected.set(note);
      },
      error: () => this.selected.set(null),
    });
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const f = this.form();
    const isNew = this.editing() === 'new';
    const req$ = isNew
      ? this.http.post<any>('/api/notion', f)
      : this.http.put<any>(`/api/notion/${this.editing()}`, f);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.loadNotes();
        this.loadTags();
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(): void {
    const id = this.deleting();
    if (!id) return;
    this.http.delete<any>(`/api/notion/${id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.selected.set(null);
        this.editing.set(null);
        this.loadNotes();
      },
      error: () => this.deleting.set(null),
    });
  }

  cancelDelete(): void {
    this.deleting.set(null);
  }

  closePanel(): void {
    this.selected.set(null);
    this.editing.set(null);
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  addTag(): void {
    const raw = this.tagInput().trim();
    if (!raw) return;
    const tag = raw.toLowerCase().replace(/\s+/g, '-');
    const current = this.form();
    if (!current.tags.includes(tag)) {
      this.form.set({ ...current, tags: [...current.tags, tag] });
    }
    this.tagInput.set('');
  }

  removeTag(t: string): void {
    const current = this.form();
    this.form.set({ ...current, tags: current.tags.filter(x => x !== t) });
  }

  onTagInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }

  // ── Rich editor ────────────────────────────────────────────────────────────

  execCmd(cmd: string, val?: string): void {
    document.execCommand(cmd, false, val ?? undefined);
    if (this.editorRef) {
      const html = this.editorRef.nativeElement.innerHTML;
      const current = this.form();
      this.form.set({ ...current, content: html });
    }
    this.editorRef?.nativeElement.focus();
  }

  onEditorInput(): void {
    if (this.editorRef) {
      const html = this.editorRef.nativeElement.innerHTML;
      const current = this.form();
      this.form.set({ ...current, content: html });
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  setSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadNotes(), 400);
  }

  setFilterPole(code: string): void {
    this.filterPole.set(code);
    this.loadNotes();
  }

  setFilterTag(tag: string): void {
    const current = this.filterTag();
    this.filterTag.set(current === tag ? '' : tag);
    this.loadNotes();
  }

  toggleFilterMine(): void {
    this.filterMine.set(!this.filterMine());
    this.loadNotes();
  }

  setFormPoleCode(code: string): void {
    const current = this.form();
    this.form.set({ ...current, poleCode: code });
  }

  setFormIsPublic(value: boolean): void {
    const current = this.form();
    this.form.set({ ...current, isPublic: value });
  }

  updateFormTitle(value: string): void {
    const current = this.form();
    this.form.set({ ...current, title: value });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getPole(code: string): PoleConfig {
    return POLES.find(p => p.code === code) ?? POLES[0];
  }

  getUserId(): string | null {
    try {
      const token = localStorage.getItem('token') ?? localStorage.getItem('access_token');
      if (!token) return null;
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.userId ?? decoded.sub ?? decoded.id ?? null;
    } catch {
      return null;
    }
  }

  isMe(authorId: string): boolean {
    return this.getUserId() === authorId;
  }

  getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  formatDate(d: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d));
  }

  formatTime(d: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));
  }

  getAuthorName(note: Note): string {
    if (!note.author) return 'Inconnu';
    return `${note.author.firstName ?? ''} ${note.author.lastName ?? ''}`.trim();
  }
}
