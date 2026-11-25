/**
 * The button row at the bottom of every wizard step, so the buttons sit in the same place on all five.
 * Left: back (or a short status). Right: the other actions, with the button that goes on always last.
 * Every button in the row uses size "lg". On phones they stack, with the button that goes on at the top.
 */
export function WizardActions({ left, children }: { left?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-wizard-actions className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
      {left ? (
        <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">{left}</div>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3 max-sm:ml-0 max-sm:flex-col-reverse max-sm:items-stretch">
        {children}
      </div>
    </div>
  );
}
