import { CheckCircle2, X, XCircle } from "lucide-react";

export interface ToastMessage {
  kind: "success" | "error";
  text: string;
}

export function Toast({ message, onClose }: { message: ToastMessage; onClose: () => void }) {
  const Icon = message.kind === "success" ? CheckCircle2 : XCircle;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-xl ${
      message.kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-red-200 bg-red-50 text-red-800"
    }`}>
      <Icon size={20} />
      <span className="text-sm font-medium">{message.text}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100" aria-label="Close message">
        <X size={17} />
      </button>
    </div>
  );
}
