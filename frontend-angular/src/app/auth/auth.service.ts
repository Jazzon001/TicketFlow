import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = 'http://localhost:3000/api/auth';

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.api}/login`, { email, password });
  }

  guardarSesion(data: any) {
    if (this.isBrowser()) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
    }
  }

  getUsuario() {
    if (!this.isBrowser()) return {};
    const u = localStorage.getItem('usuario');
    return u ? JSON.parse(u) : {};
  }

  logout() {
    if (this.isBrowser()) localStorage.clear();
    this.router.navigate(['/login']);
  }

  estaLogueado(): boolean {
    return this.isBrowser() && !!localStorage.getItem('token');
  }
}