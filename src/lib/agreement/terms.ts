/** Attribution Agreement terms. Keep AGREEMENT_VERSION in sync with current_agreement_version() in SQL. */
export const AGREEMENT_VERSION = 1;

export const AGREEMENT_TERMS: string[] = [
  "Anyone who takes access (the adopters) credits the owners and the advisor by name in any submission, paper or product page that builds on this project.",
  "The owners confirmed, when they shared the project, that they have the right to share these files.",
  "Ownership of the original work stays with its owners. New work by the adopters belongs to them.",
  "ESTAFET records the handover in the project lineage.",
];

export const AGREEMENT_DISCLAIMER =
  "This is a simple template for student projects. It is not legal advice. Check your university's rules for shared work.";

export interface CreditLineInput {
  title: string;
  creators: string[];
  advisor: string;
  lineageId: string;
}

export function creditLine({ title, creators, advisor, lineageId }: CreditLineInput): string {
  const who = creators.length ? creators.join(", ") : "the original team";
  return `This work builds on "${title}" by ${who}${advisor ? `, advised by ${advisor}` : ""}. Source: ESTAFET lineage ${lineageId}.`;
}
