import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-setup-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder-page" aria-labelledby="setup-heading">
      <h1 id="setup-heading">Game setup</h1>
      <p>Choose the teams and images here before quiz night begins.</p>
    </section>
  `,
})
export class SetupPage {}
