import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

import Button from '../Button';
import Input from '../Input';
import Badge from '../Badge';
import Card from '../Card';
import ConfirmationBar from '../ConfirmationBar';
import DeadlineMeter from '../DeadlineMeter';
import Countdown from '../Countdown';
import StarRating from '../StarRating';

describe('HCMS Design System Components (SSR / Static Verification)', () => {
  describe('Button Component', () => {
    it('renders with primary variant, accessible min touch target and text', () => {
      const html = renderToString(<Button variant="primary">Submit Complaint</Button>);
      expect(html).toContain('Submit Complaint');
      expect(html).toContain('bg-[#f5a524]');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('rounded-sm');
    });

    it('renders loading spinner and disabled state when isLoading is true', () => {
      const html = renderToString(<Button isLoading>Save</Button>);
      expect(html).toContain('Processing...');
      expect(html).toContain('disabled');
      expect(html).toContain('animate-spin');
    });

    it('renders ghost variant with 16% border', () => {
      const html = renderToString(<Button variant="ghost">Cancel</Button>);
      expect(html).toContain('border-[rgba(223,231,224,0.16)]');
      expect(html).toContain('Cancel');
    });
  });

  describe('Badge Component (Accessibility rule: Never colour alone)', () => {
    it('renders priority badge with both icon and text label for NORMAL (72h)', () => {
      const html = renderToString(<Badge priority="NORMAL" />);
      expect(html).toContain('Normal (72h)');
      expect(html).toContain('bg-[#7fb4c9]');
    });

    it('renders priority badge with both pulse indicator and text label for EMERGENCY (24h)', () => {
      const html = renderToString(<Badge priority="EMERGENCY" />);
      expect(html).toContain('Emergency (24h)');
      expect(html).toContain('bg-[#ff5a5f]');
      expect(html).toContain('animate-pulse');
    });

    it('renders status badge with both semantic icon and text for RESOLVED', () => {
      const html = renderToString(<Badge status="RESOLVED" />);
      expect(html).toContain('Resolved');
      expect(html).toContain('✓');
      expect(html).toContain('text-[#6fcf97]');
    });

    it('renders status badge for MARKED_RESOLVED', () => {
      const html = renderToString(<Badge status="MARKED_RESOLVED" />);
      expect(html).toContain('Marked Resolved');
      expect(html).toContain('◈');
    });
  });

  describe('ConfirmationBar Component', () => {
    it('renders 3 confirmation slots with progress bar role', () => {
      const html = renderToString(<ConfirmationBar solvedCount={2} notSolvedCount={0} requiredVotes={3} />);
      expect(html).toContain('2 / 3 confirmations');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="2"');
    });

    it('indicates verified status when threshold is reached', () => {
      const html = renderToString(<ConfirmationBar solvedCount={3} notSolvedCount={0} requiredVotes={3} />);
      expect(html).toContain('Verified by 3 students — Resolved');
      expect(html).toContain('bg-[#6fcf97]');
    });
  });

  describe('DeadlineMeter Component', () => {
    it('calculates elapsed time and renders progress bar', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const future = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

      const html = renderToString(
        <DeadlineMeter createdAt={past} deadline={future} priority="NORMAL" />
      );

      expect(html).toContain('SLA Tracker (72h Standard)');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('remaining');
    });
  });

  describe('Countdown Component', () => {
    it('renders with deadline label and countdown structure', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString();
      const html = renderToString(<Countdown targetDate={future} label="SLA" />);
      expect(html).toContain('SLA:');
      expect(html).toContain('font-mono');
    });
  });

  describe('Card Component', () => {
    it('renders with dark panel background and 16% border without left-border washes', () => {
      const html = renderToString(<Card>Hostel Complaint Content</Card>);
      expect(html).toContain('bg-[rgba(10,14,18,0.84)]');
      expect(html).toContain('border-[rgba(223,231,224,0.16)]');
      expect(html).not.toContain('border-l-4');
    });
  });

  describe('StarRating Component', () => {
    it('renders 3 star choices with 1-3 star scale in radiogroup', () => {
      const html = renderToString(<StarRating value={2} readOnly={false} />);
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('2 Stars — Satisfactory');
    });
  });

  describe('Input Component', () => {
    it('renders with label and 44px accessible touch height', () => {
      const html = renderToString(<Input label="Student ID" placeholder="STU-101" />);
      expect(html).toContain('Student ID');
      expect(html).toContain('h-[44px]');
      expect(html).toContain('border-[rgba(223,231,224,0.16)]');
    });
  });
});
