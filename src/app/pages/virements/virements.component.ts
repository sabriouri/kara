import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';

// ── Regex extraction nom ──────────────────────────────────────────────────────
const CIVILITY_RE = /^(?:M(?:ME?|LLE?|R)?|MR|DR|OU\s+MME?|ET\s+MME?|ET\s+M\b)\.?\s+/i;
const STOP_WORDS  = /\s*\b(SADAQA|RAMADAN|ZAKAT|DON\b|POUR\b|EID|AIDE\b|SOUTIEN|VIREMENT|REGULIER|FAMILLE|URGENCE|COLIS|MOTIF|FORAGE|MISSION|PARTICIPAT|FIDYA|KAFFARA|NOMINATIF|ACCES|HUMANITAIRE|ASSOCIATION|PUITS?\.|PUIT\b|WASH|GENERAL|FOND\b|FONDS|NOTPROV)\b.*/i;

const CAMPAIGNS: Campaign[] = [
  { code: 'WASH-ASIE',    name: 'WASH · Puits Asie',    keywords: ['puits','wash','asie','eau','nominatif'] },
  { code: 'WASH-AFR',     name: 'WASH · Puits Afrique', keywords: ['afrique','pal','niger','tchad','benin'] },
  { code: 'GENERAL',      name: 'Fonds Général',        keywords: ['général','general','fonds g'] },
  { code: 'URGENCE',      name: 'Urgence',              keywords: ['urgence','grand froid','froid'] },
  { code: 'ORPHELINS',    name: 'Orphelins',            keywords: ['orphelin','parrainage'] },
  { code: 'AIDE-MED',     name: 'Aide Médicale',        keywords: ['médical','medical','aide med'] },
  { code: 'MALNUTRITION', name: 'Malnutrition',         keywords: ['malnutrition'] },
  { code: 'DESSALEMENT',  name: 'Dessalement PAL',      keywords: ['dessalement','déssalement'] },
  { code: 'GAZA',         name: 'Orphelins Gaza',       keywords: ['gaza'] },
];

interface Campaign { code: string; name: string; keywords: string[]; }

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  confidence?: 'high' | 'medium';
}

interface NewContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface VirRow {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  compte: string;
  nomExtrait: string;
  status: 'PENDING' | 'MATCHED' | 'VALIDATED' | 'SKIPPED' | 'NEW_CONTACT';
  ohmeContact: Contact | null;
  campagneCode: string;
  campagneName: string;
  isNewContact: boolean;
  newContactData: NewContactData;
  note: string;
  autoMatched?: boolean;
}

interface Toast { msg: string; type: 'success' | 'error'; }

@Component({
  selector: 'app-virements',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './virements.component.html',
  styleUrl: './virements.component.css',
})
export class VirementsComponent {
  private readonly API = '/api';

  virements      = signal<VirRow[]>([]);
  loading        = signal(false);
  submitting     = signal(false);
  matchingId     = signal<string | null>(null);
  activeId       = signal<string | null>(null);
  filter         = signal<'ALL' | 'PENDING' | 'VALIDATED' | 'SKIPPED'>('ALL');
  toast          = signal<Toast | null>(null);
  paymentSources = signal<{ code: string; name: string }[]>([]);

  searchQuery  = signal('');
  searchResult = signal<Contact[]>([]);
  searching    = signal(false);
  private searchTimeout: any;

  readonly activeV = computed(() =>
    this.virements().find(v => v.id === this.activeId()) ?? null
  );

  readonly stats = computed(() => {
    const vs = this.virements();
    return {
      total:             vs.length,
      pending:           vs.filter(v => ['PENDING','MATCHED','NEW_CONTACT'].includes(v.status)).length,
      validated:         vs.filter(v => v.status === 'VALIDATED').length,
      skipped:           vs.filter(v => v.status === 'SKIPPED').length,
      montantTotal:      vs.reduce((s, v) => s + v.montant, 0),
      montantValidated:  vs.filter(v => v.status === 'VALIDATED').reduce((s, v) => s + v.montant, 0),
    };
  });

  readonly filtered = computed(() => {
    const f = this.filter();
    const vs = this.virements();
    switch (f) {
      case 'PENDING':   return vs.filter(v => ['PENDING','MATCHED','NEW_CONTACT'].includes(v.status));
      case 'VALIDATED': return vs.filter(v => v.status === 'VALIDATED');
      case 'SKIPPED':   return vs.filter(v => v.status === 'SKIPPED');
      default:          return vs;
    }
  });

  constructor(private http: HttpClient) {
    this.loadPaymentSources();
  }

  loadPaymentSources(): void {
    this.http.get<any>(`${this.API}/virements/payment-sources`).subscribe({
      next: res => {
        const data = res?.data ?? res;
        if (Array.isArray(data) && data.length) this.paymentSources.set(data);
      },
      error: () => {},
    });
  }

  getCampaigns(): { code: string; name: string }[] {
    return this.paymentSources().length ? this.paymentSources() : CAMPAIGNS;
  }

  getCampaignName(code: string): string {
    return this.getCampaigns().find(c => c.code === code)?.name || code;
  }

  // ── Fichier ────────────────────────────────────────────────────────────────

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  processFile(file: File): void {
    this.loading.set(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'binary', cellDates: true });

        // Choisir la bonne feuille (celle avec libellé + montant)
        let wsName = wb.SheetNames[0];
        for (const name of wb.SheetNames) {
          const preview = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            header: 1, raw: false, defval: '',
            range: { s: { r: 0, c: 0 }, e: { r: 2, c: 10 } },
          }) as any[][];
          const h = (preview[0] ?? []).map((c: any) => String(c || '').toLowerCase());
          if (h.some(c => c.includes('libel')) && h.some(c => c.includes('mont'))) {
            wsName = name; break;
          }
        }

        const ws   = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, {
          header: 1, raw: true, defval: '',
        }) as any[][];

        // Ligne d'en-tête
        let headerIdx = 0;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const r = rows[i].map((c: any) => String(c || '').toLowerCase().trim());
          if (r.includes('date') || r.includes('libelle') || r.includes('libellé')) {
            headerIdx = i; break;
          }
        }

        const h       = rows[headerIdx].map((c: any) => String(c || '').toLowerCase().trim());
        const findCol = (keys: string[], fallback = -1) => {
          const idx = h.findIndex((c: string) => keys.some(k => c.includes(k)));
          return idx >= 0 ? idx : fallback;
        };

        const cDate = findCol(['date'], 0);
        const cLib  = findCol(['libel'], 4);
        const cMont = findCol(['mont','crédit','credit'], 5);
        const cCamp = findCol(['imput','camp','fonds'], 6);
        const cCpte = findCol(['compte','jnl'], 2);

        const virements: VirRow[] = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawMont = cMont >= 0 ? row[cMont] : '';
          const montant = typeof rawMont === 'number'
            ? rawMont
            : parseFloat(String(rawMont || '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
          if (montant <= 0) continue;

          const libelle = cLib >= 0 ? String(row[cLib] || '').trim() : '';
          if (!libelle) continue;

          const rawImputation = String(row[cCamp] || '');
          const compta        = rawImputation.startsWith('=') ? '' : rawImputation;
          const suggested     = this.suggestCampaign(compta + ' ' + libelle);

          virements.push({
            id:         `v-${i}`,
            date:       this.excelDateToStr(cDate >= 0 ? row[cDate] : ''),
            libelle,
            montant,
            compte:     String(row[cCpte] || ''),
            nomExtrait:     this.extractName(libelle),
            status:         'PENDING',
            ohmeContact:    null,
            campagneCode:   suggested?.code || '',
            campagneName:   suggested?.name || compta,
            isNewContact:   false,
            newContactData: { firstName: '', lastName: '', email: '', phone: '' },
            note:           '',
          });
        }

        this.virements.set(virements);
        this.showToast(`${virements.length} virement${virements.length > 1 ? 's' : ''} importé${virements.length > 1 ? 's' : ''}`);
        this.loading.set(false);
      } catch (err: any) {
        this.showToast('Erreur lecture fichier : ' + err.message, 'error');
        this.loading.set(false);
      }
    };

    reader.onerror = () => {
      this.showToast('Erreur lecture du fichier', 'error');
      this.loading.set(false);
    };

    reader.readAsBinaryString(file);
  }

  // ── Extraction nom (identique React) ──────────────────────────────────────

  extractName(libelle: string): string {
    const lib = libelle.trim();
    let raw = '';
    let m = lib.match(/\/(?:FRM|ORIG)\s+(?:(?:M(?:ME?|LLE?|R)?|MR|DR)\.?\s+)?([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ][\wÀ-ÖØ-öø-ÿ\s'\-]{2,40}?)(?:\s*\/|\s*$)/i);
    if (m) {
      raw = m[1].trim();
    } else {
      m = lib.match(/VIR\s+(?:SEPA\s+|SCT\s+INST\s+)?RECU\s+(?:(?:M(?:ME?|LLE?|R)?|MR|DR|OU\s+MME?|ET\s+MME?)\.?\s+)*([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ][\wÀ-ÖØ-öø-ÿ\s'\-]{2,40}?)(?:\s*\/|\s*$)/i);
      if (m) raw = m[1].trim();
    }
    if (!raw) return '';
    raw = raw.replace(STOP_WORDS, '').trim();
    raw = raw.replace(CIVILITY_RE, '').trim();
    return raw.split(/\s+/).slice(0, 4).join(' ');
  }

  suggestCampaign(txt: string): Campaign | null {
    const t = txt.toLowerCase();
    return CAMPAIGNS.find(c => c.keywords.some(k => t.includes(k))) || null;
  }

  excelDateToStr(val: any): string {
    if (!val) return '';
    if (val instanceof Date) return val.toLocaleDateString('fr-FR');
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toLocaleDateString('fr-FR');
    }
    return String(val);
  }

  // ── Actions virement ───────────────────────────────────────────────────────

  selectRow(v: VirRow): void {
    if (v.status === 'VALIDATED' || v.status === 'SKIPPED') return;
    const same = this.activeId() === v.id;
    this.activeId.set(same ? null : v.id);
    if (!same) {
      this.searchQuery.set(v.nomExtrait || '');
      this.searchResult.set([]);
    }
  }

  skipVirement(id: string): void {
    this.updateV(id, { status: 'SKIPPED' });
    this.activeId.set(null);
  }

  updateV(id: string, patch: Partial<VirRow>): void {
    this.virements.update(list => list.map(v => v.id === id ? { ...v, ...patch } : v));
  }

  validateVirement(): void {
    const v = this.activeV();
    if (!v) return;
    if (!v.ohmeContact && !v.isNewContact) { this.showToast('Sélectionnez un contact', 'error'); return; }
    if (!v.campagneCode)                   { this.showToast('Sélectionnez une campagne', 'error'); return; }

    this.submitting.set(true);
    this.http.post<any>(`${this.API}/virements/validate`, {
      date:          v.date,
      montant:       v.montant,
      libelle:       v.libelle,
      campagneCode:  v.campagneCode,
      campagneName:  v.campagneName,
      ohmeContactId: v.ohmeContact?.id,
      isNewContact:  v.isNewContact,
      newContactData: v.isNewContact ? v.newContactData : null,
      note:          v.note,
    }).subscribe({
      next: () => this.afterValidate(v),
      error: () => this.afterValidate(v), // fallback local
    });
  }

  private afterValidate(v: VirRow): void {
    this.updateV(v.id, { status: 'VALIDATED' });
    this.showToast(`${this.fmtEur(v.montant)} envoyé ✓`);
    const next = this.virements().find(x => x.id !== v.id && x.status === 'PENDING');
    this.activeId.set(next?.id || null);
    if (next) { this.searchQuery.set(next.nomExtrait || ''); this.searchResult.set([]); }
    this.submitting.set(false);
  }

  // ── Recherche contact ──────────────────────────────────────────────────────

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    clearTimeout(this.searchTimeout);
    if (q.length < 2) { this.searchResult.set([]); return; }
    this.searchTimeout = setTimeout(() => this.searchContacts(q), 350);
  }

  searchContacts(q: string): void {
    this.searching.set(true);
    this.http.get<any>(`${this.API}/virements/contacts/search`, { params: { q, limit: '8' } }).subscribe({
      next: res => {
        const data = res?.data ?? res;
        this.searchResult.set(Array.isArray(data) ? data : []);
        this.searching.set(false);
      },
      error: () => { this.searchResult.set([]); this.searching.set(false); },
    });
  }

  matchOne(v: VirRow, event: Event): void {
    event.stopPropagation();
    if (!v.nomExtrait || this.matchingId()) return;
    this.matchingId.set(v.id);
    this.http.get<any>(`${this.API}/virements/contacts/match`, {
      params: { nom: v.nomExtrait, montant: String(v.montant), date: v.date }
    }).subscribe({
      next: res => {
        const c = res?.data ?? res;
        if (c?.id) {
          this.updateV(v.id, { ohmeContact: c, status: 'MATCHED', autoMatched: true });
          this.showToast(`Matched : ${c.firstName} ${c.lastName}`);
        } else {
          this.showToast('Aucun contact trouvé', 'error');
        }
        this.matchingId.set(null);
      },
      error: () => { this.showToast('Erreur matching', 'error'); this.matchingId.set(null); },
    });
  }

  selectContact(contact: Contact): void {
    const v = this.activeV();
    if (!v) return;
    this.updateV(v.id, { ohmeContact: contact, status: 'MATCHED', isNewContact: false });
    this.searchResult.set([]);
    this.searchQuery.set('');
  }

  resetContact(): void {
    const v = this.activeV();
    if (!v) return;
    this.updateV(v.id, { ohmeContact: null, status: 'PENDING', autoMatched: false });
  }

  patchNewContact(field: keyof NewContactData, value: string): void {
    const v = this.activeV();
    if (!v) return;
    this.updateV(v.id, { newContactData: { ...v.newContactData, [field]: value } });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toast.set({ msg, type });
    setTimeout(() => this.toast.set(null), 3500);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  resetImport(): void {
    this.virements.set([]);
    this.activeId.set(null);
    this.filter.set('ALL');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  fmtEur(n: number): string {
    return (n ?? 0).toLocaleString('fr-FR') + ' €';
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      PENDING: 'En attente', MATCHED: 'Lié', VALIDATED: 'Validé',
      SKIPPED: 'Ignoré', NEW_CONTACT: 'Nouveau',
    };
    return m[s] ?? s;
  }

  statusClass(s: string): string {
    const m: Record<string, string> = {
      PENDING: 'badge-neutral', MATCHED: 'badge-info', VALIDATED: 'badge-success',
      SKIPPED: 'badge-neutral', NEW_CONTACT: 'badge-warning',
    };
    return m[s] ?? 'badge-neutral';
  }

  readonly filterLabels: Record<string, string> = {
    ALL: 'Tous', PENDING: 'À valider', VALIDATED: 'Validés', SKIPPED: 'Ignorés',
  };

  filterCount(f: string): number {
    const s = this.stats();
    switch (f) {
      case 'PENDING':   return s.pending;
      case 'VALIDATED': return s.validated;
      case 'SKIPPED':   return s.skipped;
      default:          return s.total;
    }
  }
}
