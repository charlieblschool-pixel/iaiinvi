import { googleEnabled } from "@/lib/auth";
import { LoginFormWithSuspense } from "./login-form";

export default function LoginPage() {
  return <LoginFormWithSuspense googleEnabled={googleEnabled} />;
}
