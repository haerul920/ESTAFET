/** Attribution Agreement terms. Keep AGREEMENT_VERSION in sync with current_agreement_version() in SQL. */
export const AGREEMENT_VERSION = 1;

export const AGREEMENT_TERMS: string[] = [
  "The adopters credit the creators and the advisor by name in any submission, paper or product page that builds on this project.",
  "The creators confirm they have the right to share these files.",
  "Ownership of the original work stays with its creators. New work by the adopters belongs to them.",
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
  const who = creators.length ? creators.join(", ") : "the original creators";
  return `This work builds on "${title}" by ${who}${advisor ? `, advised by ${advisor}` : ""}. Source: ESTAFET lineage ${lineageId}.`;
}
