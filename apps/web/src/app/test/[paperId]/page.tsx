import type { Metadata } from 'next';
import { TestPlayer } from '@/components/test-player';

export const metadata: Metadata = {
  title: 'CBT Mock Test — SarkariPrep',
  description: 'Attempt a timed, exam-accurate CBT mock test with autosaved answers.',
};

export default function TestPage({ params }: { params: { paperId: string } }) {
  const paperIdOrSlug = decodeURIComponent(params.paperId);
  return <TestPlayer key={paperIdOrSlug} paperIdOrSlug={paperIdOrSlug} />;
}
