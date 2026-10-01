import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Scoreboard } from './scoreboard';

describe('Scoreboard', () => {
  let fixture: ComponentFixture<Scoreboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Scoreboard] }).compileComponents();

    fixture = TestBed.createComponent(Scoreboard);
    fixture.componentRef.setInput('redScore', 3);
    fixture.componentRef.setInput('blueScore', 2);
    fixture.componentRef.setInput('redName', 'The Scarlet Picture Detectives');
    fixture.componentRef.setInput('blueName', 'The Cobalt Image Investigators');
    fixture.componentRef.setInput('currentRound', 2);
    fixture.componentRef.setInput('totalRounds', 5);
    fixture.componentRef.setInput('starter', 'red');
    fixture.componentRef.setInput('activeTeam', 'blue');
    fixture.componentRef.setInput('redLocked', true);
    fixture.componentRef.setInput('blueLocked', false);
    fixture.detectChanges();
  });

  it('renders Font Awesome icons for team and round state without legacy glyphs', () => {
    const host = fixture.nativeElement as HTMLElement;
    const iconNames = Array.from(host.querySelectorAll('fa-icon svg')).map((icon) =>
      icon.getAttribute('data-icon'),
    );

    expect(iconNames).toEqual([
      'caret-up',
      'check',
      'diamond',
      'square',
      'play',
    ]);
    expect(host.textContent).not.toMatch(/[▲■✓▶◆…]/u);
    expect(host.textContent).toContain('Locked');
    expect(host.textContent).toContain('Active turn');
  });

  it('keeps long team names available while using a waiting icon', () => {
    fixture.componentRef.setInput('activeTeam', null);
    fixture.componentRef.setInput('redLocked', false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const redName = host.querySelector<HTMLElement>('.red-score .team-name')!;
    const redStateIcon = host.querySelector<SVGElement>(
      '.red-score .team-state fa-icon svg',
    )!;

    expect(redName.title).toBe('The Scarlet Picture Detectives');
    expect(redName.textContent?.trim()).toBe('The Scarlet Picture Detectives');
    expect(redStateIcon.getAttribute('data-icon')).toBe('ellipsis');
    expect(host.querySelector('.red-score')?.getAttribute('aria-label')).toContain(
      'The Scarlet Picture Detectives',
    );
  });
});
