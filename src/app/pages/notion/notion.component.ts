import {
  Component,
  signal,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NotionService } from '../../core/services/notion.service';

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

// ── Village game ─────────────────────────────────────────────────────────────

interface VBuilding {
  x: number; y: number; w: number; h: number;
  code: string; label: string; color: string;
}

const VILLAGE_BUILDINGS: VBuilding[] = [
  { x:155, y:205, w:190, h:145, code:'RD',            label:'Relation Donateur', color:'#2563eb' },
  { x:700, y:185, w:190, h:145, code:'COMPTABILITE',  label:'Comptabilité',      color:'#059669' },
  { x: 68, y:400, w:185, h:135, code:'MARKETING',     label:'Marketing',         color:'#7c3aed' },
  { x:730, y:400, w:185, h:135, code:'SOCIAL_FRANCE', label:'Social France',     color:'#dc2626' },
  { x:590, y:555, w:190, h:145, code:'POLE_PROJET',   label:'Pôle Projet',       color:'#d97706' },
];

@Component({
  selector: 'app-notion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './notion.component.html',
  styleUrl: './notion.component.css',
})
export class NotionComponent implements OnInit, OnDestroy {

  @ViewChild('editorRef')    editorRef?:    ElementRef<HTMLDivElement>;
  @ViewChild('villageCanvas') villageCanvas?: ElementRef<HTMLCanvasElement>;

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

  // ── Village state ──────────────────────────────────────────────────────────
  villageMode  = signal(false);
  nearBuilding = signal<VBuilding | null>(null);

  private loopId    = 0;
  private mapImg    = new Image();
  private charImg   = new Image();
  private imgsReady = 0;
  private keys      = new Set<string>();
  private player    = { x: 512, y: 650, dir: 0, frame: 1, frameTimer: 0 };
  private lastTime  = 0;
  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?:   (e: KeyboardEvent) => void;

  // Sprite layout: single row, 12 frames total
  private readonly TOTAL_FRAMES = 12;
  private readonly SPEED    = 3;
  private readonly FRAME_MS = 140;

  // ── Search debounce ────────────────────────────────────────────────────────
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private notionService: NotionService,
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadNotes();
    this.loadTags();
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.unbindKeys();
  }

  // ── Village game ───────────────────────────────────────────────────────────

  enterVillage(): void {
    this.villageMode.set(true);
    this.player = { x: 512, y: 650, dir: 0, frame: 1, frameTimer: 0 };
    this.imgsReady = 0;
    setTimeout(() => {
      this.resizeCanvas();
      this.loadVillageImages();
      this.bindKeys();
    }, 120);
  }

  exitVillage(): void {
    this.villageMode.set(false);
    this.nearBuilding.set(null);
    this.stopLoop();
    this.unbindKeys();
  }

  private resizeCanvas(): void {
    const c = this.villageCanvas?.nativeElement;
    if (!c) return;
    // Fill as much space as possible (minus topbar ~50px + legend ~40px + padding)
    const size = Math.min(
      window.innerWidth  - 48,
      window.innerHeight - 140,
      900
    );
    c.width  = size;
    c.height = size;
    // Init player at center-bottom of the canvas (canvas coords, not map coords)
    this.player.x = size / 2;
    this.player.y = size * 0.72;
  }

  private loadVillageImages(): void {
    const done = () => { this.imgsReady++; if (this.imgsReady >= 2) this.startLoop(); };
    this.mapImg  = new Image(); this.mapImg.onload  = done; this.mapImg.onerror  = done;
    this.charImg = new Image(); this.charImg.onload = done; this.charImg.onerror = done;
    this.mapImg.src  = '/assets/village-map.png';
    this.charImg.src = '/assets/village-character.png';
  }

  private bindKeys(): void {
    this.onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.key);
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter'].includes(e.key))
        e.preventDefault();
      if (e.key === 'Escape') this.ngZone.run(() => this.exitVillage());
      if (e.key === 'Enter' || e.key === ' ') {
        const b = this.nearBuilding();
        if (b) this.ngZone.run(() => this.enterBuilding(b));
      }
    };
    this.onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup',   this.onKeyUp);
  }

  private unbindKeys(): void {
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp)   window.removeEventListener('keyup',   this.onKeyUp);
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    this.ngZone.runOutsideAngular(() => {
      const tick = (t: number) => {
        this.update(t);
        this.render();
        this.loopId = requestAnimationFrame(tick);
      };
      this.loopId = requestAnimationFrame(tick);
    });
  }

  private stopLoop(): void { cancelAnimationFrame(this.loopId); }

  private update(t: number): void {
    const c = this.villageCanvas?.nativeElement;
    if (!c) return;

    const dt = t - this.lastTime;
    this.lastTime = t;
    let dx = 0, dy = 0;

    if (this.keys.has('ArrowLeft')  || this.keys.has('a') || this.keys.has('A')) { dx -= this.SPEED; this.player.dir = 1; }
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) { dx += this.SPEED; this.player.dir = 2; }
    if (this.keys.has('ArrowUp')    || this.keys.has('w') || this.keys.has('W')) { dy -= this.SPEED; this.player.dir = 3; }
    if (this.keys.has('ArrowDown')  || this.keys.has('s') || this.keys.has('S')) { dy += this.SPEED; this.player.dir = 0; }

    const moving = dx !== 0 || dy !== 0;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const m = 18;
    this.player.x = Math.max(m, Math.min(c.width  - m, this.player.x + dx));
    this.player.y = Math.max(m, Math.min(c.height - m, this.player.y + dy));

    if (moving) {
      this.player.frameTimer += dt;
      if (this.player.frameTimer >= this.FRAME_MS) {
        this.player.frame = (this.player.frame + 1) % this.TOTAL_FRAMES;
        this.player.frameTimer = 0;
      }
    } else {
      this.player.frame = 0; // idle = first frame
      this.player.frameTimer = 0;
    }

    // Building proximity
    const s = c.width / 1024;
    let near: VBuilding | null = null;
    for (const b of VILLAGE_BUILDINGS) {
      const cx = (b.x + b.w / 2) * s;
      const cy = (b.y + b.h / 2) * s;
      if (Math.hypot(this.player.x - cx, this.player.y - cy) < 85 * s) { near = b; break; }
    }
    const prev = this.nearBuilding();
    if (prev?.code !== near?.code) this.ngZone.run(() => this.nearBuilding.set(near));
  }

  private render(): void {
    const c = this.villageCanvas?.nativeElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const W = c.width, H = c.height, s = W / 1024;

    // ── Map ──────────────────────────────────────────────────────────────────
    if (this.mapImg.complete && this.mapImg.naturalWidth > 0) {
      ctx.drawImage(this.mapImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.font = `${14*s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Ajoutez /assets/village-map.png', W/2, H/2);
    }

    // ── Buildings highlight ───────────────────────────────────────────────────
    const near = this.nearBuilding();
    for (const b of VILLAGE_BUILDINGS) {
      if (b.code !== near?.code) continue;
      const bx = b.x*s, by = b.y*s, bw = b.w*s, bh = b.h*s;
      const cx = bx + bw/2;

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.5 * s;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;

      // Tooltip ribbon
      const ribH = 32 * s;
      const ribY  = by - ribH - 6 * s;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(cx - 80*s, ribY, 160*s, ribH, 6*s);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${11*s}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(b.label, cx, ribY + ribH * 0.62);

      // "↵ Entrée" hint below ribbon
      ctx.font = `${9.5*s}px Poppins, sans-serif`;
      ctx.fillStyle = '#fde68a';
      ctx.fillText('↵ Entrée pour accéder', cx, ribY - 4*s);
      ctx.restore();
    }

    // ── Player sprite ─────────────────────────────────────────────────────────
    // Character height = 13% of canvas, minimum 80px
    const ph    = Math.max(80, W * 0.13);
    const pw    = ph * 0.67;
    const feetY = this.player.y;

    // Shadow under feet
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.player.x, feetY + 3, pw * 0.50, pw * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this.charImg.complete && this.charImg.naturalWidth > 0) {
      const frameW   = this.charImg.naturalWidth / this.TOTAL_FRAMES;
      const frameH   = this.charImg.naturalHeight;
      const sx       = this.player.frame * frameW;
      // Shift sprite DOWN by 12% so visual feet sit on feetY (most sprites
      // have ~10-15% transparent padding at the bottom of each frame)
      const topY     = feetY - ph * 0.88;
      ctx.drawImage(this.charImg, sx, 0, frameW, frameH, this.player.x - pw/2, topY, pw, ph);
    } else {
      ctx.save();
      ctx.fillStyle = '#92400e';
      ctx.beginPath(); ctx.arc(this.player.x, feetY - ph*0.75, ph*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1AABE2';
      ctx.fillRect(this.player.x - pw*0.35, feetY - ph*0.55, pw*0.7, ph*0.4);
      ctx.fillStyle = '#374151';
      ctx.fillRect(this.player.x - pw*0.3, feetY - ph*0.15, pw*0.25, ph*0.2);
      ctx.fillRect(this.player.x + pw*0.05, feetY - ph*0.15, pw*0.25, ph*0.2);
      ctx.restore();
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    ctx.save();
    const hudTxt = '↑↓←→ / WASD   ·   ↵ Entrer dans un bâtiment   ·   ESC Quitter';
    const hudW   = 340*s, hudH = 24*s;
    const hudX   = W/2 - hudW/2, hudY = H - hudH - 10*s;
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = 'rgba(13,27,42,.85)';
    ctx.beginPath(); ctx.roundRect(hudX, hudY, hudW, hudH, 5*s); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = `${9*s}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(hudTxt, W/2, hudY + hudH*0.67);
    ctx.restore();
  }

  enterBuilding(b: VBuilding): void {
    this.exitVillage();
    this.setFilterPole(b.code);
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadNotes(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.search())     params['search'] = this.search();
    if (this.filterPole() !== 'ALL') params['pole'] = this.filterPole();
    if (this.filterTag())  params['tag']  = this.filterTag();
    if (this.filterMine()) params['mine'] = 'true';

    this.notionService.getAll(params).subscribe({
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
    this.notionService.getTags().subscribe({
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
    this.notionService.getById(noteId).subscribe({
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
    const id = this.editing();
    const req$ = isNew
      ? this.notionService.create(f)
      : this.notionService.update(id!, f);

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
    this.notionService.delete(id).subscribe({
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
