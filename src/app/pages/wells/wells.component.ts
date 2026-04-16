import { Component, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

export interface WellDonor {
  donorName:  string;
  donorEmail: string;
  donorPhone?: string;
  amount:     number;
  percentage: number;
}

export interface Well {
  id:             string;
  code:           string;
  plaque?:        string;
  country?:       string;
  region?:        string;
  zone?:          string;
  campaign?:      string;
  projectStatus:  string;
  rdStatus:       string;
  targetAmount:   number;
  paidAmount:     number;
  remainingAmount:number;
  isInstalment?:  boolean;
  donorFirstName?: string;
  donorLastName?:  string;
  donorEmail?:     string;
  donors?:        WellDonor[];
  trancheId?:     string | null;
  createdAt?:     string;
  _count?:        { media?: number; tickets?: number };
  donorOrder?:    { id: string; wellCount: number; isDispatched: boolean };
}

interface ImportRow {
  [key: string]: any;
  _lineNumber: number;
  _errors: string[];
  _valid: boolean;
}

@Component({
  selector: 'app-wells',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './wells.component.html',
  styleUrl: './wells.component.css',
})
export class WellsComponent implements OnInit {
  private readonly API = '/api';

  @ViewChild('csvInput') csvInput!: ElementRef<HTMLInputElement>;

  wells      = signal<Well[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);
  limit      = signal(50);

  search        = signal('');
  projectStatus = signal('');
  rdStatus      = signal('');
  country       = signal('');

  showCreateModal = signal(false);
  createLoading   = signal(false);
  createError     = signal('');

  form = signal({
    code: '', plaque: '', zone: '', country: '', region: '',
    campaign: '', targetAmount: '370',
    projectStatus: 'PLANIFIE', rdStatus: 'EN_ATTENTE',
    donorFirstName: '', donorLastName: '', donorEmail: '', donorPhone: '',
    paymentMode: '', donationDate: '', notes: '', isInstalment: false,
  });

  /* ── CSV Import state ── */
  showImportModal  = signal(false);
  importStage      = signal<'upload' | 'preview' | 'importing' | 'done'>('upload');
  importRows       = signal<ImportRow[]>([]);
  importFileErrors = signal<string[]>([]);
  importProgress   = signal(0);
  importResults    = signal<{ created: number; errors: { code: string; message: string }[] } | null>(null);
  importFileName   = signal('');
  isDragOver       = false;

  readonly validImportRows   = computed(() => this.importRows().filter(r => r._valid));
  readonly invalidImportRows = computed(() => this.importRows().filter(r => !r._valid));

  readonly projectStatuses = [
    { value: '', label: 'Tous statuts projet' },
    { value: 'PLANIFIE',            label: 'Planifié' },
    { value: 'EN_TRAVAUX',          label: 'En travaux' },
    { value: 'TRANCHE_1_INAUGUREE', label: 'Tranche 1 inaugurée' },
    { value: 'TRANCHE_2_INAUGUREE', label: 'Tranche 2 inaugurée' },
    { value: 'TRANCHE_3_INAUGUREE', label: 'Tranche 3 inaugurée' },
    { value: 'TERMINE',             label: 'Terminé' },
  ];

  readonly rdStatuses = [
    { value: '', label: 'Tous statuts RD' },
    { value: 'EN_ATTENTE',     label: 'En attente' },
    { value: 'MEDIAS_ATTENDUS',label: 'Médias attendus' },
    { value: 'MEDIAS_RECUS',   label: 'Médias reçus' },
    { value: 'PRET_A_LIVRER',  label: 'Prêt à livrer' },
    { value: 'LIVRE',          label: 'Livré' },
    { value: 'ARCHIVE',        label: 'Archivé' },
  ];

  readonly limitOptions = [50, 100, 200, 500];

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.loadWells(); }

  loadWells(): void {
    this.loading.set(true);
    const p: any = { page: this.page(), limit: this.limit() };
    if (this.search())        p.search        = this.search();
    if (this.projectStatus()) p.projectStatus = this.projectStatus();
    if (this.rdStatus())      p.rdStatus      = this.rdStatus();
    if (this.country())       p.country       = this.country();

    this.http.get<any>(`${this.API}/wells`, { params: p }).subscribe({
      next: res => {
        const d = res.data ?? res;
        this.wells.set(d.wells ?? []);
        this.total.set(d.total ?? 0);
        this.totalPages.set(d.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.page.set(1); this.loadWells(); }

  onLimitChange(v: number): void { this.limit.set(v); this.page.set(1); this.loadWells(); }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadWells();
  }

  pages(): number[] {
    const t = this.totalPages(), c = this.page(), r: number[] = [];
    for (let i = Math.max(1, c - 2); i <= Math.min(t, c + 2); i++) r.push(i);
    return r;
  }

  fromIndex(): number { return (this.page() - 1) * this.limit() + 1; }
  toIndex():   number { return Math.min(this.page() * this.limit(), this.total()); }

  /* ── Create modal ── */
  openCreate(): void {
    this.form.set({
      code: '', plaque: '', zone: '', country: '', region: '',
      campaign: '', targetAmount: '370',
      projectStatus: 'PLANIFIE', rdStatus: 'EN_ATTENTE',
      donorFirstName: '', donorLastName: '', donorEmail: '', donorPhone: '',
      paymentMode: '', donationDate: '', notes: '', isInstalment: false,
    });
    this.createError.set('');
    this.showCreateModal.set(true);
  }

  closeCreate(): void { this.showCreateModal.set(false); }

  setZone(z: string): void {
    this.form.update(f => ({ ...f, zone: z }));
  }

  setFormField(key: string, value: any): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  submitCreate(): void {
    if (!this.form().zone) { this.createError.set('Zone requise'); return; }
    this.createLoading.set(true);
    this.createError.set('');
    this.http.post<any>(`${this.API}/wells/create`, this.form()).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.closeCreate();
        this.loadWells();
      },
      error: err => {
        this.createError.set(err.error?.message ?? 'Erreur création');
        this.createLoading.set(false);
      },
    });
  }

  /* ── CSV Import ── */
  openImport(): void {
    this.showImportModal.set(true);
    this.importStage.set('upload');
    this.importRows.set([]);
    this.importFileErrors.set([]);
    this.importProgress.set(0);
    this.importResults.set(null);
    this.importFileName.set('');
    this.isDragOver = false;
  }

  closeImport(): void { this.showImportModal.set(false); }

  triggerFileInput(): void {
    this.csvInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importFileName.set(file.name);
    this.readFile(file);
    // Reset input so same file can be re-selected
    (event.target as HTMLInputElement).value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      this.importFileErrors.set(['Seuls les fichiers .csv sont acceptés.']);
      return;
    }
    this.importFileName.set(file.name);
    this.readFile(file);
  }

  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
  }

  private detectSeparator(firstLine: string): string {
    const commas     = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    return semicolons > commas ? ';' : ',';
  }

  private parseCSV(text: string): void {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      this.importFileErrors.set(['Le fichier CSV est vide ou ne contient pas de données.']);
      return;
    }

    const sep     = this.detectSeparator(lines[0]);
    const headers = this.parseCSVLine(lines[0], sep).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i], sep);
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim(); });

      // Validate required fields
      const rowErrors: string[] = [];
      if (!row['code'])  rowErrors.push('code manquant');
      if (!row['zone'])  rowErrors.push('zone manquante (ASIE ou AFRIQUE)');
      else if (!['ASIE', 'AFRIQUE'].includes(row['zone'].toUpperCase()))
        rowErrors.push('zone invalide (ASIE ou AFRIQUE)');

      rows.push({ ...row, _lineNumber: i + 1, _errors: rowErrors, _valid: rowErrors.length === 0 });
    }

    this.importRows.set(rows);
    this.importFileErrors.set([]);
    this.importStage.set('preview');
  }

  private parseCSVLine(line: string, sep = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === sep && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private rowToWell(r: any): any {
    const g = (keys: string[]): string => {
      for (const k of keys) { const v = r[k]; if (v) return v; }
      return '';
    };
    const targetAmount = parseFloat(g(['targetamount', 'targetAmount', 'montant', 'montantcible'])) || 370;
    const paidAmount   = parseFloat(g(['paidamount', 'paidAmount', 'montantpaye'])) || 0;
    return {
      code:           g(['code']),
      plaque:         g(['plaque']),
      zone:           g(['zone']).toUpperCase(),
      country:        g(['country', 'pays']),
      region:         g(['region', 'région']),
      campaign:       g(['campaign', 'campagne']),
      targetAmount,
      paidAmount,
      remainingAmount: Math.max(0, targetAmount - paidAmount),
      projectStatus:  (g(['projectstatus', 'projectStatus', 'statutprojet']) || 'PLANIFIE').toUpperCase(),
      rdStatus:       (g(['rdstatus', 'rdStatus', 'statutrd']) || 'EN_ATTENTE').toUpperCase(),
      donorFirstName: g(['donorfirstname', 'donorFirstName', 'prenomdonateur', 'prénom']),
      donorLastName:  g(['donorlastname', 'donorLastName', 'nomdonateur', 'nom']),
      donorEmail:     g(['donoremail', 'donorEmail', 'email']),
      donorPhone:     g(['donorphone', 'donorPhone', 'telephone', 'téléphone']),
      paymentMode:    g(['paymentmode', 'paymentMode', 'modepaiement']).toUpperCase() || undefined,
      donationDate:   g(['donationdate', 'donationDate', 'datedon']),
      notes:          g(['notes', 'note']),
      isInstalment:   g(['isinstalment', 'isInstalment', 'mensualisation']) === 'true',
    };
  }

  startImport(): void {
    const rows = this.validImportRows();
    if (!rows.length) return;

    const wells = rows.map(r => this.rowToWell(r));
    this.importStage.set('importing');
    this.importProgress.set(10);

    this.http.post<any>(`${this.API}/wells/bulk-import`, { wells }).subscribe({
      next: (res) => {
        this.importResults.set(res);
        this.importProgress.set(100);
        this.importStage.set('done');
        this.loadWells();
      },
      error: () => {
        // Bulk endpoint not available → import one by one
        this.importOneByOne(wells, 0, { created: 0, errors: [] });
      },
    });
  }

  private importOneByOne(
    wells: any[], idx: number,
    acc: { created: number; errors: { code: string; message: string }[] }
  ): void {
    if (idx >= wells.length) {
      this.importResults.set(acc);
      this.importProgress.set(100);
      this.importStage.set('done');
      this.loadWells();
      return;
    }
    this.importProgress.set(Math.round(10 + (idx / wells.length) * 90));
    this.http.post<any>(`${this.API}/wells/create`, wells[idx]).subscribe({
      next: () => {
        acc.created++;
        this.importOneByOne(wells, idx + 1, acc);
      },
      error: (err) => {
        acc.errors.push({ code: wells[idx].code, message: err.error?.message ?? 'Erreur' });
        this.importOneByOne(wells, idx + 1, acc);
      },
    });
  }

  downloadTemplate(): void {
    const headers  = 'code,plaque,zone,country,region,campaign,targetAmount,projectStatus,rdStatus,donorFirstName,donorLastName,donorEmail,donorPhone,paymentMode,donationDate,notes,isInstalment';
    const example1 = 'DI-2024-001,Au nom de Ahmed,ASIE,Pakistan,Punjab,Ramadan 2024,370,PLANIFIE,EN_ATTENTE,Jean,Dupont,jean.dupont@email.com,+33600000000,VIREMENT,2024-01-15,,false';
    const example2 = 'DI-2024-002,En mémoire de Ali,AFRIQUE,Sénégal,Dakar,,370,PLANIFIE,EN_ATTENTE,Marie,Martin,m.martin@email.com,,CHEQUE,,,false';
    const content  = [headers, example1, example2].join('\n');
    const blob     = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = 'modele_import_puits.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Status helpers ── */
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

  getDonorName(w: Well): string {
    if (w.donors?.[0]?.donorName) return w.donors[0].donorName;
    const name = `${w.donorFirstName ?? ''} ${w.donorLastName ?? ''}`.trim();
    return name || w.donorEmail || '';
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);
  }

  progress(w: Well): number {
    if (!w.targetAmount) return 0;
    return Math.min(Math.round((w.paidAmount / w.targetAmount) * 100), 100);
  }
}
