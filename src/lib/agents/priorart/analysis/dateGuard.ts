import { PatentDocument } from '../schemas';

export function isStrictlyBefore(candidateIso: string | undefined, priorityIso: string): boolean {
  if (!candidateIso) return false;
  return candidateIso < priorityIso;
}

export function applyDateGuard<T extends PatentDocument>(
  docs: T[],
  priorityDateIso: string,
): T[] {
  return docs.filter((d) => {
    const pub = isStrictlyBefore(d.publicationDate, priorityDateIso);
    const filing = isStrictlyBefore(d.filingDate, priorityDateIso);
    return pub || filing;
  });
}
