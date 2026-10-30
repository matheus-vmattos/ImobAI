import { STATUS_LABEL, type StatusImovel } from "@/lib/types";

export function StatusPill({ status }: { status: StatusImovel }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}
