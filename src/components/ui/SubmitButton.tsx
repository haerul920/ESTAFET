"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";

type Props = Omit<React.ComponentProps<typeof Button>, "type" | "pending">;

/**
 * A submit button that shows its own spinner while the surrounding `<form action={serverAction}>` is running.
 * Use it in Server Components, where `useActionState` is not available. Client forms pass `pending` to `Button`.
 */
export function SubmitButton(props: Props) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" pending={pending} />;
}
