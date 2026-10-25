import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Card with header, body and footer slots:
//
//   <admin-card heading="Details" subtitle="Name and code">
//     <button card-actions>...</button>   (header, right side)
//     ...fields...                        (body)
//     <div card-footer>...</div>          (footer, hidden when empty)
//   </admin-card>
@Component({
  selector: 'admin-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card admin-card shadow-sm border-0' },
  templateUrl: './admin-card.html',
  styleUrl: './admin-card.scss',
})
export class AdminCard {
  readonly heading = input('');
  readonly subtitle = input('');
  readonly icon = input('');
  // shows a red * next to the heading
  readonly required = input(false);
}
