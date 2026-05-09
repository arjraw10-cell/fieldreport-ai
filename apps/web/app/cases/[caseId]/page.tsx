import CaseDetailWorkspace from "@/components/CaseDetailWorkspace";

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseDetailWorkspace caseId={decodeURIComponent(caseId)} />;
}
