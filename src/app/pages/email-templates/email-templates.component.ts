import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EmailTemplateService } from '../../core/services/email-template.service';

type TemplateCategory = 'PUITS' | 'DONATEUR' | 'RECLAMATION' | 'GENERAL' | 'REMERCIEMENT' | 'RELANCE';

interface EmailTemplate {
  id: string;
  title: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  variables: string[];
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateForm {
  title: string;
  subject: string;
  body: string;
  category: TemplateCategory | '';
  variables: string;
  tags: string;
}

const MOCK_TEMPLATES: EmailTemplate[] = [
  { id: '1', title: 'Confirmation de don', subject: 'Merci pour votre don, {{prenom}}', body: 'Cher(e) {{prenom}},\n\nNous avons bien reçu votre don de {{montant}} €. Votre générosité contribue directement à la réalisation de puits en Afrique.\n\nCordialement,\nL\'équipe KARA', category: 'DONATEUR', variables: ['prenom', 'montant', 'date'], tags: ['don', 'confirmation'], usageCount: 42, createdAt: '2024-01-10', updatedAt: '2024-03-01' },
  { id: '2', title: 'Inauguration du puits', subject: 'Votre puits {{code_puits}} est inauguré !', body: 'Cher(e) {{prenom}},\n\nNous avons le plaisir de vous informer que votre puits {{code_puits}} situé à {{village}}, {{pays}} a été inauguré le {{date_inauguration}}.\n\nMerci pour votre soutien.', category: 'PUITS', variables: ['prenom', 'code_puits', 'village', 'pays', 'date_inauguration'], tags: ['puits', 'inauguration'], usageCount: 18, createdAt: '2024-01-15', updatedAt: '2024-02-20' },
  { id: '3', title: 'Rappel de paiement', subject: 'Rappel : votre versement mensuel', body: 'Cher(e) {{prenom}},\n\nNous vous rappelons que votre versement mensuel de {{montant}} € est attendu pour le {{date_echeance}}.\n\nCordialement.', category: 'RELANCE', variables: ['prenom', 'montant', 'date_echeance'], tags: ['rappel', 'paiement'], usageCount: 67, createdAt: '2024-02-01', updatedAt: '2024-03-10' },
  { id: '4', title: 'Réclamation traitée', subject: 'Votre réclamation #{{ref}} a été traitée', body: 'Cher(e) {{prenom}},\n\nVotre réclamation référencée {{ref}} a bien été traitée par notre équipe.\n\nNous vous prions de nous excuser pour la gêne occasionnée.', category: 'RECLAMATION', variables: ['prenom', 'ref'], tags: ['reclamation'], usageCount: 5, createdAt: '2024-02-14', updatedAt: '2024-02-14' },
  { id: '5', title: 'Bienvenue nouveau donateur', subject: 'Bienvenue dans la famille KARA, {{prenom}}', body: 'Cher(e) {{prenom}},\n\nBienvenue ! Nous sommes ravis de vous accueillir parmi nos donateurs. Votre compte a été créé avec succès.\n\nBonne continuation.', category: 'GENERAL', variables: ['prenom', 'email'], tags: ['bienvenue', 'inscription'], usageCount: 29, createdAt: '2024-03-01', updatedAt: '2024-03-01' },
  { id: '6', title: 'Remerciement fin d\'année', subject: 'Merci pour votre soutien tout au long de {{annee}}', body: 'Cher(e) {{prenom}},\n\nÀ l\'approche de la fin d\'année {{annee}}, nous tenons à vous remercier chaleureusement pour votre soutien continu.\n\nGrâce à vous, {{nombre_puits}} puits ont été construits cette année.', category: 'REMERCIEMENT', variables: ['prenom', 'annee', 'nombre_puits'], tags: ['remerciement', 'fin-annee'], usageCount: 12, createdAt: '2024-03-05', updatedAt: '2024-03-05' },
];

@Component({
  selector: 'app-email-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './email-templates.component.html',
  styleUrl: './email-templates.component.css',
})
export class EmailTemplatesComponent implements OnInit {
  templates     = signal<EmailTemplate[]>(MOCK_TEMPLATES);
  loading       = signal(false);
  searchQuery   = signal('');
  categoryFilter = signal('');

  showCreateModal  = signal(false);
  showEditModal    = signal(false);
  showPreviewModal = signal(false);
  showDeleteConfirm = signal(false);

  selectedTemplate = signal<EmailTemplate | null>(null);
  saving = signal(false);

  form: TemplateForm = { title: '', subject: '', body: '', category: '', variables: '', tags: '' };

  readonly categories: TemplateCategory[] = ['PUITS', 'DONATEUR', 'RECLAMATION', 'GENERAL', 'REMERCIEMENT', 'RELANCE'];

  readonly categoryMeta: Record<TemplateCategory, { label: string; color: string }> = {
    PUITS:        { label: 'Puits',        color: '#1AABE2' },
    DONATEUR:     { label: 'Donateur',     color: '#52AE4F' },
    RECLAMATION:  { label: 'Réclamation',  color: '#EF4444' },
    GENERAL:      { label: 'Général',      color: '#94A3B8' },
    REMERCIEMENT: { label: 'Remerciement', color: '#8B5CF6' },
    RELANCE:      { label: 'Relance',      color: '#F59E0B' },
  };

  readonly filtered = computed(() => {
    let list = this.templates();
    const q = this.searchQuery().toLowerCase();
    const c = this.categoryFilter();
    if (q) list = list.filter(t => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q));
    if (c) list = list.filter(t => t.category === c);
    return list;
  });

  readonly stats = computed(() => {
    const all = this.templates();
    return this.categories.map(cat => ({
      category: cat,
      count: all.filter(t => t.category === cat).length,
    }));
  });

  constructor(private emailTemplateService: EmailTemplateService) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);

    this.emailTemplateService.getAll().subscribe({
      next: res => {
        this.templates.set(res.data?.templates ?? []);
        this.loading.set(false);
      },
      error: () => {
        // keep mock data on error
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.form = { title: '', subject: '', body: '', category: '', variables: '', tags: '' };
    this.showCreateModal.set(true);
  }

  openEdit(t: EmailTemplate): void {
    this.selectedTemplate.set(t);
    this.form = {
      title:     t.title,
      subject:   t.subject,
      body:      t.body,
      category:  t.category,
      variables: t.variables.join(', '),
      tags:      t.tags.join(', '),
    };
    this.showEditModal.set(true);
  }

  previewTemplate = signal<EmailTemplate | null>(null);
  copiedId = signal<string | null>(null);

  openPreview(t: EmailTemplate): void {
    this.previewTemplate.set(t);
    this.showPreviewModal.set(true);
  }

  copyTemplate(t: EmailTemplate): void {
    const text = `Objet : ${t.subject}\n\n${t.body}`;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedId.set(t.id);
      setTimeout(() => this.copiedId.set(null), 2000);
    });
  }

  openDelete(t: EmailTemplate): void {
    this.selectedTemplate.set(t);
    this.showDeleteConfirm.set(true);
  }

  closeModals(): void {
    this.showCreateModal.set(false);
    this.showEditModal.set(false);
    this.showPreviewModal.set(false);
    this.showDeleteConfirm.set(false);
    this.selectedTemplate.set(null);
    this.previewTemplate.set(null);
  }

  saveCreate(): void {
    if (!this.form.title || !this.form.subject || !this.form.body || !this.form.category) return;
    this.saving.set(true);

    const payload = {
      title:     this.form.title,
      subject:   this.form.subject,
      body:      this.form.body,
      category:  this.form.category,
      variables: this.form.variables.split(',').map(s => s.trim()).filter(Boolean),
      tags:      this.form.tags.split(',').map(s => s.trim()).filter(Boolean),
    };

    this.emailTemplateService.create(payload).subscribe({
      next: res => {
        if (res.data) {
          this.templates.update(list => [res.data, ...list]);
        } else {
          const newT: EmailTemplate = { id: Date.now().toString(), ...payload, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as EmailTemplate;
          this.templates.update(list => [newT, ...list]);
        }
        this.saving.set(false);
        this.closeModals();
      },
      error: () => {
        const newT: EmailTemplate = { id: Date.now().toString(), ...payload, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as EmailTemplate;
        this.templates.update(list => [newT, ...list]);
        this.saving.set(false);
        this.closeModals();
      },
    });
  }

  saveEdit(): void {
    const t = this.selectedTemplate();
    if (!t) return;
    this.saving.set(true);

    const payload = {
      title:     this.form.title,
      subject:   this.form.subject,
      body:      this.form.body,
      category:  this.form.category as TemplateCategory,
      variables: this.form.variables.split(',').map(s => s.trim()).filter(Boolean),
      tags:      this.form.tags.split(',').map(s => s.trim()).filter(Boolean),
    };

    this.emailTemplateService.update(t.id, payload).subscribe({
      next: () => {
        this.templates.update(list => list.map(item => item.id === t.id ? { ...item, ...payload, updatedAt: new Date().toISOString() } : item));
        this.saving.set(false);
        this.closeModals();
      },
      error: () => {
        this.templates.update(list => list.map(item => item.id === t.id ? { ...item, ...payload, updatedAt: new Date().toISOString() } : item));
        this.saving.set(false);
        this.closeModals();
      },
    });
  }

  confirmDelete(): void {
    const t = this.selectedTemplate();
    if (!t) return;

    this.emailTemplateService.delete(t.id).subscribe({
      next: () => {},
      error: () => {},
    });

    this.templates.update(list => list.filter(item => item.id !== t.id));
    this.closeModals();
  }

  wrapVar(v: string): string {
    return '{{' + v + '}}';
  }

  categoryLabel(cat: TemplateCategory): string {
    return this.categoryMeta[cat]?.label ?? cat;
  }

  categoryColor(cat: TemplateCategory): string {
    return this.categoryMeta[cat]?.color ?? '#94A3B8';
  }
}
