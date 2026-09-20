import { RecordExpenseDialog } from "@/components/finance/record-expense-dialog";
import { RecordRevenueDialog } from "@/components/finance/record-revenue-dialog";

type Option = { id: string; title: string };
type CompanyOption = { id: string; name: string };

export function FinanceActions({ drives, events, companies }: { drives: Option[]; events: Option[]; companies: CompanyOption[] }) {
  return (
    <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <RecordExpenseDialog drives={drives} events={events} />
      <RecordRevenueDialog drives={drives} events={events} companies={companies} />
    </div>
  );
}
