import { Injectable, inject } from '@angular/core';
import { SweetAlert2LoaderService } from '@sweetalert2/ngx-sweetalert2';
import type { SweetAlertIcon } from 'sweetalert2';

const BRAND = {
  confirmButtonColor: '#1d4ed8',
  cancelButtonColor: '#6c757d',
};

@Injectable()
export class AdminAlerts {
  private readonly loader = inject(SweetAlert2LoaderService);

  async confirm(
    title: string,
    text: string,
    confirmButtonText = 'Yes, update',
    icon: SweetAlertIcon = 'question',
  ): Promise<boolean> {
    const Swal = await this.loader.swal;
    const result = await Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText,
      reverseButtons: true,
      ...BRAND,
    });
    return result.isConfirmed;
  }

  async confirmDelete(title: string, text: string): Promise<boolean> {
    const Swal = await this.loader.swal;
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: BRAND.cancelButtonColor,
      reverseButtons: true,
    });
    return result.isConfirmed;
  }

  async success(title: string, text = ''): Promise<void> {
    const Swal = await this.loader.swal;
    await Swal.fire({ title, text, icon: 'success', timer: 1800, showConfirmButton: false });
  }

  async toast(title: string, icon: SweetAlertIcon = 'success'): Promise<void> {
    const Swal = await this.loader.swal;
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      timer: 2200,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  }

  async error(title: string, text: string): Promise<void> {
    const Swal = await this.loader.swal;
    await Swal.fire({ title, text, icon: 'error', ...BRAND });
  }
}
