import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="card">
        <h2>TicketFlow</h2>
        <p class="sub">Ingresa tus credenciales</p>

        <input type="email" [(ngModel)]="email" placeholder="Correo electrónico" />
        <input type="password" [(ngModel)]="password" placeholder="Contraseña" />

        <button (click)="login()" [disabled]="cargando">
          {{ cargando ? 'Ingresando...' : 'Ingresar' }}
        </button>

        <p class="error" *ngIf="error">{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .container {
      display: flex; justify-content: center;
      align-items: center; height: 100vh;
      background: #f5f5f5;
    }
    .card {
      background: white; padding: 2rem;
      border-radius: 12px; width: 340px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    h2 { margin: 0 0 4px; font-size: 22px; }
    .sub { color: #888; margin: 0 0 1.5rem; font-size: 14px; }
    input {
      width: 100%; padding: 10px 12px; margin-bottom: 12px;
      border: 1px solid #ddd; border-radius: 8px;
      font-size: 14px; box-sizing: border-box;
    }
    button {
      width: 100%; padding: 11px;
      background: #333; color: white;
      border: none; border-radius: 8px;
      font-size: 15px; cursor: pointer;
    }
    button:disabled { opacity: 0.6; cursor: default; }
    .error { color: #e53; font-size: 13px; margin-top: 8px; text-align: center; }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  cargando = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  login() {
    this.cargando = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: (data) => {
        this.auth.guardarSesion(data);
        if (data.usuario.rol === 3) {
          this.router.navigate(['/tickets']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: () => {
        this.error = 'Correo o contraseña incorrectos';
        this.cargando = false;
      }
    });
}
  
}