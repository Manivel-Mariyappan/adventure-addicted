import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'admin-ui-only-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="alert alert-light border d-flex align-items-start gap-2 py-2 small mb-3"
      role="note"
    >
      <span aria-hidden="true">ⓘ</span>
      <span>
        <strong>Preview screen.</strong> Data is saved only in this browser for now. It will be
        stored in MySQL once the <code>{{ api() }}</code> endpoint of the ASP.NET Core API is
        connected.
      </span>
    </div>
  `,
})
export class UiOnlyNote {
  readonly api = input.required<string>();
}
