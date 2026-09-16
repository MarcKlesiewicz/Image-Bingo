import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-results-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder-page" aria-labelledby="results-heading">
      <h1 id="results-heading">Results</h1>
      <p>The winning team and final score will be shown here.</p>
    </section>
  `,
})
export class ResultsPage {}
