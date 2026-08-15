"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { areCmsCredentialsValid, setSessionCookie } from "@/lib/auth";
import { getSafeReturnPath } from "@/lib/auth-session";

export type SignInState = { error?: string };

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const submittedEmail = formData.get("email");
  const submittedPassword = formData.get("password");
  const email = typeof submittedEmail === "string" ? submittedEmail : "";
  const password = typeof submittedPassword === "string" ? submittedPassword : "";

  if (!areCmsCredentialsValid(email, password)) {
    return { error: "Invalid email or password." };
  }

  const cookieStore = await cookies();
  setSessionCookie(cookieStore, email.trim());
  redirect(getSafeReturnPath(formData.get("returnTo")));
}
