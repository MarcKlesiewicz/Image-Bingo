import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-play-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder-page" aria-labelledby="play-heading">
      <h1 id="play-heading">Play</h1>
      <p>The two-team bingo board will appear here.</p>
    </section>
  `,
})
export class PlayPage {}
