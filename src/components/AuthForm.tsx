"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  return (
    <div className="mx-auto mt-8 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
      <p className="mb-6 text-sm text-muted">
        {mode === "login" ? "Track what you studied and prove you understood it." : "One account per student."}
      </p>
      <form action={action} className="card space-y-4">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>New here? <Link className="text-accent underline" href="/signup">Create an account</Link></>
        ) : (
          <>Already registered? <Link className="text-accent underline" href="/login">Log in</Link></>
        )}
      </p>
    </div>
  );
}
