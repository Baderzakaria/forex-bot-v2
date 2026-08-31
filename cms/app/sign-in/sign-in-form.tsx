"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="space-y-2">
        <Label htmlFor="email">Admin email</Label>
        <Input
          autoComplete="username"
          id="email"
          name="email"
          required
          type="email"
          aria-describedby={state.error ? "sign-in-error" : undefined}
          aria-invalid={Boolean(state.error)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
          aria-describedby={state.error ? "sign-in-error" : undefined}
          aria-invalid={Boolean(state.error)}
        />
      </div>
      {state.error ? (
        <p id="sign-in-error" className="rounded-[16px] border border-[rgba(181,75,75,0.22)] bg-[rgba(181,75,75,0.08)] px-3 py-2 text-sm text-[var(--fx-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
