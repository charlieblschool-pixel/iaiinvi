import { googleEnabled } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return <SignupForm googleEnabled={googleEnabled} />;
}
