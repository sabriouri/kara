import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { PoleService } from '../../core/services/pole.service';

export interface FlyoutState {
  label: string;
  children: NavItem[];
  top: number;
}

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
  separator?: boolean;
}

export interface Pole {
  id: string;
  label: string;
  icon: string;
  color: string;
  dashboardRoute: string;
  nav: NavItem[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent {

  collapsed  = signal(false);
  openMenus  = signal<Set<string>>(new Set());
  flyout     = signal<FlyoutState | null>(null);
  private _flyoutClose: ReturnType<typeof setTimeout> | null = null;

  // ── Nav commun présent dans chaque pôle ──────────────────────────────────
  private readonly commonNav: NavItem[] = [
    { separator: true, label: '', icon: '' },
    { label: 'Projets', icon: 'folder-kanban', route: '/projects' },
    { label: 'Tickets', icon: 'ticket',        route: '/tickets'  },
    { label: 'Notion',  icon: 'book-open',     route: '/notion'   },
  ];

  readonly poles: Pole[] = [
    {
      id: 'rd', label: 'Relation Donateur', icon: 'droplets',
      color: '#1AABE2', dashboardRoute: '/dashboard',
      nav: [
        {
          label: 'Puits', icon: 'droplets', children: [
            { label: 'Carte des puits', icon: 'map-pin',  route: '/wells'           },
            { label: 'Mensualisations', icon: 'calendar', route: '/mensualisations' },
            { label: 'Tranches',        icon: 'layers',   route: '/wells/tranches'  },
          ]
        },
        { label: 'Orphelins',      icon: 'users',          route: '/orphans'         },
        { label: 'Aqiqas',         icon: 'heart',          route: '/aqiqas'          },
        { label: 'Modèles e-mail', icon: 'mail',           route: '/email-templates' },
        { label: 'Messagerie',     icon: 'message-square', route: '/inbox'           },
        ...this.commonNav,
      ]
    },
    {
      id: 'marketing', label: 'Marketing', icon: 'trending-up',
      color: '#8b5cf6', dashboardRoute: '/dashboard',
      nav: [
        { label: 'Projets', icon: 'folder-kanban', route: '/projects' },
        { label: 'Tickets', icon: 'ticket',        route: '/tickets'  },
        { label: 'Notion',  icon: 'book-open',     route: '/notion'   },
      ]
    },
    {
      id: 'compta', label: 'Comptabilité', icon: 'landmark',
      color: '#52AE4F', dashboardRoute: '/dashboard',
      nav: [
        { label: 'Virements', icon: 'landmark', route: '/virements' },
        ...this.commonNav,
      ]
    },
    {
      id: 'projet', label: 'Pôle Projet', icon: 'folder-kanban',
      color: '#f59e0b', dashboardRoute: '/dashboard',
      nav: [
        { label: 'Projets', icon: 'folder-kanban', route: '/projects' },
        { label: 'Tickets', icon: 'ticket',        route: '/tickets'  },
        { label: 'Notion',  icon: 'book-open',     route: '/notion'   },
      ]
    },
    {
      id: 'social', label: 'Social France', icon: 'heart',
      color: '#ef4444', dashboardRoute: '/dashboard',
      nav: [
        { label: 'Projets', icon: 'folder-kanban', route: '/projects' },
        { label: 'Tickets', icon: 'ticket',        route: '/tickets'  },
        { label: 'Notion',  icon: 'book-open',     route: '/notion'   },
      ]
    },
  ];

  activePoleId = signal<string>('rd');
  activePole   = computed(() => this.poles.find(p => p.id === this.activePoleId()) ?? this.poles[0]);

  constructor(public auth: AuthService, private router: Router, private poleService: PoleService) {}

  setPole(id: string): void {
    this.activePoleId.set(id);
    this.openMenus.set(new Set());
    this.poleService.set(id);
    const pole = this.poles.find(p => p.id === id);
    this.router.navigate([pole?.dashboardRoute ?? '/dashboard']);
  }

  toggleMenu(label: string): void {
    const m = new Set(this.openMenus());
    m.has(label) ? m.delete(label) : m.add(label);
    this.openMenus.set(m);
  }

  isMenuOpen(label: string): boolean { return this.openMenus().has(label); }
  toggleSidebar(): void {
    this.collapsed.set(!this.collapsed());
    this.flyout.set(null);
  }

  openFlyout(event: MouseEvent, item: NavItem): void {
    if (!this.collapsed() || !item.children?.length) return;
    if (this._flyoutClose) { clearTimeout(this._flyoutClose); this._flyoutClose = null; }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.flyout.set({ label: item.label, children: item.children, top: rect.top });
  }

  scheduleFlyoutClose(): void {
    this._flyoutClose = setTimeout(() => this.flyout.set(null), 120);
  }

  cancelFlyoutClose(): void {
    if (this._flyoutClose) { clearTimeout(this._flyoutClose); this._flyoutClose = null; }
  }
}
