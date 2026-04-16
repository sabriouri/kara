import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email    = signal('');
  password = signal('');
  loading  = signal(false);
  error    = signal('');

  readonly testAccounts = [
    { role: 'Super Admin',        email: 'admin@kara.com',   pwd: 'password123' },
    { role: 'Relation Donateur',  email: 'rd@kara.com',      pwd: 'password123' },
    { role: 'Pôle Projet',        email: 'project@kara.com', pwd: 'password123' },
  ];

  constructor(private auth: AuthService, private router: Router) {}

  fillAccount(email: string, pwd: string): void {
    this.email.set(email);
    this.password.set(pwd);
  }

  onSubmit(): void {
    if (!this.email() || !this.password()) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Email ou mot de passe incorrect.');
      }
    });
  }
}
