import {
  Component, signal, computed, OnInit, OnDestroy, ViewChild,
  ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Channel  = 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'SMS';
export type ConvStatus = 'NEW' | 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'SYSTEM';

export interface Message {
  id: string;
  htmlContent?: string;
  content?: string;
  body?: string;
  subject?: string;
  channel?: Channel;
  direction: 'INBOUND' | 'OUTBOUND';
  sentAt: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  status?: string;
  user?: { firstName: string; lastName: string; email: string; role?: { name: string } };
  template?: { id: string; title: string };
}

export interface DonorInfo {
  id?: string;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  city?: string;
  country?: string;
  wells?: { id: string; wellName?: string; country?: string; year?: number; status?: string }[];
}

export interface OhmeMatch {
  id: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  civility?: string;
}

export interface Conversation {
  id: string;
  subject?: string;
  channel: Channel;
  status: ConvStatus;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  messages?: Message[];
  donor?: DonorInfo | null;
  tags?: string[];
  ohmeMatch?: OhmeMatch | null;
  ohmeLinked?: boolean;
  contactHistory?: Conversation[];
}

export interface ConvStats {
  total: number;
  unread: number;
  open: number;
  resolved: number;
}

export interface EmailTemplate {
  id: string;
  title: string;
  subject?: string;
  body?: string;
  content?: string;
}

export interface DonorSearchResult {
  id: string;
  donorName?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  donorEmail?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const CHANNEL_META: Record<Channel, { icon: string; label: string; color: string; bg: string }> = {
  EMAIL:     { icon: 'mail',       label: 'Email',     color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  WHATSAPP:  { icon: 'message-circle', label: 'WhatsApp',  color: '#22C55E', bg: 'rgba(34,197,94,0.08)'  },
  INSTAGRAM: { icon: 'camera',     label: 'Instagram', color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
  SMS:       { icon: 'smartphone', label: 'SMS',       color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
};

export const STATUS_META: Record<ConvStatus, { label: string; color: string }> = {
  NEW:      { label: 'Nouveau',     color: '#3B82F6' },
  OPEN:     { label: 'Ouvert',      color: '#F59E0B' },
  PENDING:  { label: 'En attente',  color: '#8B5CF6' },
  RESOLVED: { label: 'Résolu',      color: '#22C55E' },
  CLOSED:   { label: 'Fermé',       color: '#6B7280' },
  SYSTEM:   { label: 'Automatique', color: '#607D8B' },
};

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.css',
})
export class InboxComponent implements OnInit, AfterViewChecked {
  private readonly API = '/api';

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('replyEditor') replyEditor!: ElementRef<HTMLDivElement>;

  // ── List state ──
  conversations   = signal<Conversation[]>([]);
  stats           = signal<ConvStats>({ total: 0, unread: 0, open: 0, resolved: 0 });
  loading         = signal(true);
  syncing         = signal(false);
  filterStatus    = signal('');
  filterChannel   = signal('');

  // ── Detail state ──
  selected        = signal<Conversation | null>(null);
  detailLoading   = signal(false);
  messages        = signal<Message[]>([]);
  templates       = signal<EmailTemplate[]>([]);
  showPanel       = signal(true);

  // ── Compose state ──
  replySubject    = signal('');
  replyHtml       = signal('');
  sending         = signal(false);
  showTemplates   = signal(false);

  // ── Donor panel state ──
  donorMode       = signal<'view' | 'link' | 'create'>('view');
  donorSearch     = signal('');
  donorResults    = signal<DonorSearchResult[]>([]);
  donorSearching  = signal(false);
  newDonorForm    = signal({ firstName: '', lastName: '', email: '', phone: '', city: '' });

  // ── History ──
  historyConv     = signal<Conversation | null>(null);
  historyMessages = signal<Message[]>([]);
  historyLoading  = signal(false);

  private shouldScrollToBottom = false;

  filtered = computed(() => {
    let list = this.conversations();
    const s = this.filterStatus();
    const c = this.filterChannel();
    if (s) list = list.filter(c => c.status === s);
    if (c) list = list.filter(conv => conv.channel === c);
    return list;
  });

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadConversations();
    this.loadStats();
    this.loadTemplates();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try { this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }); } catch {}
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  loadConversations(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.filterStatus())  params['status']  = this.filterStatus();
    if (this.filterChannel()) params['channel'] = this.filterChannel();

    this.http.get<any>(`${this.API}/conversations`, { params }).subscribe({
      next: res => {
        this.conversations.set(res?.data?.conversations ?? res?.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadStats(): void {
    this.http.get<any>(`${this.API}/conversations/stats/summary`).subscribe({
      next: res => this.stats.set(res?.data ?? {}),
      error: () => {},
    });
  }

  loadTemplates(): void {
    this.http.get<any>(`${this.API}/email-templates`).subscribe({
      next: res => {
        const raw = res?.data?.templates ?? res?.data ?? res ?? [];
        this.templates.set(Array.isArray(raw) ? raw : []);
      },
      error: () => {},
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.http.post<any>(`${this.API}/conversations/sync`, {}).subscribe({
      next: () => { this.syncing.set(false); this.loadConversations(); this.loadStats(); },
      error: () => this.syncing.set(false),
    });
  }

  applyFilters(): void {
    this.loadConversations();
  }

  selectConversation(conv: Conversation): void {
    this.selected.set(conv);
    this.historyConv.set(null);
    this.historyMessages.set([]);
    this.donorMode.set('view');
    this.donorSearch.set('');
    this.donorResults.set([]);
    this.showTemplates.set(false);
    this.replySubject.set(`Re: ${conv.subject ?? ''}`);
    this.replyHtml.set('');
    this.detailLoading.set(true);

    this.http.get<any>(`${this.API}/conversations/${conv.id}`).subscribe({
      next: res => {
        const data: Conversation = res?.data ?? res;
        this.selected.set(data);
        const sorted = [...(data.messages ?? [])].sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
        );
        this.messages.set(sorted);
        this.detailLoading.set(false);
        this.shouldScrollToBottom = true;
        // Mark as read locally
        this.conversations.update(list =>
          list.map(c => c.id === data.id ? { ...c, unreadCount: 0 } : c)
        );
      },
      error: () => this.detailLoading.set(false),
    });
  }

  updateStatus(status: ConvStatus): void {
    const conv = this.selected();
    if (!conv) return;
    this.http.put<any>(`${this.API}/conversations/${conv.id}/status`, { status }).subscribe({
      next: () => {
        this.selected.update(c => c ? { ...c, status } : c);
        this.conversations.update(list =>
          list.map(c => c.id === conv.id ? { ...c, status } : c)
        );
      },
      error: () => {},
    });
  }

  sendReply(): void {
    const conv = this.selected();
    const html = this.replyHtml();
    if (!conv || !html.replace(/<[^>]*>/g, '').trim() || this.sending()) return;

    this.sending.set(true);
    const isEmail = conv.channel === 'EMAIL';
    const payload: any = {
      body: html,
      channel: conv.channel,
    };
    if (isEmail) payload['subject'] = this.replySubject();

    this.http.post<any>(`${this.API}/conversations/${conv.id}/reply`, payload).subscribe({
      next: res => {
        if (res?.success || res?.data) {
          this.messages.update(list => [...list, {
            id: res?.data?.messageId ?? String(Date.now()),
            htmlContent: html,
            subject: isEmail ? this.replySubject() : undefined,
            channel: conv.channel,
            direction: 'OUTBOUND',
            sentAt: new Date().toISOString(),
            status: 'SENT',
          }]);
          this.replyHtml.set('');
          if (this.replyEditor) this.replyEditor.nativeElement.innerHTML = '';
          this.shouldScrollToBottom = true;
          this.loadStats();
        }
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
  }

  applyTemplate(tpl: EmailTemplate): void {
    const conv = this.selected();
    let body = (tpl.body || tpl.content || '');
    body = body.replace(/\{donateur\}/gi, conv?.donor?.donorName || conv?.contactName || '');
    this.replyHtml.set(body);
    if (this.replyEditor) this.replyEditor.nativeElement.innerHTML = body;
    if (conv?.channel === 'EMAIL' && tpl.subject) this.replySubject.set(tpl.subject);
    this.showTemplates.set(false);
  }

  onEditorInput(event: Event): void {
    this.replyHtml.set((event.target as HTMLElement).innerHTML);
  }

  execCmd(cmd: string): void {
    if (cmd === 'createLink') {
      const url = window.prompt('URL du lien :');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, undefined);
    }
    this.replyEditor?.nativeElement.focus();
    this.replyHtml.set(this.replyEditor?.nativeElement.innerHTML ?? '');
  }

  // ── Donor actions ──────────────────────────────────────────────────────────

  linkDonor(ohmeId: string): void {
    const conv = this.selected();
    if (!conv) return;
    this.http.post<any>(`${this.API}/conversations/${conv.id}/link-donor`, { ohmeId }).subscribe({
      next: () => { this.donorMode.set('view'); this.selectConversation(conv); },
      error: () => {},
    });
  }

  createOhmeDonor(): void {
    const conv = this.selected();
    if (!conv) return;
    this.http.post<any>(`${this.API}/conversations/${conv.id}/create-donor`, this.newDonorForm()).subscribe({
      next: () => { this.donorMode.set('view'); this.selectConversation(conv); },
      error: () => {},
    });
  }

  searchDonors(): void {
    const q = this.donorSearch().trim();
    if (!q) return;
    this.donorSearching.set(true);
    this.http.get<any>(`${this.API}/conversations/donors/search`, { params: { q } }).subscribe({
      next: res => { this.donorResults.set(res?.data ?? []); this.donorSearching.set(false); },
      error: () => this.donorSearching.set(false),
    });
  }

  openHistoryConv(conv: Conversation): void {
    this.historyConv.set(conv);
    this.historyLoading.set(true);
    this.historyMessages.set([]);
    this.http.get<any>(`${this.API}/conversations/${conv.id}`).subscribe({
      next: res => {
        const data: Conversation = res?.data ?? res;
        this.historyConv.set(data);
        this.historyMessages.set(
          [...(data.messages ?? [])].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
          )
        );
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  closeHistory(): void {
    this.historyConv.set(null);
    this.historyMessages.set([]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  channelMeta(ch: Channel) {
    return CHANNEL_META[ch] ?? CHANNEL_META.EMAIL;
  }

  statusMeta(st: ConvStatus) {
    return STATUS_META[st] ?? STATUS_META.NEW;
  }

  contactLabel(conv: Conversation): string {
    return conv.contactName || conv.contactEmail || conv.contactPhone || 'Inconnu';
  }

  msgRaw(msg: Message): string {
    return msg.htmlContent || msg.content || msg.body || '';
  }

  sanitize(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  msgInitials(msg: Message): string {
    if (msg.direction === 'OUTBOUND') {
      if (msg.user) return `${msg.user.firstName?.[0] ?? ''}${msg.user.lastName?.[0] ?? ''}`;
      return 'K';
    }
    const name = msg.senderName || msg.senderEmail || msg.senderPhone || '?';
    return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  msgSenderLabel(msg: Message): string {
    if (msg.direction === 'OUTBOUND') {
      return msg.user ? `${msg.user.firstName} ${msg.user.lastName}` : 'Équipe KARA';
    }
    return msg.senderName || msg.senderEmail || msg.senderPhone || 'Inconnu';
  }

  relativeTime(d?: string): string {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60)     return `${diff}s`;
    if (diff < 3600)   return `${Math.floor(diff / 60)}min`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(d));
  }

  fullDate(d?: string): string {
    if (!d) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(d));
  }

  donorDisplayName(conv: Conversation): string {
    const d = conv.donor;
    const m = conv.ohmeMatch;
    return d?.donorName
      || (m ? `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim() : '')
      || conv.contactName
      || conv.contactEmail
      || 'Contact inconnu';
  }

  donorInitial(conv: Conversation): string {
    return (this.donorDisplayName(conv)[0] ?? '?').toUpperCase();
  }

  uniqueAgents(msgs: Message[]): Message[] {
    const map = new Map<string, Message>();
    msgs.filter(m => m.direction === 'OUTBOUND' && m.user).forEach(m => {
      if (m.user && !map.has(m.user.email)) map.set(m.user.email, m);
    });
    return Array.from(map.values());
  }

  updateNewDonorField(field: string, value: string): void {
    this.newDonorForm.update(f => ({ ...f, [field]: value }));
  }

  readonly convStatuses: ConvStatus[] = ['NEW', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];

  readonly channelOptions = [
    { value: '',          label: 'Tous les canaux' },
    { value: 'EMAIL',     label: 'Email'           },
    { value: 'WHATSAPP',  label: 'WhatsApp'        },
    { value: 'INSTAGRAM', label: 'Instagram'       },
    { value: 'SMS',       label: 'SMS'             },
  ];

  readonly statusOptions = [
    { value: '',         label: 'Tous les statuts' },
    { value: 'NEW',      label: 'Nouveau'          },
    { value: 'OPEN',     label: 'Ouvert'           },
    { value: 'PENDING',  label: 'En attente'       },
    { value: 'RESOLVED', label: 'Résolu'           },
    { value: 'CLOSED',   label: 'Archivées'        },
    { value: 'SYSTEM',   label: 'Automatiques'     },
  ];

  readonly nextStatuses: { value: ConvStatus; label: string; color: string }[] = [
    { value: 'OPEN',     label: 'Ouvrir',    color: '#F59E0B' },
    { value: 'PENDING',  label: 'Attente',   color: '#8B5CF6' },
    { value: 'RESOLVED', label: 'Résoudre',  color: '#22C55E' },
    { value: 'CLOSED',   label: 'Fermer',    color: '#6B7280' },
  ];
}
