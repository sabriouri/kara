import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { VirementService } from '../../core/services/virement.service';

interface PaymentSource {
  id: string;
  name: string;
  code?: string;
}

interface MatchedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Virement {
  id: string;
  description: string;
  amount: number;
  date: string;
  extractedName: string;
  suggestedCampaign: string;
  status: 'PENDING' | 'MATCHED' | 'VALIDATED' | 'SKIPPED' | 'NEW_CONTACT';
  matchedContact?: MatchedContact;
  selectedCampaign?: string;
  nameInput?: string;
}

const MOCK_VIREMENTS: Virement[] = [
  { id: '1', description: 'VIR SEPA - REF2024-001', amount: 150, date: '2024-03-15', extractedName: 'Jean Dupont', suggestedCampaign: 'Campagne Printemps', status: 'MATCHED', matchedContact: { id: 'c1', firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@mail.com' } },
  { id: '2', description: 'VIR SEPA - REF2024-002', amount: 500, date: '2024-03-16', extractedName: 'Marie Martin', suggestedCampaign: 'Don mensuel', status: 'PENDING' },
  { id: '3', description: 'VIR SEPA - REF2024-003', amount: 75, date: '2024-03-17', extractedName: 'Ahmed Benali', suggestedCampaign: 'Puits Niger', status: 'NEW_CONTACT' },
  { id: '4', description: 'VIR SEPA - REF2024-004', amount: 1000, date: '2024-03-18', extractedName: 'Sophie Blanc', suggestedCampaign: 'Campagne Ramadan', status: 'VALIDATED', matchedContact: { id: 'c4', firstName: 'Sophie', lastName: 'Blanc', email: 'sophie.blanc@mail.com' } },
  { id: '5', description: 'VIR SEPA - REF2024-005', amount: 200, date: '2024-03-19', extractedName: 'Pierre Moreau', suggestedCampaign: 'Don mensuel', status: 'SKIPPED' },
];

@Component({
  selector: 'app-virements',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './virements.component.html',
  styleUrl: './virements.component.css',
})
export class VirementsComponent implements OnInit {
  virements      = signal<Virement[]>(MOCK_VIREMENTS.map(v => ({ ...v, nameInput: v.extractedName })));
  paymentSources = signal<PaymentSource[]>([]);
  loading        = signal(false);
  statusFilter   = signal('');
  selectedFile   = signal<File | null>(null);
  isDragging     = signal(false);

  readonly statusOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: 'PENDING',     label: 'En attente' },
    { value: 'MATCHED',     label: 'Correspondance trouvée' },
    { value: 'VALIDATED',   label: 'Validé' },
    { value: 'SKIPPED',     label: 'Ignoré' },
    { value: 'NEW_CONTACT', label: 'Nouveau contact' },
  ];

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    return f ? this.virements().filter(v => v.status === f) : this.virements();
  });

  readonly totalAmount = computed(() =>
    this.virements().reduce((sum, v) => sum + v.amount, 0)
  );

  readonly validatedCount = computed(() =>
    this.virements().filter(v => v.status === 'VALIDATED').length
  );

  constructor(private virementService: VirementService) {}

  ngOnInit(): void {
    this.loadPaymentSources();
  }

  loadPaymentSources(): void {
    this.virementService.getPaymentSources().subscribe({
      next: res => this.paymentSources.set(res.data ?? []),
      error: () => this.paymentSources.set([
        { id: 'p1', name: 'Campagne Printemps' },
        { id: 'p2', name: 'Don mensuel' },
        { id: 'p3', name: 'Campagne Ramadan' },
        { id: 'p4', name: 'Puits Niger' },
      ]),
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.selectedFile.set(file);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.selectedFile.set(file);
  }

  traiter(): void {
    // In a real app, this would parse the Excel/CSV file using xlsx library
    // and populate the virements signal
    alert('Traitement du fichier: ' + this.selectedFile()?.name + '\n(Fonctionnalité de parsing à connecter)');
  }

  updateName(v: Virement, name: string): void {
    this.virements.update(list =>
      list.map(item => item.id === v.id ? { ...item, nameInput: name } : item)
    );
  }

  updateCampaign(v: Virement, campaign: string): void {
    this.virements.update(list =>
      list.map(item => item.id === v.id ? { ...item, selectedCampaign: campaign } : item)
    );
  }

  skipVirement(v: Virement): void {
    this.virements.update(list =>
      list.map(item => item.id === v.id ? { ...item, status: 'SKIPPED' } : item)
    );
  }

  validerSelection(): void {
    const toValidate = this.filtered().filter(v => v.status === 'MATCHED' || v.status === 'PENDING');
    if (!toValidate.length) return;

    this.loading.set(true);
    this.virementService.validate({ ids: toValidate.map(v => v.id) }).subscribe({
      next: () => {
        this.virements.update(list =>
          list.map(v => toValidate.find(t => t.id === v.id) ? { ...v, status: 'VALIDATED' } : v)
        );
        this.loading.set(false);
      },
      error: () => {
        this.virements.update(list =>
          list.map(v => toValidate.find(t => t.id === v.id) ? { ...v, status: 'VALIDATED' } : v)
        );
        this.loading.set(false);
      },
    });
  }

  statusLabel(s: string): string {
    return this.statusOptions.find(o => o.value === s)?.label ?? s;
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      PENDING:     'badge-neutral',
      MATCHED:     'badge-info',
      VALIDATED:   'badge-success',
      SKIPPED:     'badge-neutral',
      NEW_CONTACT: 'badge-warning',
    };
    return map[s] ?? 'badge-neutral';
  }
}
