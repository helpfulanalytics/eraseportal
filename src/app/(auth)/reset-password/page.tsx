import { AuthResetPasswordShowcasePage } from "@/components/auth-reset-password";
import { requireGuest } from "@/lib/auth-guard";

export default async function ResetPasswordPage() {
  // Someone already signed in doesn't need this form — they can change a
  // password from settings without proving the email again.
  await requireGuest();

  return <AuthResetPasswordShowcasePage />;
}
