import HistoryView from "@/components/HistoryView";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <HistoryView />
    </div>
  );
}
