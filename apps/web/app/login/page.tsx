import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { SESSION_COOKIE, getAuthContextFromToken } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const auth = await getAuthContextFromToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (auth) redirect("/");

  return <AuthForm mode="login" />;
}
