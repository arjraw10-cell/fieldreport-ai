import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CaseDashboard from "@/components/CaseDashboard";
import { SESSION_COOKIE, getAuthContextFromToken } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const auth = await getAuthContextFromToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!auth) redirect("/login");

  return <CaseDashboard />;
}
